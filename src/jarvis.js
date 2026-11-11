'use strict';

// Optional JARVIS enhancements: bottom-pinned scrolling and reliable speech input.
(() => {
  const $ = selector => document.querySelector(selector);
  const scroll = $('#chatScroll');
  const messages = $('#messages');
  const main = $('#main');
  if (!scroll || !messages || !main || window.__NS_JARVIS_INITIALIZED__) return;
  window.__NS_JARVIS_INITIALIZED__ = true;

  let pinnedToBottom = true;
  const isAtBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'btnScrollBottom';
  button.className = 'scroll-bottom hidden';
  button.textContent = '↓ К последним сообщениям';
  const updateButton = () => button.classList.toggle('hidden', isAtBottom());
  const scrollBottom = (behavior = 'smooth') => {
    scroll.scrollTo({ top: scroll.scrollHeight, behavior });
    pinnedToBottom = true;
    updateButton();
  };
  button.addEventListener('click', () => scrollBottom());
  main.appendChild(button);
  scroll.addEventListener('scroll', () => { pinnedToBottom = isAtBottom(); updateButton(); }, { passive: true });
  const observer = new MutationObserver(() => pinnedToBottom ? requestAnimationFrame(() => scrollBottom('auto')) : updateButton());
  observer.observe(messages, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', () => pinnedToBottom ? scrollBottom('auto') : updateButton());

  const input = $('#input');
  const actions = document.querySelector('.composer-actions');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!input || !actions || !Recognition || document.getElementById('btnVoice')) return;

  const mic = document.createElement('button');
  mic.type = 'button'; mic.id = 'btnVoice'; mic.className = 'icon-btn voice-btn'; mic.textContent = '🎙️';
  mic.title = 'Начать голосовой ввод'; mic.setAttribute('aria-label', mic.title);
  actions.insertBefore(mic, document.getElementById('stat'));
  const recognition = new Recognition();
  recognition.lang = 'ru-RU'; recognition.continuous = true; recognition.interimResults = true;
  let listening = false, restarting = false, baseText = '', committedText = '', previousFinals = [], restartTimer = 0;
  const normalize = text => String(text || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
  recognition.onstart = () => { restarting = false; mic.classList.add('active'); mic.title = 'Нажмите, чтобы выключить микрофон'; mic.setAttribute('aria-label', mic.title); };
  recognition.onresult = event => {
    const finals = []; let interim = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i], text = result[0] && result[0].transcript ? result[0].transcript.trim() : '';
      if (!text) continue;
      if (result.isFinal) finals.push(text); else interim = text;
    }
    let overlap = 0;
    for (let size = Math.min(previousFinals.length, finals.length); size > 0; size--) {
      if (previousFinals.slice(-size).map(normalize).join(' ') === finals.slice(0, size).map(normalize).join(' ')) { overlap = size; break; }
    }
    const fresh = finals.slice(overlap);
    if (fresh.length) committedText = [committedText, ...fresh].filter(Boolean).join(' ');
    previousFinals = finals.slice(-8);
    input.value = [baseText, committedText, interim].filter(Boolean).join(' ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  recognition.onerror = event => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { listening = false; window.toast?.('Нет разрешения на микрофон. Проверьте настройки браузера.', 'err'); }
    else if (event.error !== 'aborted' && event.error !== 'no-speech') window.toast?.('Ошибка распознавания речи: ' + event.error, 'warn');
  };
  recognition.onend = () => {
    if (!listening) { mic.classList.remove('active'); mic.title = 'Начать голосовой ввод'; mic.setAttribute('aria-label', mic.title); restarting = false; return; }
    if (restarting) return;
    restarting = true;
    restartTimer = window.setTimeout(() => {
      restarting = false;
      if (!listening) return;
      try { recognition.start(); }
      catch (_) { restartTimer = window.setTimeout(() => { if (listening) { restarting = false; try { recognition.start(); } catch (_) {} } }, 300); }
    }, 180);
  };
  mic.addEventListener('click', () => {
    if (listening) { listening = false; clearTimeout(restartTimer); restarting = false; recognition.stop(); return; }
    baseText = input.value.trim(); committedText = ''; previousFinals = []; listening = true;
    try { recognition.start(); } catch (error) { listening = false; window.toast?.('Не удалось запустить микрофон: ' + error.message, 'err'); }
  });
})();
