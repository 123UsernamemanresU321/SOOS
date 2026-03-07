/* ============================================================
   SESSION ORDER OS — Session Management
   ============================================================ */

const Session = (() => {
    let _current = null;    // Current session object
    let _timer = null;      // Timer interval ID
    let _elapsed = 0;       // Elapsed seconds
    let _paused = false;

    /** Start a new session for a student */
    async function start(studentId) {
        if (_current) await end();

        const student = await DB.get('students', studentId);
        if (!student) throw new Error('Student not found');

        _current = {
            id: Utils.generateId(),
            studentId,
            studentName: student.name,
            studentGrade: student.grade,
            startTime: Utils.now(),
            endTime: null,
            status: 'active',       // active | paused | ended
            goals: [],
            incidentCount: 0,
            sessionState: 'stable'  // stable | warning | critical
        };

        await DB.add('sessions', _current);
        _elapsed = 0;
        _paused = false;
        _startTimer();
        _updateTimerDisplay();
        return _current;
    }

    /** Pause current session */
    function pause() {
        if (!_current || _paused) return;
        _paused = true;
        _current.status = 'paused';
        _stopTimer();
        DB.put('sessions', _current);
    }

    /** Resume paused session */
    function resume() {
        if (!_current || !_paused) return;
        _paused = false;
        _current.status = 'active';
        _startTimer();
        DB.put('sessions', _current);
    }

    /** End the current session */
    async function end() {
        if (!_current) return null;
        _stopTimer();
        _current.endTime = Utils.now();
        _current.status = 'ended';
        _current.duration = _elapsed;
        await DB.put('sessions', _current);
        const ended = _current;
        _current = null;
        _elapsed = 0;
        _updateTimerDisplay();
        return ended;
    }

    /** Get current session */
    function getCurrent() { return _current; }
    function isActive() { return _current && _current.status === 'active'; }
    function getElapsed() { return _elapsed; }

    /** Update session state based on incident count */
    async function updateState() {
        if (!_current) return;
        const incidents = await DB.getByIndex('incidents', 'sessionId', _current.id);
        _current.incidentCount = incidents.length;

        const band = Utils.getGradeBand(_current.studentGrade);
        const thresholds = Methodology.getThresholds(band);

        if (!thresholds) return;

        if (incidents.some(i => i.severity >= 4)) {
            _current.sessionState = 'critical';
        } else if (incidents.length >= thresholds.escalateCount) {
            _current.sessionState = 'critical';
        } else if (incidents.length >= thresholds.warningCount) {
            _current.sessionState = 'warning';
        } else {
            _current.sessionState = 'stable';
        }

        await DB.put('sessions', _current);
        _updateStateDisplay();
    }

    /** Add a goal to the session */
    function addGoal(text) {
        if (!_current) return;
        _current.goals.push({ id: Utils.generateId(), text, completed: false });
        DB.put('sessions', _current);
    }

    /** Toggle goal completion */
    function toggleGoal(goalId) {
        if (!_current) return;
        const goal = _current.goals.find(g => g.id === goalId);
        if (goal) {
            goal.completed = !goal.completed;
            DB.put('sessions', _current);
        }
    }

    // --- Timer internals ---
    function _startTimer() {
        _stopTimer();
        _timer = setInterval(() => {
            _elapsed++;
            _updateTimerDisplay();
        }, 1000);
    }

    function _stopTimer() {
        if (_timer) { clearInterval(_timer); _timer = null; }
    }

    function _updateTimerDisplay() {
        const el = document.getElementById('session-timer-value');
        if (el) el.textContent = Utils.formatTimer(_elapsed);
    }

    function _updateStateDisplay() {
        if (!_current) return;
        const label = document.getElementById('session-state-label');
        const dots = document.querySelectorAll('.session-state-dot');
        if (label) {
            const states = { stable: 'Stable', warning: 'Warning', critical: 'Critical' };
            label.textContent = states[_current.sessionState] || 'Stable';
        }
        if (dots.length >= 3) {
            dots.forEach((dot, i) => {
                dot.classList.remove('inactive');
                if (_current.sessionState === 'stable' && i >= 2) dot.classList.add('inactive');
                if (_current.sessionState === 'warning' && i >= 2) dot.classList.add('inactive');
                if (_current.sessionState === 'critical') {
                    dot.style.background = '#ef4444';
                } else if (_current.sessionState === 'warning') {
                    dots[0].style.background = '#f59e0b';
                    dots[1].style.background = '#f59e0b';
                } else {
                    dot.style.background = '';
                }
            });
        }
    }

    /** Remove a goal from the session */
    function removeGoal(goalId) {
        if (!_current) return;
        _current.goals = _current.goals.filter(g => g.id !== goalId);
        DB.put('sessions', _current);
    }

    return { start, pause, resume, end, getCurrent, isActive, getElapsed, updateState, addGoal, toggleGoal, removeGoal };
})();
