/* ============================================================
   SESSION ORDER OS — Methodology & Discipline Model
   ============================================================ */

const Methodology = (() => {

    /** Discipline categories */
    const CATEGORIES = {
        FOCUS_OFF_TASK: { label: 'Off-Task', icon: 'event_busy', color: '#f59e0b', desc: 'Distracted, drawing, daydreaming' },
        INTERRUPTING: { label: 'Interrupting', icon: 'voice_over_off', color: '#f97316', desc: 'Speaking out of turn, noise' },
        DISRESPECT_TONE: { label: 'Disrespect', icon: 'mood_bad', color: '#f43f5e', desc: 'Tone, body language, refusal' },
        NON_COMPLIANCE: { label: 'Non-Compliance', icon: 'block', color: '#ef4444', desc: 'Refusing to follow instructions' },
        TECH_MISUSE: { label: 'Device Misuse', icon: 'phonelink_off', color: '#3b82f6', desc: 'Non-educational sites, phone' },
        ACADEMIC_INTEGRITY: { label: 'Integrity', icon: 'verified_user', color: '#6366f1', desc: 'Plagiarism, copying work' },
        SAFETY_BOUNDARY: { label: 'Safety', icon: 'warning', color: '#dc2626', desc: 'Physical risk, immediate action' },
        OTHER: { label: 'Other', icon: 'more_horiz', color: '#64748b', desc: 'Uncategorized behavior' }
    };

    /** Severity definitions */
    const SEVERITIES = {
        1: { label: 'Minor', badge: 'severity-low', badgeLabel: 'LOW SEVERITY' },
        2: { label: 'Moderate', badge: 'severity-moderate', badgeLabel: 'MODERATE' },
        3: { label: 'Major', badge: 'severity-major', badgeLabel: 'MAJOR' },
        4: { label: 'Critical', badge: 'severity-critical', badgeLabel: 'CRITICAL' }
    };

    /** Default methodology configuration for all grade bands */
    function getDefaultConfig() {
        return {
            bands: {
                A: {
                    label: 'Band A — Grades 1–2',
                    grades: [1, 2],
                    thresholds: { warningCount: 3, escalateCount: 5, criticalAutoStop: true },
                    consequences: {
                        1: { action: 'Gentle Reminder', script: '"Hey [name], let\'s get back to our work. You\'re doing great!"', restorative: 'Verbal check-in' },
                        2: { action: 'Quiet Conversation', script: '"[name], I need you to listen. Let\'s talk about what happened."', restorative: 'Draw/write how to do better' },
                        3: { action: 'Cool-Down Space', script: '"[name], take a break in the calm corner. I\'ll come talk to you in a minute."', restorative: 'Guided breathing + apology card', parentEscalation: true },
                        4: { action: 'Session Stop — Contact Guardian', script: '"[name], we need to pause our session. Your safety matters most."', restorative: 'Parent conference required', parentEscalation: true }
                    }
                },
                B: {
                    label: 'Band B — Grades 3–5',
                    grades: [3, 4, 5],
                    thresholds: { warningCount: 3, escalateCount: 4, criticalAutoStop: true },
                    consequences: {
                        1: { action: 'Verbal Warning — Level 1', script: '"I noticed you\'re off-task. Let\'s refocus so you can finish on time."', restorative: 'Self-reflection question' },
                        2: { action: 'Written Warning', script: '"This is your second reminder. I need you to take responsibility for your behavior."', restorative: 'Written plan for improvement' },
                        3: { action: 'Privilege Removal', script: '"Because of repeated disruptions, you\'ll work independently for the rest of the session."', restorative: 'Restorative conversation + commitment letter', parentEscalation: true },
                        4: { action: 'Session Stop — Parent Contact', script: '"We need to end our session. I\'ll be reaching out to your parent/guardian."', restorative: 'Parent meeting required', parentEscalation: true }
                    }
                },
                C: {
                    label: 'Band C — Grades 6–8',
                    grades: [6, 7, 8],
                    thresholds: { warningCount: 2, escalateCount: 3, criticalAutoStop: true },
                    consequences: {
                        1: { action: 'Verbal Warning — Level 1', script: '"I noticed you\'re off-task and on a non-educational site. Let\'s refocus on the math module so you can finish on time."', restorative: 'Verbal acknowledgment' },
                        2: { action: 'Formal Warning', script: '"This is a formal warning. Your behavior is affecting your learning. What can we do differently?"', restorative: 'Written reflection on impact' },
                        3: { action: 'Session Restriction', script: '"Due to ongoing issues, the session is being modified. We need to discuss this with your parent."', restorative: 'Behavior contract + parent email', parentEscalation: true },
                        4: { action: 'Immediate Session End', script: '"This session is ending now due to safety/critical concerns. Your parent will be contacted."', restorative: 'Re-entry meeting with parent', parentEscalation: true }
                    }
                },
                D: {
                    label: 'Band D — Grades 9–10',
                    grades: [9, 10],
                    thresholds: { warningCount: 2, escalateCount: 3, criticalAutoStop: true },
                    consequences: {
                        1: { action: 'Verbal Redirect', script: '"Let\'s stay on task. You have responsibilities here — let\'s meet them."', restorative: 'Self-assessment form' },
                        2: { action: 'Written Warning', script: '"I\'m documenting this behavior. Let\'s talk about what\'s going on and how we fix it."', restorative: 'Action plan with timeline' },
                        3: { action: 'Escalated Consequence', script: '"This behavior pattern is serious. I\'m limiting your session access and contacting your parent."', restorative: 'Mediation session + behavior contract', parentEscalation: true },
                        4: { action: 'Emergency Session Stop', script: '"Session ends immediately. This matter requires parent and possibly administrator involvement."', restorative: 'Formal re-entry process', parentEscalation: true }
                    }
                },
                E: {
                    label: 'Band E — Grades 11–13',
                    grades: [11, 12, 13],
                    thresholds: { warningCount: 1, escalateCount: 2, criticalAutoStop: true },
                    consequences: {
                        1: { action: 'Professional Redirect', script: '"This is a professional learning environment. Please re-engage with the material."', restorative: 'Self-directed reflection essay' },
                        2: { action: 'Documented Warning', script: '"Your behavior is being formally documented. We need to have an adult conversation about expectations."', restorative: 'Written commitment + follow-up meeting' },
                        3: { action: 'Service Suspension', script: '"Your access is being suspended pending a review. A parent/guardian meeting is required for reinstatement."', restorative: 'Formal review + reinstatement conditions', parentEscalation: true },
                        4: { action: 'Immediate Termination', script: '"This session is terminated immediately. All relevant parties will be notified."', restorative: 'Full review with all stakeholders', parentEscalation: true }
                    }
                }
            }
        };
    }

    /** Get consequence for a given band and severity */
    function getConsequence(bandKey, severity) {
        const config = getDefaultConfig();
        const band = config.bands[bandKey];
        if (!band) return null;
        return band.consequences[severity] || null;
    }

    /** Get thresholds for a given band */
    function getThresholds(bandKey) {
        const config = getDefaultConfig();
        const band = config.bands[bandKey];
        return band ? band.thresholds : null;
    }

    /**
     * Deterministic discipline analysis — operates without AI.
     * Takes incident data and student info, returns recommendation.
     */
    function analyzeIncident(incident, student, sessionIncidents) {
        const band = Utils.getGradeBand(student.grade);
        const consequence = getConsequence(band, incident.severity);
        const thresholds = getThresholds(band);

        // Count incidents in this session by category
        const categoryCount = sessionIncidents.filter(i => i.category === incident.category).length + 1;
        const totalCount = sessionIncidents.length + 1;

        // Determine effective severity based on accumulation
        let effectiveSeverity = incident.severity;
        if (categoryCount >= (thresholds?.escalateCount || 3)) {
            effectiveSeverity = Math.min(effectiveSeverity + 1, 4);
        } else if (categoryCount >= (thresholds?.warningCount || 2)) {
            effectiveSeverity = Math.min(effectiveSeverity + 1, 3);
        }

        const effectiveConsequence = getConsequence(band, effectiveSeverity);

        // Build recommendation
        return {
            category: incident.category,
            severity: effectiveSeverity,
            confidence: 0.85,
            intentHypothesis: `Student displayed ${CATEGORIES[incident.category]?.label || 'behavioral'} issue. This is occurrence #${categoryCount} of this type in the current session.`,
            recommendedResponse: effectiveConsequence?.action || 'Verbal Warning',
            script: effectiveConsequence?.script?.replace('[name]', student.name.split(' ')[0]) || `"Let's refocus, ${student.name.split(' ')[0]}."`,
            preventionTip: totalCount > 2
                ? 'Consider a brief break or activity change to reset the session dynamic.'
                : 'Maintain proximity and positive reinforcement for on-task behavior.',
            fairnessNotes: effectiveConsequence?.parentEscalation
                ? 'Parent escalation triggered per grade band policy.'
                : 'Standard response within normal parameters.',
            restorative: effectiveConsequence?.restorative || '',
            parentEscalation: effectiveConsequence?.parentEscalation || false,
            sessionStop: effectiveSeverity >= 4 && (thresholds?.criticalAutoStop ?? true),
            source: 'deterministic'
        };
    }

    /** Get category metadata */
    function getCategoryMeta(key) {
        return CATEGORIES[key] || CATEGORIES.OTHER;
    }

    /** Get severity metadata */
    function getSeverityMeta(level) {
        return SEVERITIES[level] || SEVERITIES[1];
    }

    /** Get all categories as array */
    function getAllCategories() {
        return Object.entries(CATEGORIES).map(([key, meta]) => ({ key, ...meta }));
    }

    return {
        CATEGORIES, SEVERITIES,
        getDefaultConfig, getConsequence, getThresholds,
        analyzeIncident, getCategoryMeta, getSeverityMeta, getAllCategories
    };
})();
