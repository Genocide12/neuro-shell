'use strict';

// The build injects the exact release version before app scripts execute.
(() => {
  const version = window.NS_RELEASE_VERSION || 'unknown';
  document.querySelectorAll('.ns-version').forEach(node => { node.textContent = version; });
  if (window.NeuroShellBridge) window.NeuroShellBridge.version = version;
})();
