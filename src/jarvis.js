'use strict';

// Optional JARVIS 2.0 enhancements: voice input, speech output and chat autoscroll.
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const scroll = $('#chatScroll');
  const messages = $('#messages');
  if (!scroll || !messages) return;

  let pinnedToBottom = true;
  let recognition = null;
  let userStopped = false;
  let scrollButton;

  const isAtBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;
  const updateScrollButton = () => {
    if (!scrollButton) return;
    scrollButton.classList.toggle('hidden', isAtBottom());
  };
  const scrollToBottom = (behavior = 'smooth') => {
    scroll.scrollTo({ top: scroll.scrollHeight, behavior });
    pinnedToBottom = true;
    updateScrollButton();
  };

  scrollButton = document.createElement('button');
  scrollButton.type = 'button';
  scrollButton.id = 'btnScrollBottom';
  scrollButton.className = 'scroll-bottom hidden';
  scrollButton.textContent = '↓ К последним сообщениям';
  scrollButton.addEventListener('click', () => scrollToBottom());
  $('#main').appendChild(scrollButton);

  scroll.addEventListener('scroll', () => {
    pinnedToBottom = isAtBottom();
    updateScrollButton();
  }, { passive: true });

  const observer = new MutationObserver(() => {
    if (pinnedToBottom) requestAnimationFrame(() => scrollToBottom('auto'));
    else updateScrollButton();
  });
  observer.observe(messages, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', () => {
    if (pinnedToBottom) scrollToBottom('auto');
    else updateScrollButton();
  });

  const input = $('#input');
  const voiceButton = document.createElement('button');
  voiceButton.type = 'button';
  voiceButton.id = 'btnVoice';
  voiceButton.className = 'icon-btn voice-btn';
  voiceButton.title = 'Голосовой ввод';
  voiceButton.setAttribute('aria-label', 'Начать голосовой ввод');
  voiceButton.textContent = '🎙️';
  const actions = $('.composer-actions');
  if (actions && input) actions.insertBefore(voiceButton, $('#stat', actions));

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    voiceButton.title = 'Голосовое распознавание не поддерживается этим браузером';
    voiceButton.addEventListener('click', () => window.toast?.('Голосовой ввод не поддерживается этим браузером', 'warn'));
  } else {
    recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';
    let finalTranscript = '';
    recognition.onstart = () => {
      voiceButton.classList.add('active');
      voiceButton.setAttribute('aria-label', 'Остановить голосовой ввод');
      voiceButton.title = 'Нажмите, чтобы остановить';
    };
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += text;
        else interim += text;
      }
      input.value = [input.value.trim(), finalTranscript, interim].filter(Boolean).join(' ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    recognition.onerror = event => {
      if (event.error !== 'aborted') window.toast?.('Ошибка распознавания речи: ' + event.error, 'err');
    };
    recognition.onend = () => {
      voiceButton.classList.remove('active');
      voiceButton.setAttribute('aria-label', 'Начать голосовой ввод');
      voiceButton.title = 'Голосовой ввод';
      if (!userStopped && finalTranscript.trim()) input?.focus();
      finalTranscript = '';
      userStopped = false;
    };
    voiceButton.addEventListener('click', () => {
      if (voiceButton.classList.contains('active')) {
        userStopped = true;
        recognition.stop();
        return;
      }
      finalTranscript = '';
      try { recognition.start(); }
      catch (error) { window.toast?.('Не удалось запустить микрофон: ' + error.message, 'err'); }
    });
  }

  // Speech synthesis is user-triggered to avoid unexpected audio and privacy surprises.
  const addSpeakButton = message => {
    if (message.dataset.speechActionsAdded) return;
    const bubble = $('.bubble', message);
    const content = $('.md', message);
    const controls = $('.msg-actions', message);
    if (!bubble || !content || !controls || !content.textContent.trim()) return;
    message.dataset.speechActionsAdded = '1';
    const speak = document.createElement('button');
    speak.type = 'button';
    speak.className = 'ma-btn';
    speak.textContent = '🔊 Озвучить';
    speak.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) return window.toast?.('Озвучивание не поддерживается', 'warn');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.innerText || content.textContent);
      utterance.lang = 'ru-RU';
      window.speechSynthesis.speak(utterance);
    });
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'ma-btn';
    stop.textContent = '■ Остановить речь';
    stop.addEventListener('click', () => window.speechSynthesis?.cancel());
    controls.append(speak, stop);
  };
  const speechObserver = new MutationObserver(() => {
    document.querySelectorAll('#messages .msg.assistant').forEach(addSpeakButton);
  });
  speechObserver.observe(messages, { childList: true, subtree: true, characterData: true });
  document.querySelectorAll('#messages .msg.assistant').forEach(addSpeakButton);
})();
