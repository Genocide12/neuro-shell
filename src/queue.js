'use strict';

// Queue plain-text messages sent while an answer is generating.
(() => {
  if (window.__NS_MESSAGE_QUEUE__) return;
  window.__NS_MESSAGE_QUEUE__ = true;
  const input = document.getElementById('input');
  const send = document.getElementById('btnSend');
  const stop = document.getElementById('btnStop');
  const actions = document.querySelector('.composer-actions');
  const originalSend = window.sendMessage;
  if (!input || !send || !actions || typeof originalSend !== 'function') return;

  const queue = [];
  let draining = false;
  const badge = document.createElement('span');
  badge.className = 'queue-status hidden';
  badge.setAttribute('aria-live', 'polite');
  actions.insertBefore(badge, send);
  const isGenerating = () => stop && !stop.classList.contains('hidden');
  const updateBadge = () => { badge.textContent = queue.length ? 'В очереди: ' + queue.length : ''; badge.classList.toggle('hidden', !queue.length); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        while (isGenerating()) await wait(150);
        const item = queue.shift();
        input.value = item.text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        updateBadge();
        await originalSend();
      }
    } finally { draining = false; updateBadge(); }
  }

  window.sendMessage = async function queuedSendMessage() {
    if (isGenerating() || draining) {
      const text = input.value.trim();
      if (!text) return;
      queue.push({ text });
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      updateBadge();
      return;
    }
    return originalSend.apply(this, arguments);
  };

  if (stop) new MutationObserver(() => { if (!isGenerating() && queue.length) drain(); })
    .observe(stop, { attributes: true, attributeFilter: ['class'] });
})();
