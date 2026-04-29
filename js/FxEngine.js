const FxEngine = (() => {
  const state = {
    canvas: null,
    ctx: null,
    running: false,
    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    width: 0,
    height: 0,
    pointer: { x: 0, y: 0, active: false, lastX: 0, lastY: 0 },
    trailType: 'neon',
    impactType: 'ripple',
    color: '#7df9ff',
    particles: [],
    impacts: [],
    rafId: 0,
  };

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function init() {
    if (state.running) return;
    ensureCanvas();
    bindEvents();
    resize();
    state.running = true;
    loop();
  }

  function ensureCanvas() {
    let canvas = document.getElementById('fxLayer');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fxLayer';
      canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;touch-action:none;mix-blend-mode:screen;';
      document.body.appendChild(canvas);
    }
    state.canvas = canvas;
    state.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  }

  function bindEvents() {
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
  }

  function resize() {
    if (!state.canvas) return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    state.width = w;
    state.height = h;
    state.canvas.width = Math.floor(w * state.dpr);
    state.canvas.height = Math.floor(h * state.dpr);
    state.canvas.style.width = `${w}px`;
    state.canvas.style.height = `${h}px`;
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function onMove(e) {
    const x = e.clientX;
    const y = e.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - state.pointer.lastX;
    const dy = y - state.pointer.lastY;
    state.pointer.x = x;
    state.pointer.y = y;
    if (state.pointer.active || Math.hypot(dx, dy) > 0.25) spawnTrail(x, y, dx, dy);
    state.pointer.lastX = x;
    state.pointer.lastY = y;
  }

  function onDown(e) {
    state.pointer.active = true;
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.lastX = e.clientX;
    state.pointer.lastY = e.clientY;
    spawnImpact(e.clientX, e.clientY);
    spawnTrail(e.clientX, e.clientY, 0, 0, true);
  }

  function onUp(e) {
    state.pointer.active = false;
    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
      spawnImpact(e.clientX, e.clientY);
    }
  }

  function spawnTrail(x, y, dx, dy, burst = false) {
    const speed = Math.hypot(dx, dy);
    const count = burst ? 10 : clamp(Math.floor(speed / 2), 1, 8);
    for (let i = 0; i < count; i += 1) {
      state.particles.push(createTrailParticle(x, y, dx, dy));
    }
  }

  function createTrailParticle(x, y, dx, dy) {
    const base = {
      x,
      y,
      vx: dx * rand(0.02, 0.14) + rand(-0.8, 0.8),
      vy: dy * rand(0.02, 0.14) + rand(-0.8, 0.8),
      life: rand(18, 60),
      age: 0,
      size: rand(1.2, 5.4),
      alpha: rand(0.35, 0.95),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.12, 0.12),
      blur: rand(0, 8),
      color: state.color,
      trailType: state.trailType,
      seed: Math.random(),
    };

    if (state.trailType === 'meteor') {
      base.vx *= 0.6;
      base.vy *= 0.6;
      base.vy += rand(-0.4, 0.3);
      base.size = rand(1, 3.2);
      base.blur = rand(4, 10);
      base.life = rand(25, 55);
    } else if (state.trailType === 'ink') {
      base.vx *= 0.18;
      base.vy *= 0.18;
      base.size = rand(12, 26);
      base.alpha = rand(0.06, 0.14);
      base.blur = rand(10, 18);
      base.life = rand(28, 68);
    } else if (state.trailType === 'glitch') {
      base.size = rand(2, 12);
      base.life = rand(4, 16);
      base.blur = 0;
      base.vx += rand(-2.8, 2.8);
      base.vy += rand(-2.8, 2.8);
    } else if (state.trailType === 'smoke') {
      base.size = rand(10, 30);
      base.alpha = rand(0.05, 0.16);
      base.blur = rand(8, 16);
      base.life = rand(40, 90);
      base.vx *= 0.4;
      base.vy *= 0.4;
    } else if (state.trailType === 'neon') {
      base.size = rand(1, 3);
      base.alpha = rand(0.55, 1);
      base.blur = rand(8, 18);
      base.life = rand(12, 38);
    }

    return base;
  }

  function spawnImpact(x, y) {
    state.impacts.push(createImpact(x, y));
  }

  function createImpact(x, y) {
    return {
      x,
      y,
      age: 0,
      life: 28,
      impactType: state.impactType,
      color: state.color,
      seed: Math.random(),
      angle: rand(0, Math.PI * 2),
    };
  }

  function setTheme(trailType = 'neon', impactType = 'ripple', colorHex = '#7df9ff') {
    state.trailType = trailType;
    state.impactType = impactType;
    state.color = colorHex;
  }

  function loop() {
    if (!state.running) return;
    render();
    state.rafId = requestAnimationFrame(loop);
  }

  function render() {
    const ctx = state.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.age += 1;
      const t = p.age / p.life;
      if (t >= 1) {
        state.particles.splice(i, 1);
        continue;
      }
      drawParticle(ctx, p, t);
      stepParticle(p, t);
    }

    for (let i = state.impacts.length - 1; i >= 0; i -= 1) {
      const fx = state.impacts[i];
      fx.age += 1;
      const t = fx.age / fx.life;
      if (t >= 1) {
        state.impacts.splice(i, 1);
        continue;
      }
      drawImpact(ctx, fx, t);
    }

    ctx.restore();
  }

  function stepParticle(p) {
    if (p.trailType === 'meteor') {
      p.vy += 0.08;
      p.vx *= 0.985;
      p.vy *= 0.992;
    } else if (p.trailType === 'ink') {
      p.vx *= 0.972;
      p.vy *= 0.972;
    } else if (p.trailType === 'glitch') {
      p.vx += rand(-0.45, 0.45);
      p.vy += rand(-0.45, 0.45);
    } else if (p.trailType === 'smoke') {
      p.vx *= 0.988;
      p.vy *= 0.988;
    } else if (p.trailType === 'neon') {
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
  }

  function drawParticle(ctx, p, t) {
    const alpha = p.alpha * (1 - t);
    const spread = 1 + t * 1.5;
    if (p.trailType === 'meteor') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.blur;
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(p.color, alpha * 0.6);
      ctx.lineWidth = Math.max(0.6, p.size * 0.3);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3 + t * 10);
      ctx.stroke();
    } else if (p.trailType === 'ink') {
      ctx.shadowBlur = p.blur;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.fillStyle = `rgba(5, 8, 15, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * spread, p.size * 0.72 * spread, p.rot, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.trailType === 'glitch') {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(55,255,155,0.85)' : 'rgba(255,50,95,0.82)';
      ctx.fillRect(p.x, p.y, p.size * (1 - t * 0.4), p.size * (0.6 + Math.random() * 1.4));
    } else if (p.trailType === 'smoke') {
      ctx.shadowBlur = p.blur;
      ctx.shadowColor = 'rgba(255,255,255,0.25)';
      ctx.fillStyle = `rgba(180, 205, 255, ${alpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + t * 2.8), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.trailType === 'neon') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.blur;
      ctx.strokeStyle = hexToRgba(p.color, alpha);
      ctx.lineWidth = 1.2 + (1 - t) * 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 1.2, p.y - p.vy * 1.2);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  function drawImpact(ctx, fx, t) {
    const ease = 1 - Math.pow(1 - t, 2);
    if (fx.impactType === 'ripple') {
      for (let i = 0; i < 3; i += 1) {
        const radius = 8 + ease * (28 + i * 18);
        ctx.strokeStyle = hexToRgba(fx.color, (1 - t) * (0.5 - i * 0.12));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (fx.impactType === 'shatter') {
      const pieces = 10;
      for (let i = 0; i < pieces; i += 1) {
        const ang = fx.angle + (Math.PI * 2 * i) / pieces;
        const dist = ease * rand(24, 62);
        const px = fx.x + Math.cos(ang) * dist;
        const py = fx.y + Math.sin(ang) * dist;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang + t * 2);
        ctx.fillStyle = `rgba(220,240,255,${(1 - t) * 0.72})`;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(10, 0);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (fx.impactType === 'shockwave') {
      ctx.fillStyle = hexToRgba(fx.color, (1 - t) * 0.45);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 8 + ease * 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 10 + ease * 70, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.impactType === 'pixel') {
      for (let i = 0; i < 24; i += 1) {
        const ang = fx.angle + (Math.PI * 2 * i) / 24;
        const dist = ease * rand(18, 82);
        const px = fx.x + Math.cos(ang) * dist;
        const py = fx.y + Math.sin(ang) * dist;
        ctx.fillStyle = `rgba(125,249,255,${(1 - t) * 0.8})`;
        ctx.fillRect(px, py, 4 + Math.random() * 6, 4 + Math.random() * 6);
      }
    } else if (fx.impactType === 'splatter') {
      for (let i = 0; i < 14; i += 1) {
        const ang = fx.angle + rand(-0.8, 0.8) + (Math.PI * 2 * i) / 14;
        const dist = ease * rand(12, 68);
        const px = fx.x + Math.cos(ang) * dist;
        const py = fx.y + Math.sin(ang) * dist;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.82)' : hexToRgba(fx.color, (1 - t) * 0.58);
        ctx.beginPath();
        ctx.arc(px, py, rand(1.5, 6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || '#7df9ff').replace('#', '');
    const r = parseInt(value.slice(0, 2), 16) || 125;
    const g = parseInt(value.slice(2, 4), 16) || 249;
    const b = parseInt(value.slice(4, 6), 16) || 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return { init, setTheme };
})();

window.FxEngine = FxEngine;
