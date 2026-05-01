const InteractionController = (() => {
  let cleanup = [];
  let activeInteraction = null;
  let rafId = null;
  let timeoutId = null;
  let lastTapAt = 0;
  let mashCount = 0;
  let holdStart = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragActive = false;
  let dragLastX = 0;
  let dragLastY = 0;
  let vibrateBoost = 0;
  let idleTimer = null;
  let connectState = null;

  const listeners = new Map();
  const idleConfig = {
    timeoutMs: 10000,
    penalty: 5,
  };
  const root = document.documentElement;
  const targetElement = () => document.getElementById('stage') || document.body;
  const bgTargets = () => [document.getElementById('bgLayerA'), document.getElementById('bgLayerB')].filter(Boolean);

  function on(eventName, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return () => listeners.get(eventName)?.delete(handler);
  }

  function emit(eventName, payload) {
    listeners.get(eventName)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[InteractionController] ${eventName} listener failed`, error);
      }
    });
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  }

  function setBodyBlur(value) {
    document.body.style.setProperty('--haptic-blur', `${value}px`);
    bgTargets().forEach((layer) => {
      layer.style.filter = `blur(${value}px)`;
    });
  }

  function clearEffects() {
    root.style.setProperty('--hold-progress', '0%');
    root.style.setProperty('--drag-progress', '0%');
    root.style.setProperty('--mash-progress', '0%');
    targetElement().classList.remove('shake');
    setBodyBlur(0);
    teardownConnect();
  }

  function clearIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function pulseIdleHud() {
    const hud = document.getElementById('stardust-hud');
    if (!hud) return;
    hud.classList.add('text-danger');
    window.setTimeout(() => hud.classList.remove('text-danger'), 900);
  }

  function spawnIdlePenaltyToast() {
    const toast = document.createElement('div');
    toast.className = 'floating-stardust floating-stardust--danger';
    toast.textContent = '⚠️ 意志沉寂，星际窃贼窃取了 5 ✦';
    toast.style.left = `${window.innerWidth * 0.5}px`;
    toast.style.top = `${Math.max(120, window.innerHeight * 0.35)}px`;
    document.body.appendChild(toast);
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  function applyIdlePenalty() {
    const before = window.EconomyManager?.getBalance?.() ?? 0;
    const after = Math.max(0, before - idleConfig.penalty);
    window.EconomyManager?.setBalance?.(after);
    pulseIdleHud();
    spawnIdlePenaltyToast();
    emit('IDLE_PENALTY', { before, after, penalty: idleConfig.penalty });
  }

  function scheduleIdlePenalty() {
    clearIdleTimer();
    idleTimer = window.setTimeout(() => {
      applyIdlePenalty();
      scheduleIdlePenalty();
    }, idleConfig.timeoutMs);
  }

  function unbind() {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    activeInteraction = null;
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) clearTimeout(timeoutId);
    clearIdleTimer();
    rafId = null;
    timeoutId = null;
    clearEffects();
  }

  function complete(interaction, payload = {}) {
    // Unbind immediately to prevent re-triggering during transition
    unbind();
    const nextId = interaction.successTo || interaction?.success_to || interaction?.to || null;
    const detail = {
      type: interaction.type,
      nextId,
      interaction,
      ...payload,
    };
    emit('INTERACTION_SUCCESS', detail);
    emit(`INTERACTION_SUCCESS:${interaction.type}`, detail);
  }

  function bind(interaction = {}) {
    unbind();
    activeInteraction = interaction;

    if (!interaction.type) {
      bindIdleWatch();
      return unbind;
    }

    if (interaction.type === 'mash') bindMash(interaction);
    if (interaction.type === 'hold') bindHold(interaction);
    if (interaction.type === 'drag') bindDrag(interaction);
    if (interaction.type === 'connect') bindConnect(interaction);

    bindIdleWatch();
    return unbind;
  }

  function bindMash(interaction) {
    const target = interaction.targetCount ?? 10;
    mashCount = 0;

    const handleTap = (event) => {
      event.preventDefault?.();
      const now = Date.now();
      if (now - lastTapAt < 60) return;
      lastTapAt = now;
      mashCount += 1;

      targetElement().classList.add('shake');
      root.style.setProperty('--mash-count', String(mashCount));
      root.style.setProperty('--mash-progress', `${Math.min(100, (mashCount / target) * 100)}%`);
      vibrate(mashCount >= target ? [40, 20, 80] : 15);

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => targetElement().classList.remove('shake'), 180);

      if (mashCount >= target) {
        vibrate([70, 40, 110]);
        complete(interaction, { count: mashCount, targetCount: target });
      }
    };

    document.addEventListener('click', handleTap, { passive: false });
    document.addEventListener('touchstart', handleTap, { passive: false });

    cleanup.push(() => {
      document.removeEventListener('click', handleTap);
      document.removeEventListener('touchstart', handleTap);
    });
  }

  function bindHold(interaction) {
    const target = interaction.targetMs ?? 1200;
    let holding = false;

    const startHold = (e) => {
      if (holding) return;
      holding = true;
      holdStart = performance.now();
      vibrate(12);
      // Prevent text selection during hold (only when hold interaction is active)
      e?.preventDefault?.();

      const tick = (now) => {
        if (!holding) return;
        const elapsed = now - holdStart;
        const progress = Math.min(1, elapsed / target);
        root.style.setProperty('--hold-progress', `${(progress * 100).toFixed(2)}%`);
        setBodyBlur(0.5 + progress * 4.5);
        if (progress >= 1) {
          holding = false;
          vibrate([40, 20, 80]);
          complete(interaction, { duration: elapsed, targetMs: target });
          return;
        }
        vibrateBoost = progress > 0.66 ? 1 : 0;
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
    };

    const endHold = () => {
      holding = false;
      root.style.setProperty('--hold-progress', '0%');
      setBodyBlur(0);
      if (rafId) cancelAnimationFrame(rafId);
      if (vibrateBoost) vibrate(10);
      vibrateBoost = 0;
    };

    document.addEventListener('mousedown', startHold);
    document.addEventListener('touchstart', startHold, { passive: true });
    document.addEventListener('mouseup', endHold);
    document.addEventListener('touchend', endHold);
    document.addEventListener('touchcancel', endHold);

    cleanup.push(() => {
      document.removeEventListener('mousedown', startHold);
      document.removeEventListener('touchstart', startHold);
      document.removeEventListener('mouseup', endHold);
      document.removeEventListener('touchend', endHold);
      document.removeEventListener('touchcancel', endHold);
    });
  }

  function bindDrag(interaction) {
    const zone = interaction.selector ? document.querySelector(interaction.selector) : targetElement();
    if (!zone) return;

    const minDistance = interaction.minDistance ?? 140;
    const minPercent = interaction.minProgress ?? 55;
    const direction = interaction.direction || 'either';

    let dragPeakPercent = 0;
    let dragMoved = false;

    const onStart = (event) => {
      dragActive = true;
      dragMoved = false;
      dragPeakPercent = 0;
      dragStartX = getClientX(event);
      dragStartY = getClientY(event);
      dragLastX = dragStartX;
      dragLastY = dragStartY;
      zone.classList.add('dragging');
      vibrate(10);
    };

    const onMove = (event) => {
      if (!dragActive) return;
      const x = getClientX(event);
      const y = getClientY(event);
      dragLastX = x;
      dragLastY = y;
      const deltaX = x - dragStartX;
      const deltaY = y - dragStartY;
      const distance = Math.hypot(deltaX, deltaY);
      const width = Math.max(1, zone.clientWidth || window.innerWidth);
      const percent = Math.max(0, Math.min(100, (distance / Math.max(minDistance, width * 0.16)) * 100));
      dragPeakPercent = Math.max(dragPeakPercent, percent);
      dragMoved = dragMoved || distance > 4;
      root.style.setProperty('--drag-progress', `${percent.toFixed(2)}%`);
      zone.style.transform = `translate3d(${Math.min(24, Math.max(-24, deltaX / 12))}px, ${Math.min(18, Math.max(-18, deltaY / 18))}px, 0) scale(${1 + percent / 1000})`;
      zone.style.clipPath = `inset(0 ${100 - percent}% 0 0 round 1.5rem)`;
      if (percent >= 35) vibrate(4);
    };

    const onEnd = () => {
      if (!dragActive) return;
      dragActive = false;
      const deltaX = dragLastX - dragStartX;
      const deltaY = dragLastY - dragStartY;
      const distance = Math.hypot(deltaX, deltaY);
      const horizontalPassed = Math.abs(deltaX) >= minDistance && (direction === 'either' || (direction === 'left' && deltaX < 0) || (direction === 'right' && deltaX > 0));
      const verticalPassed = Math.abs(deltaY) >= minDistance && (direction === 'either' || (direction === 'up' && deltaY < 0) || (direction === 'down' && deltaY > 0));
      const progressPassed = dragPeakPercent >= minPercent;
      const success = dragMoved && distance >= minDistance && (horizontalPassed || verticalPassed || progressPassed);
      zone.classList.remove('dragging');
      zone.style.transform = '';
      zone.style.clipPath = '';
      root.style.setProperty('--drag-progress', '0%');
      vibrate(success ? [18, 28, 42] : [8, 18]);
      if (success) {
        complete(interaction, { distance, deltaX, deltaY, progress: dragPeakPercent });
      }
    };

    zone.addEventListener('touchstart', onStart, { passive: true });
    zone.addEventListener('mousedown', onStart);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('mouseup', onEnd);

    cleanup.push(() => {
      zone.removeEventListener('touchstart', onStart);
      zone.removeEventListener('mousedown', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('mouseup', onEnd);
    });
  }

  function teardownConnect() {
    if (!connectState) return;
    const { canvas, handlers } = connectState;
    handlers.forEach(({ type, fn, target }) => target.removeEventListener(type, fn));
    canvas?.remove?.();
    connectState = null;
  }

  function bindConnect(interaction) {
    teardownConnect();
    const dialog = document.getElementById('cinematic-dialog') || document.getElementById('app');
    if (!dialog) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'constellation-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.width = 'min(920px, 86vw)';
    canvas.style.height = 'min(520px, 48vh)';
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '45';
    canvas.style.background = 'transparent';
    canvas.width = 1600;
    canvas.height = 900;
    dialog.parentElement?.insertBefore(canvas, dialog);

    const ctx = canvas.getContext('2d');
    const nodes = [
      { id: 'a', x: 240, y: 190 },
      { id: 'b', x: 520, y: 110 },
      { id: 'c', x: 1180, y: 190 },
      { id: 'd', x: 890, y: 360 },
    ];
    const links = new Set();
    const requiredLinks = new Set(['a-b', 'b-c', 'c-d', 'd-a']);
    let drawingFrom = null;
    let cursor = { x: 0, y: 0 };

    const getPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = getClientX(event);
      const y = getClientY(event);
      return { x: ((x - rect.left) / rect.width) * canvas.width, y: ((y - rect.top) / rect.height) * canvas.height };
    };

    const hitNode = (pt) => nodes.find((node) => Math.hypot(node.x - pt.x, node.y - pt.y) < 42) || null;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#00F0FF';
      links.forEach((key) => {
        const [fromId, toId] = key.split('-');
        const from = nodes.find((n) => n.id === fromId);
        const to = nodes.find((n) => n.id === toId);
        if (!from || !to) return;
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 12]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });
      if (drawingFrom) {
        ctx.strokeStyle = '#7efcff';
        ctx.lineWidth = 6;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(drawingFrom.x, drawingFrom.y);
        ctx.lineTo(cursor.x, cursor.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      nodes.forEach((node) => {
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(0,240,255,0.18)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const unlockLink = (fromId, toId) => {
      const key = `${fromId}-${toId}`;
      const reverse = `${toId}-${fromId}`;
      const normalized = requiredLinks.has(key) ? key : requiredLinks.has(reverse) ? reverse : null;
      if (!normalized || links.has(normalized)) return false;
      links.add(normalized);
      window.EconomyManager?.addStardust?.(200);
      pulseIdleHud();
      window.FxEngine?.play?.('interaction-success', { fromId, toId });
      emit('CONNECT_LINK_SUCCESS', { fromId, toId, rewardStardust: 200 });
      draw();
      if (links.size >= requiredLinks.size) {
        window.setTimeout(() => {
          emit('INTERACTION_SUCCESS', { type: 'connect', nextId: interaction.successTo, interaction, completed: true });
        }, 240);
      }
      return true;
    };

    const onPointerDown = (event) => {
      const pt = getPoint(event);
      const node = hitNode(pt);
      if (!node) return;
      drawingFrom = node;
      cursor = pt;
      draw();
      event.preventDefault?.();
    };

    const onPointerMove = (event) => {
      cursor = getPoint(event);
      if (drawingFrom) draw();
    };

    const onPointerUp = (event) => {
      if (!drawingFrom) return;
      const pt = getPoint(event);
      const node = hitNode(pt);
      if (node && node.id !== drawingFrom.id) unlockLink(drawingFrom.id, node.id);
      drawingFrom = null;
      cursor = pt;
      draw();
    };

    const handlers = [
      { target: canvas, type: 'mousedown', fn: onPointerDown },
      { target: canvas, type: 'touchstart', fn: onPointerDown },
      { target: window, type: 'mousemove', fn: onPointerMove },
      { target: window, type: 'touchmove', fn: onPointerMove },
      { target: window, type: 'mouseup', fn: onPointerUp },
      { target: window, type: 'touchend', fn: onPointerUp },
    ];
    handlers.forEach(({ target, type, fn }) => target.addEventListener(type, fn, { passive: type !== 'mousedown' && type !== 'touchstart' }));
    connectState = { canvas, handlers };
    draw();
  }

  function bindIdleWatch() {
    const reset = () => scheduleIdlePenalty();
    ['mousemove', 'mousedown', 'touchstart', 'click', 'touchmove', 'keydown'].forEach((eventName) => {
      document.addEventListener(eventName, reset, { passive: true });
      cleanup.push(() => document.removeEventListener(eventName, reset));
    });
    scheduleIdlePenalty();
  }

  function getClientX(event) {
    if (event.touches?.length) return event.touches[0].clientX;
    if (event.changedTouches?.length) return event.changedTouches[0].clientX;
    return event.clientX ?? 0;
  }

  function getClientY(event) {
    if (event.touches?.length) return event.touches[0].clientY;
    if (event.changedTouches?.length) return event.changedTouches[0].clientY;
    return event.clientY ?? 0;
  }

  return { bind, unbind, on, emit, scheduleIdlePenalty };
})();

window.InteractionController = InteractionController;
