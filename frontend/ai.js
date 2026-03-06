/* ============================================================
   SESSION ORDER OS — AI Integration
   ============================================================ */

const AI = (() => {

    /** Build the prompt for AI analysis */
    function buildPrompt(incident, student, sessionIncidents) {
        const categoryMeta = Methodology.getCategoryMeta(incident.category);
        const band = Utils.getGradeBand(student.grade);
        const bandLabel = Utils.getGradeBandLabel(band);

        return `You are a tutoring session behavior analyst. Analyze this incident and provide a structured JSON response.

## Student Context
- Name: ${student.name}
- Grade: ${student.grade} (${bandLabel})
- Grade Band: ${band}

## Current Incident
- Category: ${incident.category} (${categoryMeta.label})
- Description: ${incident.description || 'No description provided'}
- Context: ${incident.context || 'No additional context'}
- Time: ${incident.timestamp}

## Session History
- Previous incidents this session: ${sessionIncidents.length}
${sessionIncidents.map(i => `  - ${i.category} (severity ${i.severity}) at ${i.timestamp}`).join('\n')}

## Required Response Format
Return ONLY a valid JSON object with these exact fields:
{
  "category": "${incident.category}",
  "severity": <1-4 integer>,
  "confidence": <0-1 float>,
  "intentHypothesis": "<brief analysis of likely intent behind behavior>",
  "recommendedResponse": "<specific action to take>",
  "script": "<exact wording the tutor should use, addressing the student by first name>",
  "preventionTip": "<actionable tip to prevent recurrence>",
  "fairnessNotes": "<any equity or context considerations>"
}

Severity scale: 1=minor, 2=moderate, 3=major, 4=critical (triggers session stop).
Consider grade-appropriateness, accumulated incidents, and restorative justice principles.`;
    }

    /** Call the Cloudflare Worker proxy */
    async function callWorker(prompt) {
        const workerUrlPref = await DB.get('preferences', 'workerUrl');
        const workerUrl = workerUrlPref?.value;

        if (!workerUrl) {
            throw new Error('Worker URL not configured. Set it in Settings.');
        }

        const temperaturePref = await DB.get('preferences', 'temperature');
        const temperature = temperaturePref?.value ?? 0.7;

        const modelPref = await DB.get('preferences', 'aiModel');
        const model = modelPref?.value || 'deepseek-chat';

        const systemPromptPref = await DB.get('preferences', 'systemPrompt');
        const systemPrompt = systemPromptPref?.value || 'You are a professional tutoring behavior analyst. Always respond with valid JSON only.';

        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                temperature,
                systemPrompt,
                userPrompt: prompt
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Worker returned ${response.status}: ${errText}`);
        }

        return response.json();
    }

    /**
     * Analyze an incident via AI.
     * Returns validated analysis or throws.
     */
    async function analyze(incident, student, sessionIncidents) {
        const prompt = buildPrompt(incident, student, sessionIncidents);
        const rawResponse = await callWorker(prompt);

        // Extract JSON from response (handles various DeepSeek response formats)
        let analysisData;
        if (rawResponse.choices && rawResponse.choices[0]?.message?.content) {
            analysisData = Validate.extractJSON(rawResponse.choices[0].message.content);
        } else if (rawResponse.content) {
            analysisData = Validate.extractJSON(rawResponse.content);
        } else if (rawResponse.category) {
            // Direct JSON response
            analysisData = rawResponse;
        } else {
            analysisData = Validate.extractJSON(JSON.stringify(rawResponse));
        }

        if (!analysisData) {
            throw new Error('Could not extract valid JSON from AI response');
        }

        // Validate against schema
        const validation = Validate.validateAIResponse(analysisData);
        if (!validation.valid) {
            throw new Error(`AI response validation failed: ${validation.errors.join(', ')}`);
        }

        analysisData.source = 'ai';
        return analysisData;
    }

    /** Test if the worker connection works */
    async function testConnection() {
        const workerUrlPref = await DB.get('preferences', 'workerUrl');
        const url = workerUrlPref?.value;
        if (!url) return { ok: false, error: 'No worker URL configured' };

        try {
            const res = await fetch(url, { method: 'GET' });
            if (res.ok) {
                return { ok: true, message: 'Connection successful' };
            }
            return { ok: false, error: `Status ${res.status}` };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    return { analyze, testConnection, buildPrompt };
})();
