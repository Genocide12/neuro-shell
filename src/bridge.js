/* ===== NeuroShell desktop bridge ===== */
(function(){
  var BRIDGE = null;
  function activate(){
    if (BRIDGE) return;
    BRIDGE = window.NeuroShellBridge = {
      desktop: true,
      version: window.NS_RELEASE_VERSION || window.NS_APP_VERSION || 'unknown',
      exit: function(){ try { location.href = '/__ns/exit'; } catch(e){ window.close(); } }
    };
    var orig = window.fetch.bind(window);
    window.fetch = function(url, opts){
      url = String(url);
      var sameOrigin = url.indexOf('/') === 0 || url.indexOf(location.origin) === 0 || url.indexOf('http://127.0.0.1:' + location.port) === 0;
      if (sameOrigin) return orig(url, opts);
      var o = Object.assign({}, opts || {});
      if (o.headers){
        var h = {};
        if (o.headers instanceof Headers) o.headers.forEach(function(v,k){ h[k]=v; }); else Object.assign(h,o.headers);
        var auth=h['Authorization']||h['authorization'];
        if (auth){ delete h['Authorization']; delete h['authorization']; h['X-NS-Authorization']=auth; }
        o.headers=h;
      }
      return orig('/__ns/proxy?url='+encodeURIComponent(url),o);
    };
    try {
      var badge=document.getElementById('modeBadge'); if(badge) badge.textContent='настольная версия';
      var exitBtn=document.getElementById('btnExit'); if(exitBtn) exitBtn.classList.remove('hidden');
      document.querySelectorAll('.ns-version').forEach(function(node){node.textContent=BRIDGE.version;});
    } catch(e){}
    try { window.dispatchEvent(new CustomEvent('nsbridge')); if(typeof window.NS_BRIDGE_READY==='function') window.NS_BRIDGE_READY(); } catch(e){}
    setInterval(function(){ try{orig('/__ns/ping').catch(function(){});}catch(e){} },3000);
  }
  fetch('/__ns/ping').then(function(r){if(r.ok)return r.text();throw new Error('not desktop');}).then(function(t){if(t==='pong')activate();}).catch(function(){});
})();
