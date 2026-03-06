/* ============================================================
   SESSION ORDER OS — Incident Management
   ============================================================ */

const Incidents = (() => {

    /** Log a new incident */
    async function log(data) {
        const session = Session.getCurrent();
        if (!session) {
            console.warn('No active session — logging incident without session context');
        }

        const incident = {
            id: Utils.generateId(),
            sessionId: session?.id || null,
            studentId: session?.studentId || data.studentId || null,
            studentName: session?.studentName || data.studentName || 'Unknown',
            category: data.category,
            severity: data.severity || 1,
            description: data.description || '',
            context: data.context || '',
            timestamp: Utils.now(),
            status: 'logged',  // logged | reviewed | resolved
            aiAnalysis: null,
            appliedAction: null
        };

        await DB.add('incidents', incident);

        // Update session state
        if (session) {
            await Session.updateState();
        }

        return incident;
    }

    /** Get AI analysis for an incident (or deterministic fallback) */
    async function analyze(incidentId) {
        const incident = await DB.get('incidents', incidentId);
        if (!incident) return null;

        let student = null;
        if (incident.studentId) {
            student = await DB.get('students', incident.studentId);
        }
        if (!student) {
            student = { name: incident.studentName || 'Student', grade: 8 };
        }

        // Get session incidents for context
        let sessionIncidents = [];
        if (incident.sessionId) {
            sessionIncidents = await DB.getByIndex('incidents', 'sessionId', incident.sessionId);
            sessionIncidents = sessionIncidents.filter(i => i.id !== incidentId);
        }

        // Try AI first, fallback to deterministic
        let analysis = null;
        try {
            analysis = await AI.analyze(incident, student, sessionIncidents);
        } catch (err) {
            console.warn('AI analysis failed, using deterministic fallback:', err.message);
        }

        if (!analysis) {
            analysis = Methodology.analyzeIncident(incident, student, sessionIncidents);
        }

        // Save analysis to incident
        incident.aiAnalysis = analysis;
        incident.status = 'reviewed';
        await DB.put('incidents', incident);

        return analysis;
    }

    /** Apply an action to an incident */
    async function applyAction(incidentId, action) {
        const incident = await DB.get('incidents', incidentId);
        if (!incident) return null;

        incident.appliedAction = {
            action: action || incident.aiAnalysis?.recommendedResponse,
            appliedAt: Utils.now(),
            script: incident.aiAnalysis?.script || ''
        };
        incident.status = 'resolved';
        await DB.put('incidents', incident);

        // Check if session should stop
        if (incident.aiAnalysis?.sessionStop) {
            await Session.end();
        }

        return incident;
    }

    /** Get all incidents, optionally filtered */
    async function getAll(filters = {}) {
        let incidents = await DB.getAll('incidents');

        if (filters.studentId) {
            incidents = incidents.filter(i => i.studentId === filters.studentId);
        }
        if (filters.sessionId) {
            incidents = incidents.filter(i => i.sessionId === filters.sessionId);
        }
        if (filters.category) {
            incidents = incidents.filter(i => i.category === filters.category);
        }
        if (filters.severity) {
            incidents = incidents.filter(i => i.severity === filters.severity);
        }
        if (filters.status) {
            incidents = incidents.filter(i => i.status === filters.status);
        }

        // Sort by timestamp descending
        incidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return incidents;
    }

    /** Get incident statistics */
    async function getStats() {
        const incidents = await DB.getAll('incidents');
        const total = incidents.length;

        const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const byCategory = {};
        const byStatus = { logged: 0, reviewed: 0, resolved: 0 };

        incidents.forEach(i => {
            bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
            byCategory[i.category] = (byCategory[i.category] || 0) + 1;
            byStatus[i.status] = (byStatus[i.status] || 0) + 1;
        });

        // Resolution rate
        const resolved = byStatus.resolved || 0;
        const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '100.0';

        // Active alerts (logged but not resolved)
        const activeAlerts = (byStatus.logged || 0) + (byStatus.reviewed || 0);

        return { total, bySeverity, byCategory, byStatus, resolutionRate, activeAlerts };
    }

    /** Paginate incidents */
    async function getPaginated(page = 1, perPage = 5, filters = {}) {
        const all = await getAll(filters);
        const totalPages = Math.ceil(all.length / perPage);
        const start = (page - 1) * perPage;
        const items = all.slice(start, start + perPage);
        return { items, page, perPage, totalPages, total: all.length };
    }

    return { log, analyze, applyAction, getAll, getStats, getPaginated };
})();
