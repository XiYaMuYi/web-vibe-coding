(() => {
  const ROUTES = {
    story: 'story.html',
    bounty: 'bounty-board.html',
    delivery: 'bounty-delivery.html',
    memorial: 'memorial-wall.html',
    auction: 'auction-board.html',
    truth: 'truth-branding.html',
    wall: 'wall-test.html',
  };

  // 受保护的路由（完成序章前不可访问）
  const PROTECTED_ROUTES = ['bounty', 'delivery', 'memorial', 'auction', 'truth', 'wall'];

  const STORAGE_KEY = 'stardust_user_state';

  function getAppFrame() {
    return document.getElementById('app-frame');
  }

  // ---- 访问控制 ----

  function getUserState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function isStoryCompleted() {
    return !!getUserState().isStoryCompleted;
  }

  function checkAccess(target) {
    if (!PROTECTED_ROUTES.includes(target)) return { allowed: true };
    if (isStoryCompleted()) return { allowed: true };
    return { allowed: false, reason: '需完成序章记忆' };
  }

  function unlockSystem() {
    const state = getUserState();
    state.isStoryCompleted = true;
    state.unlockedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('STARDUST_SYSTEM_UNLOCKED', { detail: state }));
  }

  // ---- 导航 ----

  function navigate(target, params = {}) {
    const frame = getAppFrame();
    if (!frame) return;

    const access = checkAccess(target);
    if (!access.allowed) {
      window.dispatchEvent(new CustomEvent('PORTAL_NAVIGATE_BLOCKED', {
        detail: { target, reason: access.reason },
      }));
      return;
    }

    const route = ROUTES[target] || target;
    const url = new URL(route, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    frame.style.display = 'block';
    frame.src = url.toString();
    window.dispatchEvent(new CustomEvent('PORTAL_NAVIGATE', { detail: { target: route, url: url.toString() } }));
  }

  window.PortalRouter = { navigate, ROUTES, checkAccess, unlockSystem, isStoryCompleted, getUserState };
})();
