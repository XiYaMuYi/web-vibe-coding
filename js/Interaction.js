const InteractionController = (() => {
  let cleanup = [];
  let activeInteraction = null;
  let rafId = null;
  let timeoutId = null;
  let lastTapAt = 0;
  let mashCount = 0;
  let holdStart = 0;
  let dragStartX = 0;
  let dragActive = false;
  let vibrateBoost = 0;

  const root = document.documentElement;
  const targetElement = () => document.getElementById('stage') || document.body;
  const bgTargets = () => [document.getElementById('bgLayerA'), document.getElementById('bgLayerB')].filter(Boolean);

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
  }

  function unbind() {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    activeInteraction = null;
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) clearTimeout(timeoutId);
    rafId = null;
    timeoutId = null;
    clearEffects();
  }

  function complete(interaction, onComplete) {
    const nextId = interaction.successTo || interaction?.success_to || interaction?.to || null;
    onComplete?.(nextId, interaction);
  }

  function bind(interaction = {}, onComplete = () => {}) {
    unbind();
    activeInteraction = interaction;

    if (!interaction.type) return unbind;

    if (interaction.type === 'mash') bindMash(interaction, onComplete);
    if (interaction.type === 'hold') bindHold(interaction, onComplete);
    if (interaction.type === 'drag') bindDrag(interaction, onComplete);

    return unbind;
  }

  function bindMash(interaction, onComplete) {
    const target = interaction.targetCount ?? 10;
    mashCount = 0;

    const handleTap = (event) => {
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
        complete(interaction, onComplete);
      }
      event.preventDefault?.();
    };

    document.addEventListener('click', handleTap, { passive: false });
    document.addEventListener('touchstart', handleTap, { passive: false });

    cleanup.push(() => {
      document.removeEventListener('click', handleTap);
      document.removeEventListener('touchstart', handleTap);
    });
  }

  function bindHold(interaction, onComplete) {
    const target = interaction.targetMs ?? 1200;
    let holding = false;

    const startHold = () => {
      if (holding) return;
      holding = true;
      holdStart = performance.now();
      vibrate(12);

      const tick = (now) => {
        if (!holding) return;
        const elapsed = now - holdStart;
        const progress = Math.min(1, elapsed / target);
        root.style.setProperty('--hold-progress', `${(progress * 100).toFixed(2)}%`);
        setBodyBlur(0.5 + progress * 4.5);
        if (progress >= 1) {
          holding = false;
          vibrate([40, 20, 80]);
          complete(interaction, onComplete);
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

  function bindDrag(interaction, onComplete) {
    const zone = interaction.selector ? document.querySelector(interaction.selector) : targetElement();
    if (!zone) return;

    const onStart = (event) => {
      dragActive = true;
      dragStartX = getClientX(event);
      zone.classList.add('dragging');
      vibrate(10);
    };

    const onMove = (event) => {
      if (!dragActive) return;
      const x = getClientX(event);
      const delta = x - dragStartX;
      const width = Math.max(1, zone.clientWidth || window.innerWidth);
      const percent = Math.max(0, Math.min(100, ((delta + width * 0.25) / width) * 100));
      root.style.setProperty('--drag-progress', `${percent.toFixed(2)}%`);
      zone.style.transform = `translateX(${Math.min(24, Math.max(-24, delta / 12))}px) scale(${1 + percent / 1000})`;
      zone.style.clipPath = `inset(0 ${100 - percent}% 0 0 round 1.5rem)`;
    };

    const onEnd = () => {
      if (!dragActive) return;
      dragActive = false;
      zone.classList.remove('dragging');
      zone.style.transform = '';
      zone.style.clipPath = '';
      vibrate([8, 18]);
      complete(interaction, onComplete);
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

  function getClientX(event) {
    if (event.touches?.length) return event.touches[0].clientX;
    if (event.changedTouches?.length) return event.changedTouches[0].clientX;
    return event.clientX ?? 0;
  }

  return { bind, unbind };
})();

window.InteractionController = InteractionController;
