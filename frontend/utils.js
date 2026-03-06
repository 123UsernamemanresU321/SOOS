/* ============================================================
   SESSION ORDER OS — Utility Helpers
   ============================================================ */

const Utils = (() => {
  /** Generate a UUID v4 */
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /** ISO timestamp */
  function now() {
    return new Date().toISOString();
  }

  /** Format date to readable string: "Oct 24, 2023 • 14:30:05" */
  function formatDateTime(iso) {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    const time = d.toTimeString().slice(0, 8);
    return `${month} ${day}, ${year} • ${time}`;
  }

  /** Format date only: "Oct 24, 2023" */
  function formatDate(iso) {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /** Format seconds to MM:SS */
  function formatTimer(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Debounce function */
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  /** Throttle function */
  function throttle(fn, ms = 300) {
    let last = 0;
    return (...args) => {
      const t = Date.now();
      if (t - last >= ms) { last = t; fn(...args); }
    };
  }

  /** Get grade band from grade number (1-13) */
  function getGradeBand(grade) {
    if (grade <= 2) return 'A';
    if (grade <= 5) return 'B';
    if (grade <= 8) return 'C';
    if (grade <= 10) return 'D';
    return 'E';
  }

  /** Get grade band label */
  function getGradeBandLabel(band) {
    const labels = { A: 'Grades 1–2', B: 'Grades 3–5', C: 'Grades 6–8', D: 'Grades 9–10', E: 'Grades 11–13' };
    return labels[band] || band;
  }

  /** Escape HTML */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Simple deep clone */
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Get initials from name */
  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  /** Days between two dates */
  function daysBetween(a, b) {
    const msPerDay = 86400000;
    return Math.floor(Math.abs(new Date(a) - new Date(b)) / msPerDay);
  }

  return {
    generateId, now, formatDateTime, formatDate, formatTimer,
    debounce, throttle, getGradeBand, getGradeBandLabel,
    escapeHtml, clone, initials, daysBetween
  };
})();
