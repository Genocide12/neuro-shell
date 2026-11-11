'use strict';

// Queue plain-text messages submitted while a response is generating.
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
  let currentPromise = null;
  const badge = document.createElement('span');
  badge.className = 'queue-status hidden';
  badge.setAttribute('aria-live', 'polite');
  actions.insertBefore(badge, send);
  const isGenerating = () => stop && !stop.classList.contains('hidden');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const update = () => { badge.textContent = queue.length ? 'В очереди: ' + queue.length : ''; badge.classList.toggle('hidden', !queue.length); };

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (queue.length) {
        while (isGenerating()) await wait(100);
        const item = queue.shift();
        update();
        input.value = item.text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        currentPromise = Promise.resolve(originalSend());
        await currentPromise;
        currentPromise = null;
      }
    } finally { currentPromise = null; draining = false; update(); }
  }

  window.sendMessage = async function queuedSendMessage() {
    const text = input.value.trim();
    if (!text) return originalSend.apply(this, arguments);
    if (isGenerating() || draining) {
      queue.push({ text });
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      update();
      return;
    }
    currentPromise = Promise.resolve(originalSend.apply(this, arguments));
    try { return await currentPromise; }
    finally { currentPromise = null; if (queue.length) drain(); }
  };

  if (stop) new MutationObserver(() => { if (!isGenerating() && queue.length) drain(); })
    .observe(stop, { attributes: true, attributeFilter: ['class'] });
})();
