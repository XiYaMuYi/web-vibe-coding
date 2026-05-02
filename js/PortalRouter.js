(() => {
  const ROUTES = {
    story: 'story.html',
    bounty: 'bounty-board.html',
    delivery: 'bounty-delivery.html',
    memorial: 'memorial-wall.html',
  };

  function getAppFrame() {
    return document.getElementById('app-frame');
  }

  function navigate(target, params = {}) {
    const frame = getAppFrame();
    if (!frame) return;
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

  window.PortalRouter = { navigate, ROUTES };
})();
