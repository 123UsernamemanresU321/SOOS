/* ============================================================
   SESSION ORDER OS — Main Application Controller
   ============================================================ */

const App = (() => {
  let _page = 'session';
  let _students = [];
  let _selectedStudent = null;
  let _currentAnalysis = null;

  /** Initialize the application */
  async function init() {
    try {
      await DB.open();
      await DB.seedIfEmpty();

      _students = await DB.getAll('students');
      _selectedStudent = _students[0] || null;

      // Set theme from preference
      try {
        const themePref = await DB.get('preferences', 'theme');
        if (themePref?.value === 'dark') document.body.classList.add('dark');
      } catch (e) { /* preferences may not exist yet */ }

      _populateStudentSelector();
      _bindNavigation();
      _bindHeaderActions();

      // Navigate to initial page from hash or default
      const hash = window.location.hash.slice(1) || 'session';
      navigate(hash);
    } catch (err) {
      console.error('Session Order OS init failed:', err);
      const main = document.getElementById('main-content');
      if (main) {
        main.innerHTML = `
                    <div class="glass" style="padding:3rem;text-align:center;max-width:32rem;margin:2rem auto">
                        <span class="material-symbols-outlined" style="font-size:3rem;color:var(--rose);display:block;margin-bottom:1rem">error</span>
                        <h2 style="margin-bottom:0.5rem">Initialization Error</h2>
                        <p style="color:var(--text-500);margin-bottom:1.5rem">${Utils.escapeHtml(err.message)}</p>
                        <p style="font-size:0.75rem;color:var(--text-400);margin-bottom:1rem">Try clearing site data: DevTools → Application → Storage → Clear site data</p>
                        <button class="btn btn-primary" onclick="indexedDB.deleteDatabase('SessionOrderOS'); location.reload();">Reset Database & Reload</button>
                    </div>
                `;
      }
    }
  }

  /** Navigate to a page */
  function navigate(page) {
    _page = page;
    window.location.hash = page;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Render the page
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    main.scrollTop = 0;

    switch (page) {
      case 'session': _renderSession(main); break;
      case 'rules': _renderRules(main); break;
      case 'methodology': _renderMethodology(main); break;
      case 'incidents': _renderIncidents(main); break;
      case 'reports': _renderReports(main); break;
      case 'settings': _renderSettings(main); break;
      default: _renderSession(main);
    }
  }

  function currentPage() { return _page; }

  /** Show a toast notification */
  function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:200;display:flex;flex-direction:column;gap:0.5rem;';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast fade-in';
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<div class="toast-body"><span class="material-symbols-outlined" style="color:${type === 'success' ? 'var(--emerald)' : 'var(--rose)'}">${icon}</span><p style="font-size:0.875rem;font-weight:500">${Utils.escapeHtml(message)}</p></div><span class="material-symbols-outlined toast-close" onclick="this.parentElement.remove()">close</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ===================== HEADER =====================

  function _populateStudentSelector() {
    const select = document.getElementById('student-select');
    if (!select) return;
    select.innerHTML = _students.map(s =>
      `<option value="${s.id}">${s.name} (Grade ${s.grade})</option>`
    ).join('');
    select.value = _selectedStudent?.id || '';
    select.onchange = (e) => {
      _selectedStudent = _students.find(s => s.id === e.target.value) || _students[0];
      if (_page === 'session') navigate('session');
    };
  }

  function _bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.page);
      });
    });
  }

  function _bindHeaderActions() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', async () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        await DB.put('preferences', { key: 'theme', value: isDark ? 'dark' : 'light' });
      });
    }

    // Settings button
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', () => navigate('settings'));

    // Session controls
    const startBtn = document.getElementById('btn-session-toggle');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        if (Session.isActive()) {
          const endedSession = await Session.end();
          startBtn.querySelector('.material-symbols-outlined').textContent = 'play_circle';
          // Fetch session incidents for summary
          if (endedSession) {
            const sessionIncidents = await DB.getByIndex('incidents', 'sessionId', endedSession.id);
            _showSessionEndSummary(endedSession, sessionIncidents);
          }
          navigate('session');
        } else if (_selectedStudent) {
          await Session.start(_selectedStudent.id);
          startBtn.querySelector('.material-symbols-outlined').textContent = 'stop_circle';
          showToast('Session started');
          navigate('session');
        }
      });
    }
  }

  // ===================== SESSION VIEW =====================

  async function _renderSession(container) {
    const student = _selectedStudent;
    if (!student) {
      container.innerHTML = '<div class="glass" style="padding:3rem;text-align:center"><h2>No students found</h2><p class="text-muted">Add students in Settings to get started.</p></div>';
      return;
    }

    const session = Session.getCurrent();
    let sessionIncidents = [];
    if (session) {
      sessionIncidents = await DB.getByIndex('incidents', 'sessionId', session.id);
    }

    // Build discipline state scores
    const categoryScores = {};
    const cats = ['FOCUS_OFF_TASK', 'DISRESPECT_TONE', 'TECH_MISUSE', 'ACADEMIC_INTEGRITY'];
    cats.forEach(c => { categoryScores[c] = 0; });
    sessionIncidents.forEach(i => {
      if (categoryScores[i.category] !== undefined) categoryScores[i.category] += i.severity;
    });

    const scoreLabels = {
      FOCUS_OFF_TASK: 'Focus Level',
      DISRESPECT_TONE: 'Respect Index',
      TECH_MISUSE: 'Tech Compliance',
      ACADEMIC_INTEGRITY: 'Integrity Score'
    };

    container.innerHTML = `
      <div class="grid-12">
        <!-- Left Column: Student + Goals -->
        <div class="col-3 space-y-6">
          <div class="glass student-card">
            <div class="avatar-lg">${Utils.initials(student.name)}</div>
            <h3>${Utils.escapeHtml(student.name)}</h3>
            <span class="grade-badge">GRADE ${student.grade}</span>
            <div class="student-stats">
              <div><p class="stat-label">Streak</p><p class="stat-value">${student.streak || 0} Days</p></div>
              <div><p class="stat-label">Points</p><p class="stat-value">${student.points || 0}</p></div>
            </div>
          </div>
          <div class="glass">
            <h4 style="font-size:0.875rem;font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
              <span class="material-symbols-outlined text-primary" style="font-size:0.875rem">checklist</span>
              Session Goals
            </h4>
            ${session ? `
              <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
                <input type="text" class="form-input" id="goal-input" placeholder="Add a goal…" style="font-size:0.8125rem;padding:0.5rem 0.75rem" onkeydown="if(event.key==='Enter')App._addGoal()">
                <button class="btn btn-primary btn-sm" onclick="App._addGoal()" style="flex-shrink:0;padding:0.5rem 0.75rem"><span class="material-symbols-outlined" style="font-size:1rem">add</span></button>
              </div>
            ` : ''}
            <div class="space-y-4" id="session-goals">
              ${(session?.goals || []).length === 0 && !session ? '<p style="font-size:0.8125rem;color:var(--text-400)">Start a session to add goals</p>' : ''}
              ${(session?.goals || []).length === 0 && session ? '<p style="font-size:0.8125rem;color:var(--text-400)">No goals yet — add one above</p>' : ''}
              ${(session?.goals || []).map(g => `
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <label class="checkbox-group" style="flex:1" data-goal="${g.id}">
                    <input type="checkbox" ${g.completed ? 'checked' : ''} onchange="App._toggleGoal('${g.id}')">
                    <span style="font-size:0.875rem;${g.completed ? 'text-decoration:line-through;opacity:0.5' : ''}">${Utils.escapeHtml(g.text)}</span>
                  </label>
                  <button onclick="App._removeGoal('${g.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-400);padding:0.25rem" title="Remove goal">
                    <span class="material-symbols-outlined" style="font-size:0.875rem">close</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Center Column: Quick Incidents + Discipline State -->
        <div class="col-6 space-y-6">
          <div class="glass">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
              <h4 style="font-weight:700;font-size:1.125rem">Quick Incident Logging</h4>
              <span style="font-size:0.75rem;color:var(--text-400)">Click to record behavior event</span>
            </div>
            <div class="incident-grid">
              ${Methodology.getAllCategories().filter(c => c.key !== 'OTHER' && c.key !== 'NON_COMPLIANCE').map(cat => `
                <button class="incident-btn" onclick="App._quickLog('${cat.key}')">
                  <span class="material-symbols-outlined incident-icon" style="color:${cat.color}">${cat.icon}</span>
                  <div>
                    <p class="incident-label">${cat.label}</p>
                    <p class="incident-desc">${cat.desc}</p>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="glass" style="border-left:4px solid var(--primary);box-shadow:var(--shadow-lg);position:relative;overflow:hidden">
            <div style="position:absolute;top:0;right:0;padding:0.75rem;opacity:0.1">
              <span class="material-symbols-outlined" style="font-size:3.75rem">analytics</span>
            </div>
            <h4 style="font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
              <span class="material-symbols-outlined text-primary">monitoring</span>
              Discipline State Analysis
            </h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem 2rem">
              ${cats.map(c => {
      const score = Math.min(categoryScores[c], 5);
      const pct = (score / 5) * 100;
      return `<div class="progress-group">
                  <div class="progress-header"><span>${scoreLabels[c]}</span><span class="progress-value">${score}/5</span></div>
                  <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                </div>`;
    }).join('')}
            </div>
          </div>
        </div>

        <!-- Right Column: AI Recommendation -->
        <div class="col-3">
          <div class="ai-panel" id="ai-panel">
            <div class="ai-panel-header">
              <span class="material-symbols-outlined">auto_awesome</span>
              <h4 style="font-weight:700">AI Recommendation</h4>
            </div>
            ${_currentAnalysis ? _renderAnalysis(_currentAnalysis) : `
              <div style="text-align:center;padding:2rem 0;color:var(--text-400)">
                <span class="material-symbols-outlined" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:1rem">psychology</span>
                <p style="font-size:0.875rem">Log an incident to receive AI-powered recommendations</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function _renderAnalysis(analysis) {
    const sevMeta = Methodology.getSeverityMeta(analysis.severity);
    return `
      <div class="ai-suggestion-box">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem">
          <p class="ai-suggestion-label">Suggested Action</p>
          <span class="ai-severity-badge ${sevMeta.badge}">${sevMeta.badgeLabel}</span>
        </div>
        <p style="font-weight:700">${Utils.escapeHtml(analysis.recommendedResponse)}</p>
      </div>
      <div style="margin-bottom:1.5rem">
        <p style="font-size:0.75rem;font-weight:700;color:var(--text-400);text-transform:uppercase;margin-bottom:0.5rem">Suggested Script</p>
        <div class="ai-script-box">${Utils.escapeHtml(analysis.script)}</div>
      </div>
      ${analysis.preventionTip ? `<div style="margin-bottom:1.5rem"><p style="font-size:0.75rem;font-weight:700;color:var(--text-400);text-transform:uppercase;margin-bottom:0.5rem">Prevention Tip</p><p style="font-size:0.875rem;color:var(--text-600)">${Utils.escapeHtml(analysis.preventionTip)}</p></div>` : ''}
      <div class="space-y-4">
        <button class="btn btn-primary btn-full" onclick="App._applyAction()">Apply Action</button>
        <button class="btn btn-secondary btn-full" onclick="App._openIncidentModal()">Override</button>
      </div>
      <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border-light)">
        <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;color:var(--text-500)">
          <span class="material-symbols-outlined" style="font-size:0.875rem">info</span>
          <span>Source: ${analysis.source === 'ai' ? 'AI Analysis' : 'Deterministic Logic'}</span>
        </div>
      </div>
    `;
  }

  // ===================== INCIDENT MODAL =====================

  function _openIncidentModal(category) {
    const overlay = document.getElementById('incident-modal');
    if (!overlay) return;
    overlay.classList.add('active');

    if (category) {
      const select = document.getElementById('modal-category');
      if (select) select.value = category;
    }
  }

  function _closeIncidentModal() {
    const overlay = document.getElementById('incident-modal');
    if (overlay) overlay.classList.remove('active');
  }

  async function _submitIncident() {
    const category = document.getElementById('modal-category')?.value;
    const severity = parseInt(document.querySelector('input[name="modal-severity"]:checked')?.value || '1');
    const description = document.getElementById('modal-description')?.value || '';
    const context = document.getElementById('modal-context')?.value || '';

    if (!category) { showToast('Please select a category', 'error'); return; }

    const incident = await Incidents.log({ category, severity, description, context });
    _closeIncidentModal();
    showToast('Incident logged');

    // Analyze
    const analysis = await Incidents.analyze(incident.id);
    _currentAnalysis = analysis;

    // Refresh session view to show analysis
    if (_page === 'session') navigate('session');
  }

  async function _quickLog(category) {
    const incident = await Incidents.log({ category, severity: 1 });
    showToast(`${Methodology.getCategoryMeta(category).label} logged`);

    const analysis = await Incidents.analyze(incident.id);
    _currentAnalysis = analysis;

    if (_page === 'session') navigate('session');
  }

  async function _applyAction() {
    if (!_currentAnalysis) return;
    const incidents = await Incidents.getAll();
    const latest = incidents[0];
    if (latest) {
      await Incidents.applyAction(latest.id);
      showToast('Action applied');
      _currentAnalysis = null;
      if (_page === 'session') navigate('session');
    }
  }

  function _toggleGoal(goalId) {
    Session.toggleGoal(goalId);
    navigate('session');
  }

  function _addGoal() {
    const input = document.getElementById('goal-input');
    if (!input || !input.value.trim()) return;
    Session.addGoal(input.value.trim());
    navigate('session');
  }

  function _removeGoal(goalId) {
    Session.removeGoal(goalId);
    navigate('session');
  }

  /** Show session end summary modal */
  function _showSessionEndSummary(session, incidents) {
    const duration = session.duration ? Utils.formatTimer(session.duration) : '—';
    const goalsCompleted = (session.goals || []).filter(g => g.completed).length;
    const goalsTotal = (session.goals || []).length;
    const sevCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    incidents.forEach(i => { if (sevCounts[i.severity] !== undefined) sevCounts[i.severity]++; });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'session-end-modal';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:640px">
        <div class="modal-header" style="background:linear-gradient(135deg,#2b6cee,#818cf8);color:#fff;padding:2rem">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <span class="material-symbols-outlined" style="font-size:1.5rem">flag</span>
            <h2 style="font-size:1.5rem;font-weight:900">Session Complete</h2>
          </div>
          <p style="opacity:0.8;font-size:0.875rem">${Utils.escapeHtml(session.studentName)} — ${duration}</p>
        </div>
        <div class="modal-body" style="padding:1.5rem 2rem">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem">
            <div style="text-align:center;padding:1rem;background:var(--text-100);border-radius:var(--radius-xl)">
              <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${duration}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;color:var(--text-500);font-weight:700">Duration</div>
            </div>
            <div style="text-align:center;padding:1rem;background:var(--text-100);border-radius:var(--radius-xl)">
              <div style="font-size:1.5rem;font-weight:700;color:${incidents.length === 0 ? 'var(--emerald)' : 'var(--text-900)'}">${incidents.length}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;color:var(--text-500);font-weight:700">Incidents</div>
            </div>
            <div style="text-align:center;padding:1rem;background:var(--text-100);border-radius:var(--radius-xl)">
              <div style="font-size:1.5rem;font-weight:700;color:${sevCounts[3] + sevCounts[4] > 0 ? '#f43f5e' : 'var(--emerald)'}">${sevCounts[3] + sevCounts[4]}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;color:var(--text-500);font-weight:700">Major/Critical</div>
            </div>
            <div style="text-align:center;padding:1rem;background:var(--text-100);border-radius:var(--radius-xl)">
              <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${goalsCompleted}/${goalsTotal}</div>
              <div style="font-size:0.625rem;text-transform:uppercase;color:var(--text-500);font-weight:700">Goals Done</div>
            </div>
          </div>

          ${incidents.length > 0 ? `
            <div style="margin-bottom:1rem">
              <p style="font-size:0.75rem;font-weight:700;color:var(--text-500);text-transform:uppercase;margin-bottom:0.5rem">Incidents During Session</p>
              <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius);padding:0.5rem">
                ${incidents.map(inc => {
      const cat = Methodology.getCategoryMeta(inc.category);
      const sev = Methodology.getSeverityMeta(inc.severity);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem;border-bottom:1px solid var(--text-100)">
                    <div style="display:flex;align-items:center;gap:0.5rem">
                      <span class="badge ${sev.badge}" style="font-size:0.5625rem">${sev.label}</span>
                      <span style="font-size:0.8125rem;font-weight:600">${Utils.escapeHtml(cat.label)}</span>
                    </div>
                    <span style="font-size:0.75rem;color:var(--text-400)">${Utils.formatDateTime(inc.timestamp)}</span>
                  </div>`;
    }).join('')}
              </div>
            </div>
          ` : '<div style="text-align:center;padding:1.5rem;color:var(--emerald)"><span class="material-symbols-outlined" style="font-size:2rem;display:block;margin-bottom:0.5rem">emoji_events</span><p style="font-weight:700">Clean session — no incidents!</p></div>'}
        </div>
        <div class="modal-footer" style="flex-wrap:wrap;gap:0.5rem">
          <button class="btn btn-outline btn-sm" id="btn-export-session-pdf"><span class="material-symbols-outlined" style="font-size:1rem">picture_as_pdf</span> Export PDF</button>
          <button class="btn btn-outline btn-sm" id="btn-export-session-csv"><span class="material-symbols-outlined" style="font-size:1rem">download</span> Export CSV</button>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('session-end-modal').remove()">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Bind export buttons with closure data (avoids JSON in data attributes)
    document.getElementById('btn-export-session-pdf').addEventListener('click', () => {
      Export.downloadSessionPDF(session, incidents);
    });
    document.getElementById('btn-export-session-csv').addEventListener('click', () => {
      Export.downloadCSV(incidents);
    });
  }

  // ===================== RULES VIEW =====================

  async function _renderRules(container) {
    const student = _selectedStudent;
    const grade = student?.grade || 8;
    const band = Utils.getGradeBand(grade);
    const config = Methodology.getDefaultConfig();
    const bandConfig = config.bands[band];

    const rules = [
      { icon: 'verified_user', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', title: 'Behavioral Standards', desc: 'Respect peer boundaries and maintain professional conduct at all times within the session.' },
      { icon: 'menu_book', color: '#10b981', bg: 'rgba(16,185,129,0.1)', title: 'Academic Integrity', desc: 'All work must be original and cited according to OS standards. Plagiarism results in immediate disqualification.' },
      { icon: 'update', color: '#f97316', bg: 'rgba(249,115,22,0.1)', title: 'Session Procedures', desc: 'Check-in is required within 5 minutes of session start. Late arrivals must report to administration.' },
      { icon: 'emergency_home', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', title: 'Safety Protocols', desc: 'Follow all emergency exit and equipment handling rules. Safety gear is mandatory for lab sessions.' }
    ];

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:0.5rem;color:var(--primary);font-weight:600;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">
            <span class="material-symbols-outlined" style="font-size:1rem">verified</span>
            <span>Active Guidelines</span>
          </div>
          <h1>Grade ${grade} Rules</h1>
          <p>Standard operating procedures and behavioral expectations for the current academic session.</p>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;background:#fff;padding:0.5rem;border-radius:var(--radius-xl);border:1px solid var(--border-light);box-shadow:var(--shadow-sm)">
          <div style="padding:0.5rem 1rem;display:flex;flex-direction:column">
            <span style="font-size:0.625rem;color:var(--text-400);text-transform:uppercase;font-weight:700;letter-spacing:0.1em">Selected Student</span>
            <select class="form-select" style="padding:0;border:none;font-weight:700;font-size:0.875rem;background:transparent" onchange="App._changeStudentAndRefresh(this.value)">
              ${_students.map(s => `<option value="${s.id}" ${s.id === student?.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="grid-4 mb-8">
        ${rules.map(r => `
          <div class="glass rule-card">
            <div class="rule-icon" style="background:${r.bg};color:${r.color}">
              <span class="material-symbols-outlined" style="font-size:1.875rem">${r.icon}</span>
            </div>
            <div>
              <h3>${r.title}</h3>
              <p>${r.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="glass featured-rule">
        <div class="featured-rule-img">
          <span class="tag">Grade ${grade} Core</span>
        </div>
        <div class="featured-rule-body">
          <div class="featured-rule-label"><span></span><span>Mandatory Requirement</span></div>
          <div>
            <h2>Attendance Policy Excellence</h2>
            <p style="font-size:1.125rem;color:var(--text-600);line-height:1.6;max-width:40rem">
              Grade ${grade} students must maintain a minimum of <strong style="color:var(--primary)">95% attendance</strong> for session eligibility. Failure to meet this standard will result in restricted access to advanced session modules.
            </p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-top:0.5rem">
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:var(--text-100);border-radius:var(--radius-full);border:1px solid var(--border-light)">
              <span class="material-symbols-outlined text-primary" style="font-size:1.25rem">event_available</span>
              <span style="font-size:0.875rem;font-weight:600">Strict Monitoring</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:var(--text-100);border-radius:var(--radius-full);border:1px solid var(--border-light)">
              <span class="material-symbols-outlined text-primary" style="font-size:1.25rem">notifications_active</span>
              <span style="font-size:0.875rem;font-weight:600">Automatic Alerts</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===================== METHODOLOGY VIEW =====================

  let _activeBand = 'C';
  let _editableConfig = null;

  async function _renderMethodology(container) {
    // Load saved config or use defaults
    const saved = await DB.get('methodology', 'default');
    _editableConfig = saved?.config || Methodology.getDefaultConfig();
    const bands = Object.entries(_editableConfig.bands);

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-header">
          <div class="breadcrumbs">
            <span>Admin</span><span class="material-symbols-outlined" style="font-size:0.75rem">chevron_right</span>
            <span>Configuration</span><span class="material-symbols-outlined" style="font-size:0.75rem">chevron_right</span>
            <span class="current">Methodology Editor</span>
          </div>
          <h1 style="font-size:1.875rem">Methodology Editor</h1>
          <p>Configure automated grade bands and behavioral session consequences</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline" onclick="App._resetMethodology()">Reset to Defaults</button>
          <button class="btn btn-primary" onclick="App._saveMethodology()">Save Changes</button>
        </div>
      </div>

      <div class="tabs mb-8">
        ${bands.map(([key, b]) => `
          <button class="tab-btn ${key === _activeBand ? 'active' : ''}" data-band="${key}" onclick="App._switchMethodologyTab(this)">${b.label.split('—')[1]?.trim() || b.label}</button>
        `).join('')}
      </div>

      <div style="max-width:64rem" class="space-y-4" id="methodology-sections">
        ${_renderMethodologySections(_editableConfig.bands[_activeBand], _activeBand)}
      </div>

      <div class="preview-banner">
        <div class="preview-icon"><span class="material-symbols-outlined" style="font-size:1.5rem">visibility</span></div>
        <div style="flex:1">
          <h3 style="font-weight:700">Logic Preview</h3>
          <p style="font-size:0.875rem;color:var(--text-600);margin-top:0.25rem" id="methodology-preview-text">Based on current settings for <strong>${_editableConfig.bands[_activeBand].label}</strong>: Warning at <strong>${_editableConfig.bands[_activeBand].thresholds.warningCount}</strong> incidents, escalation at <strong>${_editableConfig.bands[_activeBand].thresholds.escalateCount}</strong>. Critical auto-stop is <strong>${_editableConfig.bands[_activeBand].thresholds.criticalAutoStop ? 'enabled' : 'disabled'}</strong>.</p>
        </div>
      </div>
    `;
  }

  function _renderMethodologySections(band, bandKey) {
    const th = band.thresholds;
    const sevLabels = { 1: 'Minor (Level 1)', 2: 'Moderate (Level 2)', 3: 'Major (Level 3)', 4: 'Critical (Level 4)' };
    const sevColors = { 1: '#10b981', 2: '#f59e0b', 3: '#f97316', 4: '#ef4444' };

    return `
      <div class="accordion">
        <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
          <div class="accordion-header-left">
            <div class="accordion-icon" style="background:rgba(59,130,246,0.1);color:#3b82f6"><span class="material-symbols-outlined">tune</span></div>
            <div><h3 style="font-weight:700">Threshold Settings</h3><p style="font-size:0.75rem;color:var(--text-500)">Configure warning and escalation trigger points</p></div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--text-400)">expand_more</span>
        </div>
        <div class="accordion-body">
          <div class="grid-3">
            <div class="config-box">
              <div class="config-box-header"><span class="material-symbols-outlined" style="font-size:0.875rem;color:var(--text-400)">warning</span><span class="config-box-label">Warning Count</span></div>
              <input type="number" class="form-input" id="meth-warning" value="${th.warningCount}" min="1" max="10" style="text-align:center">
              <p style="font-size:0.625rem;color:var(--text-400);margin-top:0.25rem">Incidents before warning state</p>
            </div>
            <div class="config-box">
              <div class="config-box-header"><span class="material-symbols-outlined" style="font-size:0.875rem;color:var(--text-400)">gpp_maybe</span><span class="config-box-label">Escalation Count</span></div>
              <input type="number" class="form-input" id="meth-escalate" value="${th.escalateCount}" min="1" max="15" style="text-align:center">
              <p style="font-size:0.625rem;color:var(--text-400);margin-top:0.25rem">Incidents before critical state</p>
            </div>
            <div class="config-box">
              <div class="config-box-header"><span class="material-symbols-outlined" style="font-size:0.875rem;color:var(--text-400)">block</span><span class="config-box-label">Critical Auto-Stop</span></div>
              <label class="toggle" style="margin-top:0.5rem"><input type="checkbox" id="meth-autostop" ${th.criticalAutoStop ? 'checked' : ''}><span class="toggle-track"></span><span style="margin-left:0.75rem;font-size:0.75rem;font-weight:500">${th.criticalAutoStop ? 'Enabled' : 'Disabled'}</span></label>
              <p style="font-size:0.625rem;color:var(--text-400);margin-top:0.25rem">Auto-end session on critical</p>
            </div>
          </div>
        </div>
      </div>

      <div class="accordion">
        <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
          <div class="accordion-header-left">
            <div class="accordion-icon" style="background:rgba(249,115,22,0.1);color:#f97316"><span class="material-symbols-outlined">gavel</span></div>
            <div><h3 style="font-weight:700">Consequence Scripts</h3><p style="font-size:0.75rem;color:var(--text-500)">Edit the action, script, and restorative steps for each severity level</p></div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--text-400)">expand_more</span>
        </div>
        <div class="accordion-body">
          <div class="space-y-6">
            ${[1, 2, 3, 4].map(sev => {
      const c = band.consequences[sev];
      if (!c) return '';
      return `
              <div style="border:1px solid var(--text-100);border-radius:var(--radius-xl);padding:1.25rem;border-left:4px solid ${sevColors[sev]}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                  <h4 style="font-size:0.875rem;font-weight:700;display:flex;align-items:center;gap:0.5rem">
                    <span style="width:0.5rem;height:0.5rem;border-radius:50%;background:${sevColors[sev]}"></span>
                    ${sevLabels[sev]}
                  </h4>
                  ${c.parentEscalation ? '<span class="badge badge-warning" style="font-size:0.625rem">Parent Escalation</span>' : ''}
                </div>
                <div class="space-y-4">
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label" style="font-size:0.75rem">Action Label</label>
                    <input type="text" class="form-input" id="meth-action-${bandKey}-${sev}" value="${Utils.escapeHtml(c.action)}" style="font-size:0.875rem">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label" style="font-size:0.75rem">Script (use [name] as placeholder)</label>
                    <textarea class="form-textarea" id="meth-script-${bandKey}-${sev}" rows="2" style="font-size:0.875rem">${Utils.escapeHtml(c.script)}</textarea>
                  </div>
                  <div class="grid-2">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label" style="font-size:0.75rem">Restorative Step</label>
                      <input type="text" class="form-input" id="meth-restor-${bandKey}-${sev}" value="${Utils.escapeHtml(c.restorative)}" style="font-size:0.875rem">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label" style="font-size:0.75rem">Parent Escalation</label>
                      <label class="toggle" style="margin-top:0.25rem"><input type="checkbox" id="meth-parent-${bandKey}-${sev}" ${c.parentEscalation ? 'checked' : ''}><span class="toggle-track"></span><span style="margin-left:0.5rem;font-size:0.75rem">${c.parentEscalation ? 'Yes' : 'No'}</span></label>
                    </div>
                  </div>
                </div>
              </div>`;
    }).join('')}
          </div>
        </div>
      </div>

      <div class="accordion">
        <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
          <div class="accordion-header-left">
            <div class="accordion-icon" style="background:rgba(239,68,68,0.1);color:#ef4444"><span class="material-symbols-outlined">category</span></div>
            <div><h3 style="font-weight:700">Behavioral Categories</h3><p style="font-size:0.75rem;color:var(--text-500)">8 categories are defined globally and used across all bands</p></div>
          </div>
          <span class="material-symbols-outlined" style="color:var(--text-400)">expand_more</span>
        </div>
        <div class="accordion-body collapsed">
          <div class="grid-2">
            ${Methodology.getAllCategories().map(cat => `
              <div style="padding:0.75rem 1rem;border-radius:var(--radius);border:1px solid var(--text-100);display:flex;align-items:center;gap:0.75rem">
                <span class="material-symbols-outlined" style="color:${cat.color};font-size:1.25rem">${cat.icon}</span>
                <div>
                  <p style="font-size:0.875rem;font-weight:600">${cat.label}</p>
                  <p style="font-size:0.75rem;color:var(--text-500)">${cat.desc}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function _switchMethodologyTab(btn) {
    // Save current band edits to memory before switching
    _collectBandEdits(_activeBand);

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeBand = btn.dataset.band;

    const sectionsEl = document.getElementById('methodology-sections');
    if (sectionsEl && _editableConfig) {
      sectionsEl.innerHTML = _renderMethodologySections(_editableConfig.bands[_activeBand], _activeBand);
    }
    // Update preview text
    const previewEl = document.getElementById('methodology-preview-text');
    if (previewEl && _editableConfig) {
      const b = _editableConfig.bands[_activeBand];
      previewEl.innerHTML = `Based on current settings for <strong>${b.label}</strong>: Warning at <strong>${b.thresholds.warningCount}</strong> incidents, escalation at <strong>${b.thresholds.escalateCount}</strong>. Critical auto-stop is <strong>${b.thresholds.criticalAutoStop ? 'enabled' : 'disabled'}</strong>.`;
    }
  }

  function _collectBandEdits(bandKey) {
    if (!_editableConfig || !_editableConfig.bands[bandKey]) return;
    const band = _editableConfig.bands[bandKey];
    const wEl = document.getElementById('meth-warning');
    const eEl = document.getElementById('meth-escalate');
    const aEl = document.getElementById('meth-autostop');
    if (wEl) band.thresholds.warningCount = parseInt(wEl.value) || band.thresholds.warningCount;
    if (eEl) band.thresholds.escalateCount = parseInt(eEl.value) || band.thresholds.escalateCount;
    if (aEl) band.thresholds.criticalAutoStop = aEl.checked;

    [1, 2, 3, 4].forEach(sev => {
      const c = band.consequences[sev];
      if (!c) return;
      const actEl = document.getElementById(`meth-action-${bandKey}-${sev}`);
      const scrEl = document.getElementById(`meth-script-${bandKey}-${sev}`);
      const resEl = document.getElementById(`meth-restor-${bandKey}-${sev}`);
      const parEl = document.getElementById(`meth-parent-${bandKey}-${sev}`);
      if (actEl) c.action = actEl.value;
      if (scrEl) c.script = scrEl.value;
      if (resEl) c.restorative = resEl.value;
      if (parEl) c.parentEscalation = parEl.checked;
    });
  }

  async function _saveMethodology() {
    _collectBandEdits(_activeBand);
    await DB.put('methodology', { id: 'default', config: _editableConfig, updatedAt: Utils.now() });
    showToast('Methodology configuration saved');
  }

  async function _resetMethodology() {
    _editableConfig = Methodology.getDefaultConfig();
    await DB.put('methodology', { id: 'default', config: _editableConfig, updatedAt: Utils.now() });
    showToast('Reset to default configuration');
    navigate('methodology');
  }

  // ===================== INCIDENTS VIEW =====================

  let _incidentPage = 1;
  let _incidentFilter = null;

  async function _renderIncidents(container) {
    const result = await Incidents.getPaginated(_incidentPage, 5, _incidentFilter ? { severity: _incidentFilter } : {});
    const catIcons = { FOCUS_OFF_TASK: 'event_busy', INTERRUPTING: 'voice_over_off', DISRESPECT_TONE: 'mood_bad', TECH_MISUSE: 'phonelink_off', ACADEMIC_INTEGRITY: 'verified_user', SAFETY_BOUNDARY: 'warning', NON_COMPLIANCE: 'block', OTHER: 'more_horiz' };
    const catColors = { FOCUS_OFF_TASK: '#f59e0b', INTERRUPTING: '#f97316', DISRESPECT_TONE: '#f43f5e', TECH_MISUSE: '#3b82f6', ACADEMIC_INTEGRITY: '#6366f1', SAFETY_BOUNDARY: '#dc2626', NON_COMPLIANCE: '#ef4444', OTHER: '#64748b' };

    container.innerHTML = `
      <div class="page-header-row">
        <div class="page-header">
          <h1>Incident History</h1>
          <p>Real-time monitoring and historical activity logs.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" onclick="App._openIncidentModal()"><span class="material-symbols-outlined" style="font-size:1.125rem">add_circle</span> Log Incident</button>
          <button class="btn btn-outline" onclick="Export.downloadPDF()"><span class="material-symbols-outlined" style="font-size:1.125rem">picture_as_pdf</span> PDF</button>
          <button class="btn btn-outline" onclick="Export.downloadCSV()"><span class="material-symbols-outlined" style="font-size:1.125rem">download</span> CSV</button>
        </div>
      </div>

      <div class="filter-pills mb-6">
        <button class="filter-pill ${!_incidentFilter ? 'active' : ''}" onclick="App._filterIncidents(null)">All Severities</button>
        <button class="filter-pill ${_incidentFilter === 4 ? 'active' : ''}" onclick="App._filterIncidents(4)">Critical</button>
        <button class="filter-pill ${_incidentFilter === 3 ? 'active' : ''}" onclick="App._filterIncidents(3)">Major</button>
        <button class="filter-pill ${_incidentFilter === 2 ? 'active' : ''}" onclick="App._filterIncidents(2)">Moderate</button>
        <button class="filter-pill ${_incidentFilter === 1 ? 'active' : ''}" onclick="App._filterIncidents(1)">Minor</button>
      </div>

      <div class="space-y-4">
        ${result.items.length === 0 ? '<div class="glass" style="text-align:center;padding:3rem"><span class="material-symbols-outlined" style="font-size:3rem;opacity:0.2;display:block;margin-bottom:1rem">inbox</span><p class="text-muted">No incidents recorded yet</p></div>' : ''}
        ${result.items.map(inc => {
      const cat = Methodology.getCategoryMeta(inc.category);
      const sev = Methodology.getSeverityMeta(inc.severity);
      return `
            <div class="glass" style="padding:0;overflow:hidden" id="incident-item-${inc.id}">
              <div style="display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;cursor:pointer" onclick="App._viewIncidentDetail('${inc.id}')">
                <div style="width:3rem;height:3rem;border-radius:var(--radius-xl);background:${catColors[inc.category] || '#64748b'}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <span class="material-symbols-outlined" style="color:${catColors[inc.category] || '#64748b'};font-size:1.5rem">${catIcons[inc.category] || 'info'}</span>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem">
                    <span style="font-size:0.625rem;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:${catColors[inc.category]}">${cat.label}</span>
                    <span style="font-size:0.75rem;color:var(--text-500)">${Utils.formatDateTime(inc.timestamp)}</span>
                  </div>
                  <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.25rem">${Utils.escapeHtml(inc.description || cat.label + ' Incident')}</h3>
                  <p style="font-size:0.875rem;color:var(--text-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(inc.context || cat.desc)}</p>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0">
                  <span class="badge ${sev.badge}">${sev.label}</span>
                  <span class="badge badge-${inc.status === 'resolved' ? 'info' : 'muted'}">${inc.status}</span>
                  <span class="material-symbols-outlined" style="font-size:1.25rem;color:var(--primary)">expand_more</span>
                </div>
              </div>
              <div id="incident-detail-${inc.id}" style="display:none"></div>
            </div>
          `;
    }).join('')}
      </div>

      ${result.totalPages > 1 ? `
        <div class="pagination">
          <button class="page-btn" onclick="App._goToIncidentPage(${Math.max(1, _incidentPage - 1)})"><span class="material-symbols-outlined">chevron_left</span></button>
          ${Array.from({ length: result.totalPages }, (_, i) => `
            <button class="page-btn ${i + 1 === _incidentPage ? 'active' : ''}" onclick="App._goToIncidentPage(${i + 1})">${i + 1}</button>
          `).join('')}
          <button class="page-btn" onclick="App._goToIncidentPage(${Math.min(result.totalPages, _incidentPage + 1)})"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
      ` : ''}
    `;
  }

  async function _viewIncidentDetail(incidentId) {
    const detailEl = document.getElementById(`incident-detail-${incidentId}`);
    if (!detailEl) return;

    // Toggle off if already open
    if (detailEl.style.display === 'block') {
      detailEl.style.display = 'none';
      return;
    }

    const incident = await DB.get('incidents', incidentId);
    if (!incident) return;

    const cat = Methodology.getCategoryMeta(incident.category);
    const sev = Methodology.getSeverityMeta(incident.severity);
    const analysis = incident.aiAnalysis;

    detailEl.style.display = 'block';
    detailEl.innerHTML = `
      <div style="padding:0 1.5rem 1.5rem;border-top:1px solid var(--border-light)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem">
          <div>
            <p style="font-size:0.75rem;font-weight:700;color:var(--text-400);text-transform:uppercase;margin-bottom:0.5rem">Incident Details</p>
            <div class="space-y-4" style="font-size:0.875rem">
              <div><span style="color:var(--text-500)">Category:</span> <strong>${cat.label}</strong></div>
              <div><span style="color:var(--text-500)">Severity:</span> <span class="badge ${sev.badge}">${sev.label}</span></div>
              <div><span style="color:var(--text-500)">Status:</span> <span class="badge badge-${incident.status === 'resolved' ? 'info' : 'muted'}">${incident.status}</span></div>
              <div><span style="color:var(--text-500)">Student:</span> ${Utils.escapeHtml(incident.studentName || 'Unknown')}</div>
              <div><span style="color:var(--text-500)">Time:</span> ${Utils.formatDateTime(incident.timestamp)}</div>
              ${incident.description ? `<div><span style="color:var(--text-500)">Description:</span> ${Utils.escapeHtml(incident.description)}</div>` : ''}
              ${incident.context ? `<div><span style="color:var(--text-500)">Context:</span> ${Utils.escapeHtml(incident.context)}</div>` : ''}
            </div>
          </div>
          <div>
            <p style="font-size:0.75rem;font-weight:700;color:var(--text-400);text-transform:uppercase;margin-bottom:0.5rem">Analysis & Response</p>
            ${analysis ? `
              <div class="space-y-4" style="font-size:0.875rem">
                <div><span style="color:var(--text-500)">Recommended:</span> <strong>${Utils.escapeHtml(analysis.recommendedResponse)}</strong></div>
                ${analysis.script ? `<div style="padding:0.75rem;background:var(--text-100);border-radius:var(--radius);font-style:italic;color:var(--text-600)">${Utils.escapeHtml(analysis.script)}</div>` : ''}
                ${analysis.restorative ? `<div><span style="color:var(--text-500)">Restorative:</span> ${Utils.escapeHtml(analysis.restorative)}</div>` : ''}
                ${analysis.preventionTip ? `<div><span style="color:var(--text-500)">Prevention:</span> ${Utils.escapeHtml(analysis.preventionTip)}</div>` : ''}
                <div><span style="color:var(--text-500)">Source:</span> ${analysis.source === 'ai' ? 'AI Analysis' : 'Deterministic Logic'}</div>
                ${analysis.parentEscalation ? '<div><span class="badge badge-warning">Parent Escalation Required</span></div>' : ''}
              </div>
            ` : '<p style="color:var(--text-400);font-size:0.875rem">No analysis available for this incident.</p>'}
          </div>
        </div>
        ${incident.appliedAction ? `
          <div style="margin-top:1rem;padding:0.75rem;background:var(--emerald-bg);border-radius:var(--radius);border:1px solid rgba(16,185,129,0.2)">
            <p style="font-size:0.75rem;font-weight:700;color:var(--emerald);text-transform:uppercase">Action Applied</p>
            <p style="font-size:0.875rem;margin-top:0.25rem">${Utils.escapeHtml(incident.appliedAction.action)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  function _filterIncidents(severity) {
    _incidentFilter = severity;
    _incidentPage = 1;
    navigate('incidents');
  }

  function _goToIncidentPage(page) {
    _incidentPage = page;
    navigate('incidents');
  }

  // ===================== REPORTS VIEW =====================

  async function _renderReports(container) {
    const stats = await Incidents.getStats();
    const total = stats.total || 0;

    // Build category distribution
    const categories = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const distColors = ['var(--primary)', 'var(--amber)', 'var(--rose)', 'var(--text-400)'];

    // Bar chart data (simulated weekly)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const barHeights = [40, 65, 90, 55, 75, 45];
    const barValues = barHeights.map(h => Math.round(h * total / 100) || Math.floor(Math.random() * 50 + 10));

    container.innerHTML = `
      <div class="page-header-row mb-8">
        <div class="page-header">
          <h1 style="font-size:1.875rem">Reports Dashboard</h1>
          <p>Real-time analytics for incident frequency and distribution patterns.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-outline"><span class="material-symbols-outlined" style="font-size:1.125rem">calendar_today</span> Last 30 Days</button>
          <button class="btn btn-primary" onclick="Export.downloadCSV()"><span class="material-symbols-outlined" style="font-size:1.125rem">download</span> Export PDF</button>
        </div>
      </div>

      <div class="grid-3 mb-8">
        <div class="glass stat-card">
          <div class="stat-card-header"><p class="stat-card-label">Total Incidents</p><span class="stat-card-icon" style="background:var(--primary-10);color:var(--primary)"><span class="material-symbols-outlined" style="font-size:1.125rem">error</span></span></div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between">
            <p class="stat-card-value">${total.toLocaleString()}</p>
            <span class="stat-card-trend trend-up"><span class="material-symbols-outlined" style="font-size:0.75rem">trending_up</span> 12.5%</span>
          </div>
        </div>
        <div class="glass stat-card">
          <div class="stat-card-header"><p class="stat-card-label">Active Alerts</p><span class="stat-card-icon" style="background:var(--amber-bg);color:var(--amber)"><span class="material-symbols-outlined" style="font-size:1.125rem">notifications_active</span></span></div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between">
            <p class="stat-card-value">${stats.activeAlerts}</p>
            <span class="stat-card-trend trend-down"><span class="material-symbols-outlined" style="font-size:0.75rem">trending_down</span> 4.2%</span>
          </div>
        </div>
        <div class="glass stat-card">
          <div class="stat-card-header"><p class="stat-card-label">Resolution Rate</p><span class="stat-card-icon" style="background:var(--emerald-bg);color:var(--emerald)"><span class="material-symbols-outlined" style="font-size:1.125rem">check_circle</span></span></div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between">
            <p class="stat-card-value">${stats.resolutionRate}%</p>
            <span class="stat-card-trend trend-up"><span class="material-symbols-outlined" style="font-size:0.75rem">trending_up</span> 2.1%</span>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem" class="mb-8">
        <div class="glass" style="border-radius:var(--radius-xl);padding:2rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
            <h2 style="font-size:1.25rem;font-weight:700">Incident Frequency</h2>
          </div>
          <div class="bar-chart">
            ${barHeights.map((h, i) => `<div class="bar" style="height:${h}%;background:rgba(43,108,238,${0.2 + i * 0.12})"><div class="bar-tooltip">${barValues[i]}</div></div>`).join('')}
          </div>
          <div class="bar-labels" style="margin-top:0.75rem">${days.map(d => `<span>${d}</span>`).join('')}</div>
        </div>
        <div class="glass" style="border-radius:var(--radius-xl);padding:2rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
            <h2 style="font-size:1.25rem;font-weight:700">Category Distribution</h2>
          </div>
          <div class="space-y-6">
            ${categories.length > 0 ? categories.map(([cat, count], i) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const meta = Methodology.getCategoryMeta(cat);
      return `<div class="dist-row"><div class="dist-header"><span>${meta.label}</span><span>${pct}%</span></div><div class="dist-track"><div class="dist-fill" style="width:${pct}%;background:${distColors[i] || 'var(--text-400)'}"></div></div></div>`;
    }).join('') : '<p class="text-muted text-sm">No data yet</p>'}
          </div>
        </div>
      </div>

      <div class="glass" style="border-radius:var(--radius-xl);padding:2rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem">
          <div><h2 style="font-size:1.25rem;font-weight:700">Time-based Patterns</h2><p class="text-muted text-sm">Peak activity periods identified by historical data.</p></div>
          <div style="display:flex;gap:0.5rem">
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0.75rem;border-radius:var(--radius-full);border:1px solid var(--border-light);font-size:0.75rem;font-weight:500"><span style="width:0.5rem;height:0.5rem;border-radius:50%;background:var(--primary)"></span>Predicted</div>
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0.75rem;border-radius:var(--radius-full);border:1px solid var(--border-light);font-size:0.75rem;font-weight:500"><span style="width:0.5rem;height:0.5rem;border-radius:50%;background:var(--text-300)"></span>Actual</div>
          </div>
        </div>
        <div class="chart-container">
          <div class="chart-gradient"></div>
          <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
            <path d="M0,150 Q100,100 200,140 T400,80 T600,120 T800,40 T1000,100" fill="none" stroke="#2b6cee" stroke-width="4" stroke-linecap="round"/>
            <path d="M0,160 Q100,110 200,150 T400,90 T600,130 T800,50 T1000,110" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="8,8"/>
          </svg>
        </div>
        <div class="chart-labels" style="margin-top:1rem">
          <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
        </div>
      </div>
    `;
  }

  // ===================== SETTINGS VIEW =====================

  async function _renderSettings(container) {
    const workerUrl = (await DB.get('preferences', 'workerUrl'))?.value || '';
    const temp = (await DB.get('preferences', 'temperature'))?.value ?? 0.7;
    const model = (await DB.get('preferences', 'aiModel'))?.value || 'deepseek-chat';
    const sysPrompt = (await DB.get('preferences', 'systemPrompt'))?.value || '';
    const anonymize = (await DB.get('preferences', 'dataAnonymization'))?.value ?? true;
    // Refresh student list
    _students = await DB.getAll('students');

    container.innerHTML = `
      <div class="page-header mb-8">
        <h1>Settings</h1>
        <p style="font-size:1.125rem">Manage students, AI configuration, system endpoints, and data preferences.</p>
      </div>

      <div class="space-y-8" style="max-width:56rem;margin:0 auto">

        <!-- Student Management -->
        <section class="settings-section">
          <div class="settings-section-header">
            <span class="material-symbols-outlined text-primary">group</span>
            <h2>Student Management</h2>
          </div>

          <!-- Add Student Form -->
          <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
            <input type="text" class="form-input" id="new-student-name" placeholder="Student name" style="flex:1;min-width:12rem">
            <input type="number" class="form-input" id="new-student-grade" placeholder="Grade" min="1" max="13" style="width:5rem">
            <button class="btn btn-primary" onclick="App._addStudent()" style="white-space:nowrap">
              <span class="material-symbols-outlined" style="font-size:1rem">person_add</span> Add Student
            </button>
          </div>

          <!-- Student List -->
          <div class="space-y-4" id="student-list">
            ${_students.length === 0 ? '<p class="text-muted" style="text-align:center;padding:1rem">No students yet — add one above.</p>' : ''}
            ${_students.map(s => `
              <div class="setting-row" style="align-items:center;gap:1rem" id="student-row-${s.id}">
                <div style="display:flex;align-items:center;gap:0.75rem;flex:1">
                  <div class="avatar-circle" style="width:2.5rem;height:2.5rem;font-size:0.75rem;flex-shrink:0">${Utils.initials(s.name)}</div>
                  <div style="flex:1">
                    <p style="font-weight:600;font-size:0.875rem">${Utils.escapeHtml(s.name)}</p>
                    <p style="font-size:0.75rem;color:var(--text-500)">Grade ${s.grade} · ${s.streak || 0} day streak · ${s.points || 0} points</p>
                  </div>
                </div>
                <div style="display:flex;gap:0.5rem">
                  <button class="icon-btn" title="Edit" onclick="App._editStudentInline('${s.id}')">
                    <span class="material-symbols-outlined" style="font-size:1.125rem">edit</span>
                  </button>
                  <button class="icon-btn" title="Delete" onclick="App._deleteStudent('${s.id}')" style="color:var(--rose)">
                    <span class="material-symbols-outlined" style="font-size:1.125rem">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- AI Configuration -->
        <section class="settings-section">
          <div class="settings-section-header">
            <span class="material-symbols-outlined text-primary">psychology</span>
            <h2>AI Configuration</h2>
          </div>
          <div class="grid-2 gap-6">
            <div class="form-group">
              <label class="form-label">Model Selection</label>
              <select class="form-select" id="settings-model">
                <option value="deepseek-chat" ${model === 'deepseek-chat' ? 'selected' : ''}>DeepSeek Chat (Default)</option>
                <option value="deepseek-coder" ${model === 'deepseek-coder' ? 'selected' : ''}>DeepSeek Coder</option>
                <option value="deepseek-reasoner" ${model === 'deepseek-reasoner' ? 'selected' : ''}>DeepSeek Reasoner</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Temperature</label>
              <div style="display:flex;align-items:center;gap:1rem;height:3rem">
                <input type="range" min="0" max="1" step="0.1" value="${temp}" style="flex:1;accent-color:var(--primary)" id="settings-temp" oninput="document.getElementById('temp-display').textContent=this.value">
                <span id="temp-display" style="font-size:0.875rem;font-family:monospace;background:var(--text-100);padding:0.25rem 0.5rem;border-radius:var(--radius)">${temp}</span>
              </div>
            </div>
            <div class="form-group" style="grid-column:span 2">
              <label class="form-label">System Instruction</label>
              <textarea class="form-textarea" id="settings-prompt" placeholder="You are a helpful assistant specialized in tutoring behavior analysis...">${Utils.escapeHtml(sysPrompt)}</textarea>
            </div>
          </div>
        </section>

        <!-- Worker Endpoint -->
        <section class="settings-section">
          <div class="settings-section-header">
            <span class="material-symbols-outlined text-primary">dns</span>
            <h2>Worker Endpoint</h2>
          </div>
          <div class="form-group mb-6">
            <label class="form-label">Primary API URL</label>
            <div style="display:flex;gap:0.5rem">
              <input type="text" class="form-input" id="settings-worker-url" value="${Utils.escapeHtml(workerUrl)}" placeholder="https://your-worker.your-subdomain.workers.dev/analyze">
              <button class="btn btn-primary" onclick="App._testConnection()" style="white-space:nowrap">Test Connection</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem;border-radius:var(--radius);background:var(--primary-10);border:1px solid var(--primary-20)">
            <div><p style="font-size:0.875rem;font-weight:600">Edge Acceleration</p><p style="font-size:0.75rem;color:var(--text-500)">Route requests through nearest node for low latency.</p></div>
            <label class="toggle"><input type="checkbox" checked><span class="toggle-track"></span></label>
          </div>
        </section>

        <!-- Data Export/Import -->
        <section class="settings-section">
          <div class="settings-section-header">
            <span class="material-symbols-outlined text-primary">database</span>
            <h2>Data Export/Import</h2>
          </div>
          <div class="grid-2">
            <div style="padding:1rem;border-radius:var(--radius);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:0.75rem">
              <p style="font-size:0.875rem;font-weight:600">Export Configuration</p>
              <p style="font-size:0.75rem;color:var(--text-500)">Download a full backup of your current data and settings.</p>
              <button class="btn btn-outline btn-full" onclick="Export.downloadJSON()" style="margin-top:0.5rem"><span class="material-symbols-outlined" style="font-size:1.125rem">download</span> Download .JSON</button>
            </div>
            <div style="padding:1rem;border-radius:var(--radius);border:1px solid var(--border-light);display:flex;flex-direction:column;gap:0.75rem">
              <p style="font-size:0.875rem;font-weight:600">Import Configuration</p>
              <p style="font-size:0.75rem;color:var(--text-500)">Restore your environment from a previously exported file.</p>
              <button class="btn btn-secondary btn-full" onclick="Export.importJSON()" style="margin-top:0.5rem"><span class="material-symbols-outlined" style="font-size:1.125rem">upload</span> Choose File</button>
            </div>
          </div>
        </section>

        <!-- Privacy -->
        <section class="settings-section">
          <div class="settings-section-header">
            <span class="material-symbols-outlined text-primary">lock</span>
            <h2>Privacy &amp; Security</h2>
          </div>
          <div class="space-y-4">
            <div class="setting-row">
              <div class="setting-info"><p>Data Anonymization</p><p>Strip personally identifiable information before sending to AI models.</p></div>
              <label class="toggle"><input type="checkbox" ${anonymize ? 'checked' : ''} id="settings-anonymize"><span class="toggle-track"></span></label>
            </div>
            <div class="hr"></div>
            <div class="setting-row">
              <div class="setting-info"><p>Local Storage Only</p><p>Prevent syncing of sensitive configuration data to the cloud.</p></div>
              <label class="toggle"><input type="checkbox"><span class="toggle-track"></span></label>
            </div>
          </div>
        </section>

        <!-- Save/Discard -->
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:1rem;padding-bottom:3rem">
          <button class="btn" style="color:var(--text-600)" onclick="navigate('settings')">Discard Changes</button>
          <button class="btn btn-primary" onclick="App._saveSettings()">Save All Changes</button>
        </div>
      </div>
    `;
  }

  async function _saveSettings() {
    await DB.put('preferences', { key: 'aiModel', value: document.getElementById('settings-model')?.value || 'deepseek-chat' });
    await DB.put('preferences', { key: 'temperature', value: parseFloat(document.getElementById('settings-temp')?.value || '0.7') });
    await DB.put('preferences', { key: 'systemPrompt', value: document.getElementById('settings-prompt')?.value || '' });
    await DB.put('preferences', { key: 'workerUrl', value: document.getElementById('settings-worker-url')?.value || '' });
    await DB.put('preferences', { key: 'dataAnonymization', value: document.getElementById('settings-anonymize')?.checked ?? true });
    showToast('Settings saved successfully');
  }

  async function _testConnection() {
    const url = document.getElementById('settings-worker-url')?.value;
    if (!url) { showToast('Enter a worker URL first', 'error'); return; }
    await DB.put('preferences', { key: 'workerUrl', value: url });
    const result = await AI.testConnection();
    showToast(result.ok ? 'Connection successful!' : `Connection failed: ${result.error}`, result.ok ? 'success' : 'error');
  }

  function _changeStudentAndRefresh(studentId) {
    _selectedStudent = _students.find(s => s.id === studentId) || _students[0];
    const headerSelect = document.getElementById('student-select');
    if (headerSelect) headerSelect.value = studentId;
    navigate(_page);
  }

  // ===================== STUDENT MANAGEMENT =====================

  async function _addStudent() {
    const nameEl = document.getElementById('new-student-name');
    const gradeEl = document.getElementById('new-student-grade');
    const name = nameEl?.value?.trim();
    const grade = parseInt(gradeEl?.value);
    if (!name) { showToast('Enter a student name', 'error'); return; }
    if (!grade || grade < 1 || grade > 13) { showToast('Enter a valid grade (1–13)', 'error'); return; }

    const student = { id: Utils.generateId(), name, grade, streak: 0, points: 0, createdAt: Utils.now() };
    await DB.add('students', student);
    _students = await DB.getAll('students');
    if (!_selectedStudent) _selectedStudent = student;
    _populateStudentSelector();
    showToast(`${name} added`);
    navigate('settings');
  }

  async function _deleteStudent(studentId) {
    const student = _students.find(s => s.id === studentId);
    if (!student) return;
    const confirmed = confirm(`Delete ${student.name}? This cannot be undone.`);
    if (!confirmed) return;

    await DB.remove('students', studentId);
    _students = await DB.getAll('students');
    if (_selectedStudent?.id === studentId) {
      _selectedStudent = _students[0] || null;
    }
    _populateStudentSelector();
    showToast(`${student.name} removed`);
    navigate('settings');
  }

  async function _editStudentInline(studentId) {
    const row = document.getElementById(`student-row-${studentId}`);
    const student = _students.find(s => s.id === studentId);
    if (!row || !student) return;

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;flex:1;flex-wrap:wrap">
        <input type="text" class="form-input" id="edit-name-${studentId}" value="${Utils.escapeHtml(student.name)}" style="flex:1;min-width:10rem">
        <input type="number" class="form-input" id="edit-grade-${studentId}" value="${student.grade}" min="1" max="13" style="width:5rem">
        <input type="number" class="form-input" id="edit-points-${studentId}" value="${student.points || 0}" min="0" style="width:5rem" placeholder="Points">
      </div>
      <div style="display:flex;gap:0.5rem">
        <button class="btn btn-primary" onclick="App._saveStudentEdit('${studentId}')" style="font-size:0.75rem;padding:0.375rem 0.75rem">Save</button>
        <button class="btn" onclick="App.navigate('settings')" style="font-size:0.75rem;padding:0.375rem 0.75rem;color:var(--text-500)">Cancel</button>
      </div>
    `;
    document.getElementById(`edit-name-${studentId}`)?.focus();
  }

  async function _saveStudentEdit(studentId) {
    const student = _students.find(s => s.id === studentId);
    if (!student) return;
    const name = document.getElementById(`edit-name-${studentId}`)?.value?.trim();
    const grade = parseInt(document.getElementById(`edit-grade-${studentId}`)?.value);
    const points = parseInt(document.getElementById(`edit-points-${studentId}`)?.value) || 0;
    if (!name) { showToast('Name cannot be empty', 'error'); return; }
    if (!grade || grade < 1 || grade > 13) { showToast('Grade must be 1–13', 'error'); return; }

    student.name = name;
    student.grade = grade;
    student.points = points;
    await DB.put('students', student);
    _students = await DB.getAll('students');
    if (_selectedStudent?.id === studentId) _selectedStudent = student;
    _populateStudentSelector();
    showToast(`${name} updated`);
    navigate('settings');
  }

  // Public API
  return {
    init, navigate, currentPage, showToast,
    _quickLog, _openIncidentModal, _closeIncidentModal, _submitIncident,
    _applyAction, _toggleGoal, _addGoal, _removeGoal,
    _filterIncidents, _goToIncidentPage,
    _switchMethodologyTab, _saveMethodology, _resetMethodology,
    _saveSettings, _testConnection,
    _changeStudentAndRefresh, _renderIncidents, _viewIncidentDetail,
    _addStudent, _deleteStudent, _editStudentInline, _saveStudentEdit
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
