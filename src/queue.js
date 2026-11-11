'use strict';

// Queue plain-text user messages submitted while a response is generating.
(() => {
  if (window.__NS_MESSAGE_QUEUE__) return;
  window.__NS_MESSAGE_QUEUE__ = true;

  const input = document.getElementById('input');
  const send = document.getElementById('btnSend');
  const stop = document.getElementById('btnStop');
  const actions = document.querySelector('.composer-actions');
  if (!input || !send || !actions || typeof window.sendMessage !== 'function') return;

  const originalSend = window.sendMessage;
  const queue = [];
  let draining = false;
  const badge = document.createElement('span');
  badge.className = 'queue-status hidden';
  badge.setAttribute('aria-live', 'polite');
  actions.insertBefore(badge, send);

  function updateBadge() {
    badge.textContent = queue.length ? 'В очереди: ' + queue.length : '';
    badge.classList.toggle('hidden', !queue.length);
  }

  async function submitQueued() {
    if (draining || !queue.length) return;
    draining = true;
    try {
      while (queue.length) {
        // Wait until the app's current request and tool rounds have finished.
        while (stop && !stop.classList.contains('hidden')) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (!queue.length) break;
        const item = queue.shift();
        input.value = item;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateBadge();
        await originalSend();
        while (stop && !stop.classList.contains('hidden')) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
    } finally {
      draining = false;
      updateBadge();
    }
  }

  window.sendMessage = async function queuedSendMessage() {
    if (stop && !stop.classList.contains('hidden')) {
      const text = input.value.trim();
      if (!text) return;
      queue.push(text);
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      updateBadge();
      return;
    }
    return originalSend.apply(this, arguments);
  };

  const observer = new MutationObserver(() => {
    if (queue.length && !stop.classList.contains('hidden')) return;
    if (queue.length) submitQueued();
  });
  if (stop) observer.observe(stop, { attributes: true, attributeFilter: ['class'] });
  updateBadge();
})();
