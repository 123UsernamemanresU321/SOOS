/* ============================================================
   SESSION ORDER OS — JSON Schema Validation
   ============================================================ */

const Validate = (() => {
    /** AI response schema definition */
    const AI_RESPONSE_SCHEMA = {
        category: {
            type: 'string', required: true, enum: [
                'FOCUS_OFF_TASK', 'INTERRUPTING', 'DISRESPECT_TONE', 'NON_COMPLIANCE',
                'TECH_MISUSE', 'ACADEMIC_INTEGRITY', 'SAFETY_BOUNDARY', 'OTHER'
            ]
        },
        severity: { type: 'number', required: true, min: 1, max: 4 },
        confidence: { type: 'number', required: true, min: 0, max: 1 },
        intentHypothesis: { type: 'string', required: true },
        recommendedResponse: { type: 'string', required: true },
        script: { type: 'string', required: true },
        preventionTip: { type: 'string', required: true },
        fairnessNotes: { type: 'string', required: false }
    };

    /** Validate a value against a field schema */
    function validateField(value, fieldSchema, fieldName) {
        const errors = [];

        if (fieldSchema.required && (value === undefined || value === null || value === '')) {
            errors.push(`${fieldName} is required`);
            return errors;
        }

        if (value === undefined || value === null) return errors;

        if (fieldSchema.type === 'string' && typeof value !== 'string') {
            errors.push(`${fieldName} must be a string`);
        }

        if (fieldSchema.type === 'number' && typeof value !== 'number') {
            errors.push(`${fieldName} must be a number`);
        }

        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`${fieldName} must be one of: ${fieldSchema.enum.join(', ')}`);
        }

        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
            errors.push(`${fieldName} must be >= ${fieldSchema.min}`);
        }

        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
            errors.push(`${fieldName} must be <= ${fieldSchema.max}`);
        }

        return errors;
    }

    /** Validate an AI response object. Returns { valid, errors, data } */
    function validateAIResponse(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Response must be a JSON object'], data: null };
        }

        const errors = [];
        for (const [field, schema] of Object.entries(AI_RESPONSE_SCHEMA)) {
            errors.push(...validateField(data[field], schema, field));
        }

        return {
            valid: errors.length === 0,
            errors,
            data: errors.length === 0 ? data : null
        };
    }

    /** Try to parse JSON string, return null on failure */
    function tryParseJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    /** Extract JSON from a string that may contain markdown code fences */
    function extractJSON(str) {
        if (!str) return null;

        // Try direct parse
        let parsed = tryParseJSON(str);
        if (parsed) return parsed;

        // Try extracting from code fences
        const fenceMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            parsed = tryParseJSON(fenceMatch[1].trim());
            if (parsed) return parsed;
        }

        // Try finding first { ... } block
        const braceMatch = str.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            parsed = tryParseJSON(braceMatch[0]);
            if (parsed) return parsed;
        }

        return null;
    }

    /** Validate import data structure */
    function validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Import data must be a JSON object'] };
        }

        const validStores = ['students', 'sessions', 'incidents', 'methodology', 'preferences'];
        const errors = [];

        for (const store of validStores) {
            if (data[store] && !Array.isArray(data[store])) {
                errors.push(`${store} must be an array`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    return { validateAIResponse, tryParseJSON, extractJSON, validateImportData, AI_RESPONSE_SCHEMA };
})();
