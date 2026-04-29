const AppController = (() => {
  let booted = false;
  let hiddenClickCount = 0;
  let hiddenClickTimer = null;
  let hiddenHoldTimer = null;
  let hiddenHoldStart = 0;

  function clearModal() {
    const modal = document.getElementById('cameraModal');
    const preview = document.getElementById('cameraPreview');
    const cardPreview = document.getElementById('cameraCardPreview');
    const downloadBtn = document.getElementById('downloadCardBtn');
    const status = document.getElementById('cameraStatus');
    if (preview) {
      preview.removeAttribute('src');
      preview.classList.remove('hidden');
    }
    if (cardPreview) {
      cardPreview.removeAttribute('src');
      cardPreview.classList.add('hidden');
    }
    if (downloadBtn) downloadBtn.classList.add('hidden');
    if (status) status.textContent = '';
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('screen-flash');
  }

  function showCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.remove('hidden');
  }

  function hideCameraModal() {
    clearModal();
    document.getElementById('app')?.classList.remove('system-override');
    document.getElementById('stage')?.classList.remove('stage-fade');
    document.querySelector('.story-viewport')?.classList.remove('stage-fade');
    window.CameraEgg?.stopCamera?.();
  }

  async function handleCameraGenerate() {
    const status = document.getElementById('cameraStatus');
    const preview = document.getElementById('cameraPreview');
    const cardPreview = document.getElementById('cameraCardPreview');
    const downloadBtn = document.getElementById('downloadCardBtn');
    try {
      status.textContent = '正在连接光学传感器...';
      await window.CameraEgg?.startCamera?.({ videoEl: preview });
      status.textContent = '传感器已激活，正在绘制身份卡...';
      const dataUrl = window.CameraEgg?.buildCard?.({ identityCode: `ID-${String(Date.now()).slice(-6)}` });
      if (preview) preview.classList.add('hidden');
      if (cardPreview) {
        cardPreview.src = dataUrl;
        cardPreview.classList.remove('hidden');
      }
      if (downloadBtn) {
        downloadBtn.dataset.card = dataUrl;
        downloadBtn.classList.remove('hidden');
      }
      status.textContent = '身份卡已生成，可立即下载。';
      window.CameraEgg?.stopCamera?.();
    } catch (error) {
      console.error(error);
      if (preview) preview.classList.add('hidden');
      status.textContent = '摄像头权限被拒绝或不可用，请检查浏览器权限后重试。';
      window.CameraEgg?.stopCamera?.();
    }
  }

  function bindOptionButtons() {
    document.getElementById('optionList')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-to]');
      if (!button || button.disabled) return;
      const to = button.dataset.to;
      const setFlags = button.dataset.setFlags ? JSON.parse(button.dataset.setFlags) : null;
      window.Navigator?.goTo?.(to, setFlags ? { setFlags } : null);
    });
  }

  function applyGlitchBurst() {
    const app = document.getElementById('app');
    if (!app) return;
    app.classList.add('glitching', 'color-split');
    window.setTimeout(() => app.classList.remove('glitching', 'color-split'), 220);
  }

  function applyWhiteFlash() {
    document.body.classList.add('screen-flash');
    window.setTimeout(() => document.body.classList.remove('screen-flash'), 200);
  }

  function resetHiddenEggState() {
    hiddenClickCount = 0;
    if (hiddenClickTimer) clearTimeout(hiddenClickTimer);
    if (hiddenHoldTimer) clearTimeout(hiddenHoldTimer);
    hiddenClickTimer = null;
    hiddenHoldTimer = null;
  }

  function triggerHiddenEgg() {
    resetHiddenEggState();
    applyWhiteFlash();
    document.getElementById('app')?.classList.add('system-override');
    document.getElementById('stage')?.classList.add('stage-fade');
    window.setTimeout(() => {
      window.CameraEgg?.showModal?.();
      showCameraModal();
    }, 90);
  }

  function isOptionClick(target) {
    return !!target?.closest?.('#optionList button');
  }

  function bindHiddenEgg() {
    const zone = document.getElementById('hiddenEggZone');
    if (!zone) return;

    const handleClick = (event) => {
      if (isOptionClick(event.target)) return;
      const bounds = zone.getBoundingClientRect();
      const y = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
      if (y > Math.min(120, bounds.bottom)) return;
      hiddenClickCount += 1;
      applyGlitchBurst();
      if (hiddenClickTimer) clearTimeout(hiddenClickTimer);
      hiddenClickTimer = window.setTimeout(() => {
        hiddenClickCount = 0;
      }, 2000);
      if (hiddenClickCount >= 5) triggerHiddenEgg();
    };

    const handleHoldStart = (event) => {
      if (isOptionClick(event.target)) return;
      const y = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
      if (y > 120) return;
      hiddenHoldStart = performance.now();
      if (hiddenHoldTimer) clearTimeout(hiddenHoldTimer);
      hiddenHoldTimer = window.setTimeout(() => {
        if (performance.now() - hiddenHoldStart >= 3000) triggerHiddenEgg();
      }, 3000);
      applyGlitchBurst();
    };

    const handleHoldEnd = () => {
      if (hiddenHoldTimer) clearTimeout(hiddenHoldTimer);
      hiddenHoldTimer = null;
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('touchstart', handleClick, true);
    document.addEventListener('mousedown', handleHoldStart, true);
    document.addEventListener('touchstart', handleHoldStart, true);
    document.addEventListener('mouseup', handleHoldEnd, true);
    document.addEventListener('touchend', handleHoldEnd, true);
    document.addEventListener('touchcancel', handleHoldEnd, true);
  }

  async function boot() {
    if (booted) return;
    booted = true;

    window.DeviceManager?.init?.();
    window.FxEngine?.init?.();

    const story = await window.StoryRenderer?.boot?.();
    window.Navigator?.init?.(story);
    bindOptionButtons();
    bindHiddenEgg();

    const startNode = story?.meta?.startNode ?? 'node_000';
    window.Navigator?.goTo?.(startNode);

    document.getElementById('cameraCloseBtn')?.addEventListener('click', hideCameraModal);
    document.getElementById('cameraGenerateBtn')?.addEventListener('click', handleCameraGenerate);
    document.getElementById('downloadCardBtn')?.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.card;
      if (url) window.CameraEgg?.downloadCard?.(url);
      hideCameraModal();
    });
  }

  return { boot, showCameraModal, hideCameraModal };
})();

window.AppController = AppController;
