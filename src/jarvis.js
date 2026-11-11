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
  scroll.addEventListener('scroll', () => {
    pinnedToBottom = isAtBottom();
    updateButton();
  }, { passive: true });
  const observer = new MutationObserver(() => {
    if (pinnedToBottom) requestAnimationFrame(() => scrollBottom('auto'));
    else updateButton();
  });
  observer.observe(messages, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', () => pinnedToBottom ? scrollBottom('auto') : updateButton());

  const input = $('#input');
  const actions = document.querySelector('.composer-actions');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!input || !actions || !Recognition || document.getElementById('btnVoice')) return;

  const mic = document.createElement('button');
  mic.type = 'button';
  mic.id = 'btnVoice';
  mic.className = 'icon-btn voice-btn';
  mic.textContent = '🎙️';
  mic.title = 'Начать голосовой ввод';
  mic.setAttribute('aria-label', mic.title);
  actions.insertBefore(mic, document.getElementById('stat'));

  const recognition = new Recognition();
  recognition.lang = 'ru-RU';
  recognition.continuous = true;
  recognition.interimResults = true;
  let listening = false;
  let restarting = false;
  let baseText = '';
  let restartTimer = 0;

  const transcriptNow = () => {
    const finalParts = [];
    let interim = '';
    for (let i = 0; i < recognition.results.length; i++) {
      const result = recognition.results[i];
      const text = result[0] && result[0].transcript ? result[0].transcript.trim() : '';
      if (!text) continue;
      if (result.isFinal) finalParts.push(text);
      else interim = text;
    }
    return { final: finalParts.join(' '), interim };
  };
  const renderTranscript = () => {
    const result = transcriptNow();
    input.value = [baseText, result.final, result.interim].filter(Boolean).join(' ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  recognition.onstart = () => {
    restarting = false;
    mic.classList.add('active');
    mic.title = 'Нажмите, чтобы выключить микрофон';
    mic.setAttribute('aria-label', mic.title);
  };
  recognition.onresult = renderTranscript;
  recognition.onerror = event => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      listening = false;
      window.toast?.('Нет разрешения на микрофон. Проверьте настройки браузера.', 'err');
    } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
      window.toast?.('Ошибка распознавания речи: ' + event.error, 'warn');
    }
  };
  recognition.onend = () => {
    if (!listening) {
      mic.classList.remove('active');
      mic.title = 'Начать голосовой ввод';
      mic.setAttribute('aria-label', mic.title);
      restarting = false;
      return;
    }
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
    if (listening) {
      listening = false;
      clearTimeout(restartTimer);
      restarting = false;
      recognition.stop();
      return;
    }
    baseText = input.value.trim();
    listening = true;
    try { recognition.start(); }
    catch (error) {
      listening = false;
      window.toast?.('Не удалось запустить микрофон: ' + error.message, 'err');
    }
  });
})();
