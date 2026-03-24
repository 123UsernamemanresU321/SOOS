/* ============================================================
   SESSION ORDER OS — Session Management
   Uses wall-clock timestamps so the timer stays accurate even
   when the browser tab is in the background.
   ============================================================ */

const Session = (() => {
    let _current = null;       // Current session object
    let _timer = null;         // Timer interval ID
    let _startedAt = 0;        // Date.now() when timer last (re)started
    let _accumulatedMs = 0;    // Milliseconds accumulated before the last pause
    let _paused = false;

    /** Compute true elapsed seconds from wall-clock time */
    function _computeElapsed() {
        if (_paused || !_current) return Math.round(_accumulatedMs / 1000);
        return Math.round((_accumulatedMs + (Date.now() - _startedAt)) / 1000);
    }

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
        _accumulatedMs = 0;
        _paused = false;
        _startTimer();
        _updateTimerDisplay();
        return _current;
    }

    /** Pause current session */
    function pause() {
        if (!_current || _paused) return;
        // Freeze accumulated time
        _accumulatedMs += Date.now() - _startedAt;
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
        _startTimer();             // _startTimer sets _startedAt
        DB.put('sessions', _current);
    }

    /** End the current session */
    async function end() {
        if (!_current) return null;
        _stopTimer();
        _current.endTime = Utils.now();
        _current.status = 'ended';
        _current.duration = _computeElapsed();
        await DB.put('sessions', _current);
        const ended = _current;
        _current = null;
        _accumulatedMs = 0;
        _updateTimerDisplay();
        return ended;
    }

    /** Get current session */
    function getCurrent() { return _current; }
    function isActive() { return _current && _current.status === 'active'; }
    function getElapsed() { return _computeElapsed(); }

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

    // --- Timer internals (wall-clock based) ---
    function _startTimer() {
        _stopTimer();
        _startedAt = Date.now();   // anchor for wall-clock diff
        _timer = setInterval(() => {
            _updateTimerDisplay();  // just refreshes the display
        }, 1000);
    }

    function _stopTimer() {
        if (_timer) { clearInterval(_timer); _timer = null; }
    }

    function _updateTimerDisplay() {
        const el = document.getElementById('session-timer-value');
        if (el) el.textContent = Utils.formatTimer(_computeElapsed());
    }

    // When the tab regains focus, immediately refresh the display
    // so the user sees the correct time right away.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && _current && !_paused) {
            _updateTimerDisplay();
        }
    });

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
