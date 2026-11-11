'use strict';

// Lightweight, local-only error monitor. It never records request headers, bodies,
// API keys, or chat text. Diagnostics are kept in this browser profile only.
(() => {
  const KEY = 'neuroshell:error-log:v1';
  const MAX = 50;
  const safePath = value => {
    try {
      const url = new URL(String(value), location.href);
      return url.origin + url.pathname;
    } catch (_) { return 'unknown'; }
  };
  const save = entry => {
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
      rows.push(Object.assign({ time: new Date().toISOString() }, entry));
      localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX)));
    } catch (_) { /* storage may be unavailable or full */ }
  };

  window.addEventListener('error', event => {
    save({ kind: 'javascript', message: String(event.message || 'script error').slice(0, 240), file: safePath(event.filename), line: Number(event.lineno) || 0 });
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    save({ kind: 'unhandled-rejection', message: String(reason && reason.message || reason || 'unknown').slice(0, 240) });
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url || 'unknown';
    const method = (init && init.method || input && input.method || 'GET').toUpperCase();
    const started = Date.now();
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) save({ kind: 'http', method, url: safePath(url), status: response.status, elapsedMs: Date.now() - started });
      return response;
    } catch (error) {
      save({ kind: 'network', method, url: safePath(url), message: String(error && error.message || error).slice(0, 240), elapsedMs: Date.now() - started });
      throw error;
    }
  };

  window.NS_ERROR_MONITOR = {
    read: () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } },
    clear: () => { try { localStorage.removeItem(KEY); } catch (_) {} }
  };
})();
