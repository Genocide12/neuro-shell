'use strict';

// Build-injected release version is authoritative for the visible app and bridge.
(() => {
  const version = window.NS_RELEASE_VERSION || '1.4.2';
  document.querySelectorAll('.ns-version').forEach(node => { node.textContent = version; });
  if (window.NeuroShellBridge) window.NeuroShellBridge.version = version;
})();
