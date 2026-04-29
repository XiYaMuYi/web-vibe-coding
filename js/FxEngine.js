const FxEngine = (() => {
  const state = {
    canvas: null,
    ctx: null,
    running: false,
    dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    width: 0,
    height: 0,
    pointer: { x: 0, y: 0, active: false, lastTrailX: 0, lastTrailY: 0 },
    trailType: 'neon',
    impactType: 'ripple',
    color: '#7df9ff',
    particles: [],
    impacts: [],
    rafId: 0,
    lastFrameAt: 0,
  };

  const MAX_TRAIL_PARTICLES = 80;
  const MAX_IMPACTS = 5;
  const MIN_TRAIL_DISTANCE = 8;
  const FRAME_BUDGET_MS = 16.7;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function init() {
    if (state.running) return;
    ensureCanvas();
    bindEvents();
    resize();
    state.running = true;
    loop(0);
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
    if (!state.canvas || !state.ctx) return;
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
    state.pointer.x = x;
    state.pointer.y = y;

    const moved = dist(x, y, state.pointer.lastTrailX, state.pointer.lastTrailY);
    if (state.pointer.active || moved >= MIN_TRAIL_DISTANCE) {
      spawnTrail(x, y, x - state.pointer.lastTrailX, y - state.pointer.lastTrailY, false);
      state.pointer.lastTrailX = x;
      state.pointer.lastTrailY = y;
    }
  }

  function onDown(e) {
    state.pointer.active = true;
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.lastTrailX = e.clientX;
    state.pointer.lastTrailY = e.clientY;
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
    const count = burst ? 6 : clamp(Math.floor(speed / 18) + 1, 1, 4);
    for (let i = 0; i < count; i += 1) {
      state.particles.push(createTrailParticle(x, y, dx, dy));
    }
    if (state.particles.length > MAX_TRAIL_PARTICLES) {
      state.particles.splice(0, state.particles.length - MAX_TRAIL_PARTICLES);
    }
  }

  function createTrailParticle(x, y, dx, dy) {
    const p = {
      x,
      y,
      vx: dx * rand(0.02, 0.12) + rand(-0.5, 0.5),
      vy: dy * rand(0.02, 0.12) + rand(-0.5, 0.5),
      life: rand(16, 52),
      age: 0,
      size: rand(1.2, 4.4),
      alpha: rand(0.18, 0.85),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.08, 0.08),
      color: state.color,
      trailType: state.trailType,
      seed: Math.random(),
      wobble: rand(0.2, 1.2),
    };

    if (state.trailType === 'meteor') {
      p.vx *= 0.55;
      p.vy *= 0.55;
      p.vy += rand(-0.25, 0.2);
      p.size = rand(1, 2.4);
      p.life = rand(22, 48);
    } else if (state.trailType === 'ink') {
      p.vx *= 0.14;
      p.vy *= 0.14;
      p.size = rand(10, 22);
      p.alpha = rand(0.05, 0.12);
      p.life = rand(24, 60);
    } else if (state.trailType === 'glitch') {
      p.size = rand(2, 10);
      p.life = rand(4, 12);
      p.vx += rand(-2.2, 2.2);
      p.vy += rand(-2.2, 2.2);
    } else if (state.trailType === 'smoke') {
      p.size = rand(10, 28);
      p.alpha = rand(0.04, 0.12);
      p.life = rand(36, 84);
      p.vx *= 0.32;
      p.vy *= 0.32;
    } else if (state.trailType === 'neon') {
      p.size = rand(1, 2.4);
      p.alpha = rand(0.42, 0.95);
      p.life = rand(10, 30);
    }

    return p;
  }

  function spawnImpact(x, y) {
    state.impacts.push(createImpact(x, y));
    if (state.impacts.length > MAX_IMPACTS) state.impacts.shift();
  }

  function createImpact(x, y) {
    return {
      x,
      y,
      age: 0,
      life: 22,
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

  function loop(now) {
    if (!state.running) return;
    if (now - state.lastFrameAt >= FRAME_BUDGET_MS) {
      render();
      state.lastFrameAt = now;
    }
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
      stepParticle(p);
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
      p.vy += 0.05;
      p.vx *= 0.985;
      p.vy *= 0.99;
    } else if (p.trailType === 'ink') {
      p.vx *= 0.968;
      p.vy *= 0.968;
    } else if (p.trailType === 'glitch') {
      p.vx += rand(-0.25, 0.25);
      p.vy += rand(-0.25, 0.25);
    } else if (p.trailType === 'smoke') {
      p.vx *= 0.99;
      p.vy *= 0.99;
    } else if (p.trailType === 'neon') {
      p.vx *= 0.982;
      p.vy *= 0.982;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
  }

  function drawParticle(ctx, p, t) {
    const alpha = p.alpha * (1 - t);
    const spread = 1 + t * 1.4;
    if (p.trailType === 'meteor') {
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(p.color, alpha * 0.55);
      ctx.lineWidth = Math.max(0.6, p.size * 0.25);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3 + t * 8);
      ctx.stroke();
      ctx.strokeStyle = hexToRgba(p.color, alpha * 0.18);
      ctx.lineWidth = Math.max(0.5, p.size * 0.15);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 6, p.y - p.vy * 6 + t * 16);
      ctx.stroke();
    } else if (p.trailType === 'ink') {
      ctx.fillStyle = `rgba(5, 8, 15, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * spread, p.size * 0.72 * spread, p.rot, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.trailType === 'glitch') {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(55,255,155,0.82)' : 'rgba(255,50,95,0.8)';
      ctx.fillRect(p.x, p.y, p.size * (1 - t * 0.35), p.size * (0.5 + Math.random() * 1.2));
    } else if (p.trailType === 'smoke') {
      ctx.fillStyle = `rgba(180, 205, 255, ${alpha * 0.38})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + t * 2.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.trailType === 'neon') {
      ctx.strokeStyle = hexToRgba(p.color, alpha);
      ctx.lineWidth = 1.1 + (1 - t) * 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 1.1, p.y - p.vy * 1.1);
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
      const pieces = 8;
      for (let i = 0; i < pieces; i += 1) {
        const ang = fx.angle + (Math.PI * 2 * i) / pieces;
        const dist2 = ease * rand(20, 52);
        const px = fx.x + Math.cos(ang) * dist2;
        const py = fx.y + Math.sin(ang) * dist2;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang + t * 1.5);
        ctx.fillStyle = `rgba(220,240,255,${(1 - t) * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 3);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (fx.impactType === 'shockwave') {
      ctx.fillStyle = hexToRgba(fx.color, (1 - t) * 0.38);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 8 + ease * 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.68)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 10 + ease * 66, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.impactType === 'pixel') {
      for (let i = 0; i < 20; i += 1) {
        const ang = fx.angle + (Math.PI * 2 * i) / 20;
        const dist2 = ease * rand(16, 72);
        const px = fx.x + Math.cos(ang) * dist2;
        const py = fx.y + Math.sin(ang) * dist2;
        ctx.fillStyle = `rgba(125,249,255,${(1 - t) * 0.76})`;
        ctx.fillRect(px, py, 4 + Math.random() * 5, 4 + Math.random() * 5);
      }
    } else if (fx.impactType === 'splatter') {
      for (let i = 0; i < 12; i += 1) {
        const ang = fx.angle + rand(-0.7, 0.7) + (Math.PI * 2 * i) / 12;
        const dist2 = ease * rand(10, 60);
        const px = fx.x + Math.cos(ang) * dist2;
        const py = fx.y + Math.sin(ang) * dist2;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.78)' : hexToRgba(fx.color, (1 - t) * 0.54);
        ctx.beginPath();
        ctx.arc(px, py, rand(1.5, 5.5), 0, Math.PI * 2);
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
