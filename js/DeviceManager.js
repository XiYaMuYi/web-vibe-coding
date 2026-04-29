const DeviceManager = (() => {
  const state = {
    forcedMode: null,
    isDesktop: false,
    listenersBound: false,
  };

  function getMode() {
    if (state.forcedMode) return state.forcedMode;
    return window.innerWidth >= 768 ? 'desktop' : 'mobile';
  }

  function applyMode(mode) {
    const body = document.body;
    if (!body) return;
    body.classList.remove('desktop-mode', 'mobile-mode');
    body.classList.add(`${mode}-mode`);
    const toggle = document.getElementById('deviceToggle');
    if (toggle) {
      toggle.classList.toggle('is-desktop', mode === 'desktop');
      toggle.classList.toggle('is-mobile', mode === 'mobile');
      toggle.setAttribute('aria-label', mode === 'desktop' ? '切换到移动端模式' : '切换到桌面端模式');
      toggle.title = mode === 'desktop' ? '切换到移动端模式' : '切换到桌面端模式';
    }
    state.isDesktop = mode === 'desktop';
  }

  function syncMode() {
    applyMode(getMode());
  }

  function setForcedMode(mode = null) {
    state.forcedMode = mode;
    syncMode();
  }

  function toggleMode() {
    state.forcedMode = getMode() === 'desktop' ? 'mobile' : 'desktop';
    syncMode();
  }

  function bind() {
    if (state.listenersBound) return;
    state.listenersBound = true;
    window.addEventListener('resize', syncMode, { passive: true });
    window.matchMedia?.('(min-width: 768px)')?.addEventListener?.('change', syncMode);
    syncMode();
  }

  function mountToggle() {
    if (document.getElementById('deviceToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'deviceToggle';
    btn.className = 'device-toggle is-mobile';
    btn.type = 'button';
    btn.innerHTML = `
      <svg data-icon="mobile" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="12" cy="18.4" r="0.9" fill="currentColor"/>
      </svg>
      <svg data-icon="desktop" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="1.8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
    btn.addEventListener('click', toggleMode);
    document.body.appendChild(btn);
    syncMode();
  }

  function init() {
    mountToggle();
    bind();
    syncMode();
  }

  return { init, bind, syncMode, toggleMode, setForcedMode, getMode };
})();

window.DeviceManager = DeviceManager;
