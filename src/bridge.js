/* ===== NeuroShell :: мост десктоп-версии =====
   В веб-режиме (GitHub Pages) пинг /__ns/ping возвращает 404 — мост не активируется,
   всё работает напрямую. В exe-версии локальный сервер отвечает "pong": мост
   активируется, внешние API-запросы идут через /__ns/proxy (CORS не важен). */
(function(){
  var BRIDGE = null;

  function activate(){
    if (BRIDGE) return;
    BRIDGE = window.NeuroShellBridge = {
      desktop: true,
      version: window.NS_APP_VERSION || '1.1.0',
      exit: function(){ try { location.href = '/__ns/exit'; } catch(e){ window.close(); } }
    };

    // перехватываем fetch: внешние URL → через локальный прокси
    var orig = window.fetch.bind(window);
    window.fetch = function(url, opts){
      url = String(url);
      var sameOrigin = url.indexOf('/') === 0
        || url.indexOf(location.origin) === 0
        || url.indexOf('http://127.0.0.1:' + location.port) === 0;
      if (sameOrigin) return orig(url, opts);

      var o = Object.assign({}, opts || {});
      if (o.headers){
        var h = {};
        if (o.headers instanceof Headers) o.headers.forEach(function(v, k){ h[k] = v; });
        else Object.assign(h, o.headers);
        var auth = h['Authorization'] || h['authorization'];
        if (auth){
          delete h['Authorization']; delete h['authorization'];
          h['X-NS-Authorization'] = auth;
        }
        o.headers = h;
      }
      return orig('/__ns/proxy?url=' + encodeURIComponent(url), o);
    };

    // индикация режима
    try {
      var badge = document.getElementById('modeBadge');
      if (badge) badge.textContent = 'настольная версия';
      var exitBtn = document.getElementById('btnExit');
      if (exitBtn) exitBtn.classList.remove('hidden');
    } catch(e){}

    // сердцебиение: сервер завершит процесс, когда вкладка закроется
    setInterval(function(){
      try { orig('/__ns/ping').catch(function(){}); } catch(e){}
    }, 3000);
  }

  function detect(){
    fetch('/__ns/ping').then(function(r){
      if (r.ok) return r.text();
      throw new Error('not desktop');
    }).then(function(t){
      if (t === 'pong') activate();
    }).catch(function(){ /* веб-режим */ });
  }
  detect();
})();
