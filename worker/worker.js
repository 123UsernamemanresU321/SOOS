/* ============================================================
   SESSION ORDER OS — Cloudflare Worker Proxy
   
   Responsibilities:
   - Validate request payload
   - Enforce CORS allowlist
   - Basic rate limiting (in-memory, per-IP)
   - Call DeepSeek API
   - Return strict JSON
   
   Environment secrets required:
   - DEEPSEEK_API_KEY
   ============================================================ */

// --- Rate Limiting (in-memory, resets on worker restart) ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;   // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;    // 20 requests per window

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return false;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
        return true;
    }
    return false;
}

// --- CORS ---
const ALLOWED_ORIGINS = [
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
    'null', // for file:// protocol
];

function isAllowedOrigin(origin) {
    if (!origin) return true; // Allow requests without origin (e.g., server-side)
    if (origin === 'null') return true; // file:// protocol sends origin "null"
    return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

// --- Request Validation ---
function validatePayload(body) {
    const errors = [];

    if (!body || typeof body !== 'object') {
        return ['Request body must be a JSON object'];
    }

    if (!body.userPrompt || typeof body.userPrompt !== 'string') {
        errors.push('userPrompt is required and must be a string');
    }

    if (body.userPrompt && body.userPrompt.length > 10000) {
        errors.push('userPrompt exceeds maximum length of 10000 characters');
    }

    if (body.temperature !== undefined) {
        const t = Number(body.temperature);
        if (isNaN(t) || t < 0 || t > 2) {
            errors.push('temperature must be a number between 0 and 2');
        }
    }

    return errors;
}

// --- Main Handler ---
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(origin),
            });
        }

        // CORS check
        if (!isAllowedOrigin(origin)) {
            return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // GET = health check
        if (request.method === 'GET') {
            return new Response(JSON.stringify({
                status: 'ok',
                service: 'Session Order OS — AI Proxy',
                timestamp: new Date().toISOString(),
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Only POST allowed for analysis
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Rate limiting
        if (isRateLimited(clientIP)) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Parse body
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Validate
        const validationErrors = validatePayload(body);
        if (validationErrors.length > 0) {
            return new Response(JSON.stringify({ error: 'Validation failed', details: validationErrors }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Check API key
        const apiKey = env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server misconfiguration: API key not set' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }

        // Call DeepSeek
        try {
            const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: body.model || 'deepseek-chat',
                    temperature: body.temperature ?? 0.7,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'system',
                            content: body.systemPrompt || 'You are a professional tutoring behavior analyst. Always respond with valid JSON only.',
                        },
                        {
                            role: 'user',
                            content: body.userPrompt,
                        },
                    ],
                    response_format: { type: 'json_object' },
                }),
            });

            if (!deepseekResponse.ok) {
                const errText = await deepseekResponse.text().catch(() => 'Unknown API error');
                return new Response(JSON.stringify({
                    error: 'DeepSeek API error',
                    status: deepseekResponse.status,
                    detail: errText,
                }), {
                    status: 502,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
                });
            }

            const result = await deepseekResponse.json();

            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });

        } catch (err) {
            return new Response(JSON.stringify({
                error: 'Failed to reach DeepSeek API',
                detail: err.message,
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
        }
    },
};
