'use strict';

// Browser-only speech controls: recording and playback start only after a click.
(() => {
  const input = document.getElementById('input');
  const actions = document.querySelector('.composer-actions');
  if (!input || !actions || document.getElementById('btnVoice')) return;

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.id = 'btnVoice';
  mic.className = 'icon-btn voice-btn';
  mic.textContent = '🎙️';
  mic.title = Recognition ? 'Голосовой ввод' : 'Голосовое распознавание не поддерживается';
  mic.setAttribute('aria-label', mic.title);
  mic.disabled = !Recognition;
  const send = document.getElementById('btnSend');
  actions.insertBefore(mic, send || null);

  if (Recognition) {
    const recognition = new Recognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;
    let finalText = '';
    recognition.onstart = () => mic.classList.add('active');
    recognition.onend = () => mic.classList.remove('active');
    recognition.onerror = event => window.toast?.('Голосовой ввод: ' + (event.error || 'ошибка распознавания'), 'warn');
    recognition.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      input.value = [input.value.trim(), finalText, interim].filter(Boolean).join(' ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };
    mic.addEventListener('click', () => {
      if (mic.classList.contains('active')) { recognition.stop(); return; }
      finalText = '';
      try { recognition.start(); }
      catch (error) { window.toast?.('Не удалось запустить микрофон. Проверьте разрешение браузера.', 'warn'); }
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.msg.assistant .msg-actions .voice-speak');
    if (button) return;
    const message = event.target.closest('.msg.assistant');
    if (!message) return;
    const controls = message.querySelector('.msg-actions');
    const content = message.querySelector('.md');
    if (!controls || !content || !content.textContent.trim() || controls.querySelector('.voice-speak')) return;

    const speak = document.createElement('button');
    speak.type = 'button';
    speak.className = 'ma-btn voice-speak';
    speak.textContent = '🔊 Озвучить';
    speak.addEventListener('click', () => {
      if (!window.speechSynthesis) return window.toast?.('Озвучивание не поддерживается', 'warn');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.innerText || content.textContent);
      utterance.lang = 'ru-RU';
      window.speechSynthesis.speak(utterance);
    });
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'ma-btn voice-speak';
    stop.textContent = '■ Остановить речь';
    stop.addEventListener('click', () => window.speechSynthesis?.cancel());
    controls.append(speak, stop);
  });
})();
