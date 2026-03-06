# Session Order OS — Cloudflare Worker Setup Guide

Complete beginner-friendly guide to deploying the AI proxy worker.

---

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- A [DeepSeek API key](https://platform.deepseek.com/)
- Node.js 18+ installed

---

## Step-by-Step Setup

### 1. Install Node.js

Download from [nodejs.org](https://nodejs.org/) (LTS recommended).
Verify:

```bash
node --version   # Should be 18+
npm --version
```

### 2. Install Wrangler

```bash
npm install -g wrangler
```

Verify:

```bash
wrangler --version
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This opens a browser window. Authorize your Cloudflare account.

### 4. Navigate to the Worker Directory

```bash
cd worker
```

### 5. Review `wrangler.toml`

The config file is already created. Key fields:

- `name`: Your worker name (appears in your Cloudflare dashboard)
- `main`: Entry point file (`worker.js`)
- `compatibility_date`: API compatibility version

### 6. Set Your DeepSeek API Key as a Secret

```bash
wrangler secret put DEEPSEEK_API_KEY
```

Paste your DeepSeek API key when prompted. This is stored securely in Cloudflare and **never** appears in code.

### 7. Local Development

```bash
wrangler dev
```

The worker runs locally at `http://localhost:8787`. Test with:

```bash
curl http://localhost:8787
```

Expected response:

```json
{"status":"ok","service":"Session Order OS — AI Proxy","timestamp":"..."}
```

### 8. Deploy to Production

```bash
wrangler deploy
```

Your worker URL will be:

```
https://session-order-os-worker.<your-subdomain>.workers.dev
```

### 9. Test the Deployed Endpoint

```bash
curl https://session-order-os-worker.<your-subdomain>.workers.dev
```

Test a POST request:

```bash
curl -X POST https://session-order-os-worker.<your-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"userPrompt":"Test: analyze a minor off-task incident for a grade 8 student","temperature":0.7}'
```

### 10. Troubleshoot Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `403 Origin not allowed` | CORS mismatch | Add your domain to `ALLOWED_ORIGINS` in `worker.js` |
| `429 Rate limit exceeded` | Too many requests | Wait 60 seconds, or adjust `RATE_LIMIT_MAX_REQUESTS` |
| `500 API key not set` | Secret not configured | Run `wrangler secret put DEEPSEEK_API_KEY` |
| `502 DeepSeek API error` | Invalid key or API issue | Verify key at [platform.deepseek.com](https://platform.deepseek.com/) |

### 11. Rotate Secrets

To update your API key:

```bash
wrangler secret put DEEPSEEK_API_KEY
```

Enter the new key. Takes effect immediately — no redeployment needed.

### 12. Connect Frontend to Worker

1. Open the app → **Settings** page
2. Paste your worker URL into **Primary API URL**
3. Click **Test Connection**
4. If successful, AI analysis is now live

The frontend works fully offline without the worker — it falls back to deterministic discipline logic automatically.

---

## Architecture

```
Browser (index.html)
    │
    ├── Offline: Deterministic logic (methodology.js)
    │
    └── Online: POST request ──► Cloudflare Worker
                                      │
                                      ├── Validate payload
                                      ├── Check CORS
                                      ├── Rate limit
                                      └── Call DeepSeek API ──► Return JSON
```

## Security Notes

- The DeepSeek API key is **only** stored as a Cloudflare Worker secret
- The frontend **never** contains or transmits the API key
- CORS is enforced to prevent unauthorized origins
- Rate limiting prevents abuse (20 req/min per IP)
