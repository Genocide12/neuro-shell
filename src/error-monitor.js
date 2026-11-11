'use strict';

// Local diagnostics only: never store credentials, headers, request bodies, or chat text.
(() => {
  const KEY = 'neuroshell:error-log:v1';
  const MAX_ENTRIES = 50;
  const safeUrl = value => {
    try { const u = new URL(String(value), location.href); return u.origin + u.pathname; }
    catch (_) { return 'unknown'; }
  };
  const record = event => {
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
      rows.push(Object.assign({ time: new Date().toISOString() }, event));
      localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX_ENTRIES)));
    } catch (_) {}
  };
  window.addEventListener('error', e => record({ kind: 'javascript', message: String(e.message || 'script error').slice(0, 200), file: safeUrl(e.filename), line: Number(e.lineno) || 0 }));
  window.addEventListener('unhandledrejection', e => record({ kind: 'unhandled-rejection', message: String(e.reason && e.reason.message || e.reason || 'unknown').slice(0, 200) }));

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url || 'unknown';
    const method = String(init && init.method || input && input.method || 'GET').toUpperCase();
    const started = Date.now();
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) record({ kind: 'http', method, url: safeUrl(url), status: response.status, elapsedMs: Date.now() - started });
      return response;
    } catch (error) {
      record({ kind: 'network', method, url: safeUrl(url), message: String(error && error.message || error).slice(0, 200), elapsedMs: Date.now() - started });
      throw error;
    }
  };

  window.NS_ERROR_MONITOR = {
    read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } },
    clear() { try { localStorage.removeItem(KEY); } catch (_) {} }
  };
})();
