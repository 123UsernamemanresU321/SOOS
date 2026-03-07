/* ============================================================
   SESSION ORDER OS — Export / Import System
   ============================================================ */

const Export = (() => {

  /** Export all data as a JSON file download */
  async function downloadJSON() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-order-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.showToast('Data exported successfully');
  }

  /** Import data from a JSON file */
  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const validation = Validate.validateImportData(data);

        if (!validation.valid) {
          App.showToast('Invalid import file: ' + validation.errors.join(', '), 'error');
          return;
        }

        await DB.importAll(data);
        App.showToast('Data imported successfully');
        // Refresh current view
        App.navigate(App.currentPage());
      } catch (err) {
        App.showToast('Import failed: ' + err.message, 'error');
      }
    };
    input.click();
  }

  /** Export incidents report as CSV */
  async function downloadCSV(incidents) {
    const data = incidents || await Incidents.getAll();
    if (data.length === 0) {
      App.showToast('No incidents to export');
      return;
    }

    const headers = ['ID', 'Student', 'Category', 'Severity', 'Description', 'Status', 'Timestamp', 'Applied Action'];
    const rows = data.map(i => [
      i.id,
      i.studentName || '',
      i.category,
      i.severity,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.status,
      i.timestamp,
      i.appliedAction?.action || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.showToast('CSV report exported');
  }

  /** Export incidents report as PDF */
  async function downloadPDF(incidents, title) {
    const data = incidents || await Incidents.getAll();
    if (data.length === 0) {
      App.showToast('No incidents to export');
      return;
    }

    const reportTitle = title || 'Incident Report';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build HTML for the PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${_esc(reportTitle)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; padding: 32px; }
  .report-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #2b6cee; padding-bottom: 12px; margin-bottom: 24px; }
  .report-header h1 { font-size: 22px; font-weight: 900; color: #0f172a; }
  .report-header .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
  .report-header .date { font-size: 11px; color: #64748b; text-align: right; }
  .summary-row { display: flex; gap: 16px; margin-bottom: 20px; }
  .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #2b6cee; }
  .summary-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #2b6cee; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .sev-1 { color: #10b981; font-weight: 700; }
  .sev-2 { color: #f59e0b; font-weight: 700; }
  .sev-3 { color: #f43f5e; font-weight: 700; }
  .sev-4 { color: #dc2626; font-weight: 700; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1>${_esc(reportTitle)}</h1>
      <div class="subtitle">Session Order OS — Behavioral Incident Report</div>
    </div>
    <div class="date">Generated: ${dateStr}</div>
  </div>

  <div class="summary-row">
    <div class="summary-card">
      <div class="value">${data.length}</div>
      <div class="label">Total Incidents</div>
    </div>
    <div class="summary-card">
      <div class="value">${data.filter(i => i.severity >= 3).length}</div>
      <div class="label">Major/Critical</div>
    </div>
    <div class="summary-card">
      <div class="value">${data.filter(i => i.status === 'resolved').length}</div>
      <div class="label">Resolved</div>
    </div>
    <div class="summary-card">
      <div class="value">${_uniqueStudents(data)}</div>
      <div class="label">Students Involved</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Time</th>
        <th>Student</th>
        <th>Category</th>
        <th>Severity</th>
        <th>Description</th>
        <th>Action</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.map((inc, idx) => {
      const sevLabels = { 1: 'Minor', 2: 'Moderate', 3: 'Major', 4: 'Critical' };
      const cat = Methodology.getCategoryMeta(inc.category);
      return `<tr>
          <td>${idx + 1}</td>
          <td>${Utils.formatDateTime(inc.timestamp)}</td>
          <td>${_esc(inc.studentName || 'Unknown')}</td>
          <td>${_esc(cat.label)}</td>
          <td><span class="sev-${inc.severity}">${sevLabels[inc.severity] || inc.severity}</span></td>
          <td>${_esc(inc.description || '—')}</td>
          <td>${_esc(inc.appliedAction?.action || '—')}</td>
          <td>${_esc(inc.status)}</td>
        </tr>`;
    }).join('')}
    </tbody>
  </table>

  <div class="footer">
    Session Order OS &bull; Confidential &bull; ${dateStr}
  </div>
</body>
</html>`;

    // Use hidden iframe to avoid popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 400);
    };
    App.showToast('Generating PDF — use Print dialog to save');
  }

  /** Export session summary as PDF */
  async function downloadSessionPDF(session, incidents) {
    if (!session) {
      App.showToast('No session data to export');
      return;
    }
    const title = `Session Report — ${session.studentName || 'Unknown Student'}`;
    const duration = session.duration ? Utils.formatTimer(session.duration) : '—';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const goalsHtml = (session.goals || []).length > 0 ? `
          <div style="margin-top:16px">
            <h3 style="font-size:12px;font-weight:700;margin-bottom:8px;color:#2b6cee">Session Goals</h3>
            <ul style="list-style:none;padding:0">
              ${session.goals.map(g => `
                <li style="padding:4px 0;font-size:11px">
                  ${g.completed ? '✅' : '⬜'} ${_esc(g.text)}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : '';

    const incidentsTable = incidents.length > 0 ? `
          <table>
            <thead>
              <tr><th>#</th><th>Time</th><th>Category</th><th>Severity</th><th>Description</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${incidents.map((inc, idx) => {
      const sevLabels = { 1: 'Minor', 2: 'Moderate', 3: 'Major', 4: 'Critical' };
      const cat = Methodology.getCategoryMeta(inc.category);
      return `<tr>
                  <td>${idx + 1}</td>
                  <td>${Utils.formatDateTime(inc.timestamp)}</td>
                  <td>${_esc(cat.label)}</td>
                  <td><span class="sev-${inc.severity}">${sevLabels[inc.severity] || inc.severity}</span></td>
                  <td>${_esc(inc.description || '—')}</td>
                  <td>${_esc(inc.appliedAction?.action || '—')}</td>
                </tr>`;
    }).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#64748b;font-style:italic;margin-top:12px">No incidents during this session 🎉</p>';

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${_esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; padding: 32px; }
  .report-header { border-bottom: 3px solid #2b6cee; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .report-header h1 { font-size: 22px; font-weight: 900; color: #0f172a; }
  .report-header .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
  .report-header .date { font-size: 11px; color: #64748b; }
  .summary-row { display: flex; gap: 16px; margin-bottom: 20px; }
  .summary-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #2b6cee; }
  .summary-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #2b6cee; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .sev-1 { color: #10b981; font-weight: 700; }
  .sev-2 { color: #f59e0b; font-weight: 700; }
  .sev-3 { color: #f43f5e; font-weight: 700; }
  .sev-4 { color: #dc2626; font-weight: 700; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="report-header">
    <div>
      <h1>Session Report</h1>
      <div class="subtitle">${_esc(session.studentName)} — Grade ${session.studentGrade || '?'}</div>
    </div>
    <div class="date">
      ${Utils.formatDateTime(session.startTime)}<br>
      Duration: ${duration}
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-card">
      <div class="value">${duration}</div>
      <div class="label">Duration</div>
    </div>
    <div class="summary-card">
      <div class="value">${incidents.length}</div>
      <div class="label">Incidents</div>
    </div>
    <div class="summary-card">
      <div class="value">${incidents.filter(i => i.severity >= 3).length}</div>
      <div class="label">Major/Critical</div>
    </div>
    <div class="summary-card">
      <div class="value">${session.sessionState || 'stable'}</div>
      <div class="label">Final State</div>
    </div>
  </div>

  ${goalsHtml}

  <h3 style="font-size:12px;font-weight:700;margin:16px 0 4px;color:#2b6cee">Incidents During Session</h3>
  ${incidentsTable}

  <div class="footer">
    Session Order OS &bull; Confidential &bull; ${dateStr}
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 400);
    };
    App.showToast('Generating Session PDF — use Print dialog to save');
  }

  // Helpers
  function _esc(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _uniqueStudents(incidents) {
    return new Set(incidents.map(i => i.studentName || i.studentId || 'unknown')).size;
  }

  return { downloadJSON, importJSON, downloadCSV, downloadPDF, downloadSessionPDF };
})();
