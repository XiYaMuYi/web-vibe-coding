const Debugger = (() => {
  const state = {
    enabled: false,
    keyBound: false,
    observer: null,
    host: null,
    debounceTimer: null,
  };

  function getStory() {
    try {
      return window.StoryRenderer?.getStory?.() ?? null;
    } catch (error) {
      console.warn('[Debugger] getStory failed', error);
      return null;
    }
  }

  function getNode() {
    try {
      const story = getStory();
      const id = window.Navigator?.currentNodeId || window.StoryRenderer?.getCurrentNodeId?.() || story?.meta?.startNode || 'node_000';
      return story?.nodes?.[id] ?? null;
    } catch (error) {
      console.warn('[Debugger] getNode failed', error);
      return null;
    }
  }

  function ensureStyle() {
    if (document.getElementById('debugger-style')) return;
    const style = document.createElement('style');
    style.id = 'debugger-style';
    style.textContent = `
      .debug-badge {
        position: absolute;
        z-index: 999999;
        pointer-events: none;
        font-size: 0.7rem;
        line-height: 1;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        padding: 2px 5px;
        border-radius: 999px;
        border: 1px solid #000;
        background: #ccff00;
        color: #000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        white-space: nowrap;
        letter-spacing: 0.02em;
      }
      .debug-badge.badge-route {
        top: 0;
        right: 0;
        transform: translate(20%, -20%);
      }
      .debug-badge.badge-action {
        top: 0;
        left: 0;
        transform: translate(-20%, -20%);
      }
      .debug-badge.badge-text {
        top: 0;
        right: 0;
        transform: translate(20%, -20%);
      }
      .debug-anchor-n1 {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        z-index: 999999;
        pointer-events: none;
      }
      .debug-anchor-f1 {
        position: absolute;
        top: 1.5rem;
        left: 1.5rem;
        z-index: 999999;
        pointer-events: none;
      }
      .debug-host { position: relative !important; }
      .debug-action-host { position: relative !important; }
      .debug-stage-host { position: relative !important; }
    `;
    document.head.appendChild(style);
  }

  function getHost() {
    return document.getElementById('stage') || document.getElementById('app') || document.body;
  }

  function clearOverlays(root = state.host) {
    try {
      if (!root) return;
      root.querySelectorAll('.debug-badge').forEach((el) => el.remove());
    } catch (error) {
      console.warn('[Debugger] clearOverlays failed', error);
    }
  }

  function addBadge(host, text, badgeType = 'route') {
    if (!host) return null;
    const hostClass = badgeType === 'action' ? 'debug-action-host' : badgeType === 'text' ? 'debug-host' : 'debug-host';
    host.classList.add(hostClass);
    const badge = document.createElement('span');
    badge.className = `debug-badge badge-${badgeType}`;
    badge.textContent = text;
    host.appendChild(badge);
    return badge;
  }

  function renderNodeBadge(node, app) {
    try {
      if (!app) return;
      const nodeId = node?.id || window.Navigator?.currentNodeId || window.StoryRenderer?.getCurrentNodeId?.() || 'unknown';
      app.classList.add('debug-anchor-n1');
      addBadge(app, `[N1: ${nodeId}]`, 'route');
    } catch (error) {
      console.warn('[Debugger] renderNodeBadge failed', error);
    }
  }

  function renderFxBadge(node, stage) {
    try {
      if (!stage) return;
      const nodeId = node?.id || window.Navigator?.currentNodeId || window.StoryRenderer?.getCurrentNodeId?.() || 'unknown';
      const fxName = window.FxEngine?.state?.trailType
        || window.FxEngine?.currentTheme?.name
        || node?.fxTheme?.trailType
        || 'default';
      stage.classList.add('debug-anchor-f1');
      addBadge(stage, `[F1: ${fxName} @ ${nodeId}]`, 'route');
    } catch (error) {
      console.warn('[Debugger] renderFxBadge failed', error);
    }
  }

  function renderTextBadge(currentNodeId, textBlock) {
    try {
      if (!textBlock) return;
      textBlock.classList.add('debug-host');
      addBadge(textBlock, `[T1 @ ${currentNodeId}]`, 'text');
    } catch (error) {
      console.warn('[Debugger] renderTextBadge failed', error);
    }
  }

  function renderButtonBadges(buttons) {
    try {
      buttons.forEach((button, index) => {
        try {
          button.classList.add('debug-host');
          button.style.position = 'relative';
          const targetId = button?.dataset?.to || button.getAttribute?.('data-to') || '';
          const label = targetId ? `[B${index + 1} -> ${targetId}]` : `[B${index + 1}]`;
          addBadge(button, label, 'route');
        } catch (error) {
          console.warn('[Debugger] renderButtonBadges button failed', error);
        }
      });
    } catch (error) {
      console.warn('[Debugger] renderButtonBadges failed', error);
    }
  }

  function renderActionBadge(node, actionButtons) {
    try {
      if (!actionButtons.length) return;
      const interaction = node?.interaction ?? null;
      const actionLabel = interaction?.type === 'hold'
        ? `[A1: Hold]`
        : interaction?.type === 'mash'
          ? `[A1: Mash]`
          : interaction?.type === 'drag'
            ? `[A1: Drag]`
            : `[A1: ${interaction?.type || 'None'}]`;
      const actionTarget = document.querySelector('#optionList button:not([disabled])') || actionButtons[0];
      if (actionTarget) {
        actionTarget.classList.add('debug-action-host');
        actionTarget.style.position = 'relative';
        addBadge(actionTarget, actionLabel, 'action');
      }
    } catch (error) {
      console.warn('[Debugger] renderActionBadge failed', error);
    }
  }

  function renderTags() {
    if (!state.enabled) return;
    try {
      state.host = getHost();
      clearOverlays(state.host);

      const node = getNode();
      const app = document.getElementById('app');
      const stage = document.getElementById('stage');
      const currentNodeId = node?.id || window.Navigator?.currentNodeId || window.StoryRenderer?.getCurrentNodeId?.() || 'unknown';
      const textBlock = document.querySelector('#storyText');
      const buttons = document.querySelectorAll('#optionList button[data-to]');
      const actionButtons = document.querySelectorAll('#optionList button');

      renderNodeBadge(node, app);
      renderFxBadge(node, stage);
      renderTextBadge(currentNodeId, textBlock);
      renderButtonBadges(buttons);
      renderActionBadge(node, actionButtons);
    } catch (error) {
      console.warn('[Debugger] renderTags failed', error);
    }
  }

  function scheduleRender() {
    if (!state.enabled) return;
    clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => renderTags());
    }, 100);
  }

  function attachObserver() {
    if (state.observer) state.observer.disconnect();
    const host = getHost();
    if (!host || typeof MutationObserver === 'undefined') return;

    state.observer = new MutationObserver(() => {
      if (!state.enabled) return;
      scheduleRender();
    });

    state.observer.observe(host, { childList: true, subtree: true });
  }

  function detachObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
  }

  function setEnabled(next) {
    state.enabled = !!next;
    if (!state.enabled) {
      clearOverlays(state.host);
      detachObserver();
      return;
    }
    renderTags();
    attachObserver();
  }

  function toggle() {
    setEnabled(!state.enabled);
  }

  function bindKeys() {
    if (state.keyBound) return;
    state.keyBound = true;
    window.addEventListener('keydown', (event) => {
      if (event.key === '\\' || event.key === '~') {
        event.preventDefault();
        toggle();
      }
    });
  }

  function isDevHost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function init() {
    if (!isDevHost()) return;
    ensureStyle();
    bindKeys();
  }

  return { init, renderTags, setEnabled, toggle, get enabled() { return state.enabled; } };
})();

window.Debugger = Debugger;
