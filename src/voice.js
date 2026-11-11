/* ===== NeuroShell :: optional voice controls =====
   This module is intentionally isolated. The app must include it from its
   page build before the controls become active.
*/
(function(){
  'use strict';

  function initVoiceControls(){
    var input = document.getElementById('input');
    var actions = document.querySelector('.composer-actions');
    if (!input || !actions || document.getElementById('btnVoice')) return;

    var recognition = null;
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var mic = document.createElement('button');
    mic.type = 'button';
    mic.id = 'btnVoice';
    mic.className = 'icon-btn voice-btn';
    mic.textContent = '🎙️';
    mic.title = Recognition ? 'Голосовой ввод' : 'Голосовое распознавание не поддерживается';
    mic.setAttribute('aria-label', mic.title);
    mic.disabled = !Recognition;

    var speak = document.createElement('button');
    speak.type = 'button';
    speak.id = 'btnSpeakLast';
    speak.className = 'icon-btn';
    speak.textContent = '🔊';
    speak.title = 'Озвучить последний ответ';
    speak.setAttribute('aria-label', speak.title);

    var send = document.getElementById('btnSend');
    actions.insertBefore(mic, send || null);
    actions.insertBefore(speak, send || null);

    if (Recognition){
      recognition = new Recognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = function(){ mic.classList.add('recording'); mic.title = 'Остановить запись'; };
      recognition.onend = function(){ mic.classList.remove('recording'); mic.title = 'Голосовой ввод'; };
      recognition.onerror = function(event){
        mic.classList.remove('recording');
        if (typeof window.toast === 'function') window.toast('Голосовой ввод: ' + (event.error || 'ошибка распознавания'), 'warn');
      };
      recognition.onresult = function(event){
        var transcript = '';
        for (var i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        input.value = transcript;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      };
      mic.addEventListener('click', function(){
        try {
          if (mic.classList.contains('recording')) recognition.stop();
          else recognition.start();
        } catch (err) {
          if (typeof window.toast === 'function') window.toast('Не удалось запустить микрофон. Проверьте разрешение браузера.', 'warn');
        }
      });
    }

    speak.addEventListener('click', function(){
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance){
        if (typeof window.toast === 'function') window.toast('Озвучивание не поддерживается этим браузером.', 'warn');
        return;
      }
      var messages = document.querySelectorAll('.msg.assistant .md');
      var last = messages.length ? messages[messages.length - 1] : null;
      var text = last ? last.innerText.trim() : '';
      if (!text) return;
      window.speechSynthesis.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      window.speechSynthesis.speak(utterance);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initVoiceControls);
  else initVoiceControls();
})();
