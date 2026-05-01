(function () {
  window.MemorialWall = window.MemorialWall || {
    mount() {},
    destroy() {},
  };

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const EFFECT_COMPOSER_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
  const RENDER_PASS_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
  const BLOOM_PASS_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
  const ROOM_ENV_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

  let depsPromise = null;

  function loadDeps() {
    if (depsPromise) return depsPromise;
    depsPromise = Promise.all([
      import(THREE_URL),
      import(EFFECT_COMPOSER_URL),
      import(RENDER_PASS_URL),
      import(BLOOM_PASS_URL),
      import(ROOM_ENV_URL),
    ]).then(([three, composer, renderPass, bloomPass, roomEnv]) => ({
      THREE: three,
      EffectComposer: composer.EffectComposer,
      RenderPass: renderPass.RenderPass,
      UnrealBloomPass: bloomPass.UnrealBloomPass,
      RoomEnvironment: roomEnv.RoomEnvironment,
    }));
    return depsPromise;
  }

  class StarEchoEngine {
    constructor() {
      this.container = null;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.composer = null;
      this.pmremGenerator = null;
      this.bgGroup = null;
      this.rootGroup = null;
      this.dustPoints = null;
      this.animationId = null;
      this.clock = null;
      this.initialized = false;
      this.deps = null;
      this.mockCards = [];
      this.ghostCards = [];
      this.uiRoot = null;
      this.speedScale = 0.12;
      this.centerStar = null;
      this.centerAvatar = null;
      this.centerHalo = null;
      this.centerRing = null;
      this.centerOrbit = 0;
    }

    ensureStyles() {
      if (document.getElementById('memorial-wall-style')) return;
      const style = document.createElement('style');
      style.id = 'memorial-wall-style';
      style.textContent = `
        .star-echo-shell {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 42%, #1a1f2e 0%, #0f1320 34%, #060810 58%, #020205 100%);
          color: #fff;
          -webkit-font-smoothing: antialiased;
          transform-style: preserve-3d;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .star-echo-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 35%, rgba(0, 240, 255, 0.08), transparent 34%),
            radial-gradient(circle at 18% 20%, rgba(107, 75, 255, 0.08), transparent 22%),
            radial-gradient(circle at 82% 26%, rgba(255, 255, 255, 0.04), transparent 20%);
          pointer-events: none;
        }
        .star-echo-canvas-host {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .star-echo-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .star-echo-ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
        }
        .star-echo-panel {
          pointer-events: auto;
          position: absolute;
          left: 20px;
          top: calc(20px + env(safe-area-inset-top, 0px));
          width: min(560px, calc(100vw - 40px));
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
        }
        .star-echo-panel h2,
        .star-echo-panel p,
        .star-echo-panel label,
        .star-echo-panel button,
        .star-echo-panel span {
          text-shadow: 0 0 12px rgba(0, 240, 255, 0.18);
        }
        .star-echo-panel h2 {
          margin: 0 0 10px;
          font-size: 26px;
          letter-spacing: 0.1em;
          color: #f4fbff;
        }
        .star-echo-panel .star-echo-copy {
          margin: 0;
          color: rgba(255,255,255,0.72);
          line-height: 1.72;
          font-size: 14px;
        }
        .star-echo-panel-inner {
          text-align: center;
        }
        .star-echo-meta {
        }
        .star-echo-speed-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .star-echo-speed-btn {
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          outline: none;
          border-radius: 14px;
          padding: 10px 14px;
          cursor: pointer;
          color: #dffcff;
          background: rgba(0, 240, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 18px rgba(0, 240, 255, 0.12);
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .star-echo-speed-btn:hover {
          transform: translateY(-1px);
          background: rgba(0, 240, 255, 0.12);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 28px rgba(0, 240, 255, 0.22);
        }
        .star-echo-speed-btn.is-active {
          background: rgba(0, 240, 255, 0.18);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 32px rgba(0, 240, 255, 0.28);
        }
        .star-echo-speed-readout {
          margin-top: 12px;
          color: rgba(223,252,255,0.78);
          font-size: 12px;
          letter-spacing: 0.08em;
        }
        .star-echo-stage {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          overflow: hidden;
        }
        .star-echo-avatar {
          position: absolute;
          left: 50%;
          top: 52%;
          width: 120px;
          height: 120px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          overflow: hidden;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.56), rgba(255,255,255,0.1) 34%, rgba(255,255,255,0.02) 62%, transparent 72%), radial-gradient(circle at center, rgba(0,240,255,0.14), rgba(0,240,255,0.02) 60%, transparent 72%);
          box-shadow: 0 0 80px rgba(0,240,255,0.16), inset 0 0 36px rgba(255,255,255,0.08);
          transform-style: preserve-3d;
          z-index: 5;
        }
        .star-echo-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          border-radius: 50%;
          transform: translateZ(1px);
          clip-path: circle(49% at 50% 50%);
        }
        .star-echo-center-img {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 120px;
          height: 120px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          object-fit: cover;
          clip-path: circle(49% at 50% 50%);
          pointer-events: none;
          z-index: 5;
        }
        .star-echo-input,
        .star-echo-btn {
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          outline: none;
        }
        .star-echo-input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 14px;
          padding: 12px 14px;
          margin: 18px 0 12px;
          font-size: 16px;
          color: #eafcff;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
          text-shadow: 0 0 12px rgba(0, 240, 255, 0.2);
        }
        .star-echo-input::placeholder {
          color: rgba(234,252,255,0.45);
        }
        .star-echo-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .star-echo-btn {
          border-radius: 14px;
          padding: 10px 14px;
          cursor: pointer;
          color: #dffcff;
          background: rgba(0, 240, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 18px rgba(0, 240, 255, 0.14);
          text-shadow: 0 0 12px rgba(0, 240, 255, 0.55);
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .star-echo-btn:hover {
          transform: translateY(-1px);
          background: rgba(0, 240, 255, 0.12);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 28px rgba(0, 240, 255, 0.22);
        }
        .star-echo-btn:active {
          transform: scale(0.97);
        }
      `;
      document.head.appendChild(style);
    }

    buildBase(container) {
      this.container = container;
      this.ensureStyles();
      const shell = document.createElement('div');
      shell.className = 'star-echo-shell';

      const canvasHost = document.createElement('div');
      canvasHost.className = 'star-echo-canvas-host';
      shell.appendChild(canvasHost);

      const ui = document.createElement('div');
      ui.className = 'star-echo-ui';
      const panel = document.createElement('div');
      panel.className = 'star-echo-panel';
      panel.innerHTML = `
        <div class="star-echo-panel-inner">
          <h2>星际回声投影</h2>
          <p class="star-echo-copy">卡片沿着引力轨道缓慢穿行，光晕与微粒背景共同构成这座造物宇宙</p>
        </div>
        <div class="star-echo-speed-controls">
          <button class="star-echo-speed-btn" data-speed="0.08" type="button">x0.08</button>
          <button class="star-echo-speed-btn is-active" data-speed="0.12" type="button">x0.12</button>
          <button class="star-echo-speed-btn" data-speed="0.16" type="button">x0.16</button>
          <button class="star-echo-speed-btn" data-speed="0.2" type="button">x0.20</button>
        </div>
        <div class="star-echo-speed-readout" data-speed-readout>引力流速：0.12</div>
      `;
      ui.appendChild(panel);
      shell.appendChild(ui);

      container.innerHTML = '';
      container.appendChild(shell);
      return { shell, canvasHost, ui, panel };
    }

    async initThree(canvasHost) {
      this.deps = await loadDeps();
      const { THREE, EffectComposer, RenderPass, UnrealBloomPass, RoomEnvironment } = this.deps;
      this.THREE = THREE;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0b0f19);
      this.scene.fog = new THREE.FogExp2(0x0b0f19, 0.012);

      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
      this.camera.position.set(0, 0, 55);

      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance', stencil: false, depth: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.domElement.className = 'star-echo-canvas';
      canvasHost.appendChild(this.renderer.domElement);

      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.pmremGenerator.compileEquirectangularShader();
      this.scene.environment = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

      this.bgGroup = new THREE.Group();
      this.scene.add(this.bgGroup);
      this.rootGroup = new THREE.Group();
      this.scene.add(this.rootGroup);
      this.clock = new THREE.Clock();

      const renderPass = new RenderPass(this.scene, this.camera);
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
      bloomPass.strength = 1.5;
      bloomPass.radius = 0.4;
      bloomPass.threshold = 0.85;

      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(renderPass);
      this.composer.addPass(bloomPass);

      this.createGalaxyBackground();
      this.createGhostCards(60);
      this.createCenterStar();
      this.createMockCards(240);
      this.bindSpeedControls();
      this.syncHud();
      this.initialized = true;
    }

    createGalaxyBackground() {
      const { THREE } = this.deps;
      const geometry = new THREE.BufferGeometry();
      const count = 3000;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const colorA = new THREE.Color(0x8da1ff);
      const colorB = new THREE.Color(0xb8a0ff);
      const colorC = new THREE.Color(0x00f0ff);
      for (let i = 0; i < count; i += 1) {
        const radius = 60 + Math.random() * 260;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        sizes[i] = Math.random() * 1.8;
        const pick = Math.random();
        const c = pick < 0.55 ? colorA : pick < 0.85 ? colorB : colorC;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      const material = new THREE.PointsMaterial({ size: 0.95, transparent: true, opacity: 0.6, vertexColors: true, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
      this.dustPoints = new THREE.Points(geometry, material);
      this.bgGroup.add(this.dustPoints);
    }

    createCenterStar() {
      const { THREE } = this.deps;
      const starGroup = new THREE.Group();
      starGroup.position.set(0, 0, 0);

      const coreGeo = new THREE.SphereGeometry(2.4, 48, 48);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 1.8,
        metalness: 0.8,
        roughness: 0.15,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      starGroup.add(core);

      const avatarRingGeo = new THREE.TorusGeometry(3.5, 0.12, 16, 96);
      const avatarRingMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
      });
      const avatarRing = new THREE.Mesh(avatarRingGeo, avatarRingMat);
      avatarRing.rotation.x = Math.PI / 2;
      starGroup.add(avatarRing);
      this.centerHalo = avatarRing;

      const avatarPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 4.2),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.98,
        })
      );
      avatarPlane.position.z = 0.08;
      starGroup.add(avatarPlane);
      this.centerAvatar = avatarPlane;

      const avatarImg = document.createElement('img');
      avatarImg.className = 'star-echo-center-img';
      avatarImg.alt = '主图';
      avatarImg.src = './image/0f3974c5d70084c7f35ac051deb341e0.jpg';
      this.uiRoot?.appendChild?.(avatarImg);

      const ringMats = [0x1c7fff, 0x00f0ff, 0x6b4bff, 0xffffff].map((color, index) => new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18 - index * 0.03,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
      const radii = [3.1, 4.2, 5.6, 7.0];
      this.centerRings = radii.map((radius, index) => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.16, radius, 64), ringMats[index]);
        ring.rotation.x = Math.PI / 2;
        ring.position.z = -0.04 * index;
        starGroup.add(ring);
        return ring;
      });

      const glowGeo = new THREE.SphereGeometry(3.0, 48, 48);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      starGroup.add(glow);

      this.centerStar = starGroup;
      this.rootGroup.add(starGroup);
    }

    createGhostCards(count = 60) {
      const { THREE } = this.deps;
      const cardGeo = new THREE.PlaneGeometry(3.0, 4.0);
      for (let i = 0; i < count; i += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 340;
        const ctx = canvas.getContext('2d');
        const hue = (i * 17) % 360;
        const grad = ctx.createLinearGradient(0, 0, 256, 340);
        grad.addColorStop(0, `hsla(${hue}, 65%, 18%, 0.26)`);
        grad.addColorStop(1, `hsla(${(hue + 55) % 360}, 65%, 30%, 0.06)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 340);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.arc(128, 130, 58, 0, Math.PI * 2);
        ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.025, metalness: 0.01, roughness: 0.97, envMapIntensity: 0.12, depthWrite: false });
        const ghost = new THREE.Mesh(cardGeo, mat);
        ghost.position.set((Math.random() - 0.5) * 74, (Math.random() - 0.5) * 42, -1300 - Math.random() * 2600);
        ghost.rotation.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08);
        ghost.userData = { speed: 1.6 + Math.random() * 2.2, seed: Math.random() * 1000 };
        this.rootGroup.add(ghost);
        this.ghostCards.push(ghost);
      }
    }

    createMockCards(count = 240) {
      const { THREE } = this.deps;
      const cardGeo = new THREE.PlaneGeometry(4.8, 6.4);
      for (let i = 0; i < count; i += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 704;
        const ctx = canvas.getContext('2d');
        const hue = (i * 23) % 360;
        const grad = ctx.createLinearGradient(0, 0, 512, 704);
        grad.addColorStop(0, `hsl(${hue}, 75%, 18%)`);
        grad.addColorStop(1, `hsl(${(hue + 45) % 360}, 80%, 34%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 704);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(256, 220, 130, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`TEST ${i + 1}`, 256, 360);
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText(`星际样张 ${i + 1}`, 256, 410);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 1.0, roughness: 0.2, envMapIntensity: 1.8 });
        const photoMat = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.05, roughness: 0.45 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 7.6, 0.22), frameMat);
        const photo = new THREE.Mesh(cardGeo, photoMat);
        photo.position.z = 0.13;
        frame.add(photo);

        const angle = Math.PI * 2 * Math.random();
        const radius = 14 + Math.random() * 28;
        const zSeed = -1200 + Math.random() * 1700;
        const sideBias = Math.random() < 0.5 ? -1 : 1;
        const edgeX = sideBias * (34 + Math.random() * 46);
        const edgeY = (Math.random() - 0.5) * 32;
        frame.position.set(edgeX + Math.cos(angle) * radius * 0.58, edgeY + Math.sin(angle) * radius * 0.42, zSeed);
        frame.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.08);
        frame.userData = {
          baseZ: frame.position.z,
          speed: 9 + Math.random() * 8,
          blurHint: i / count,
          orbitAngle: angle,
          orbitRadius: radius,
          orbitPhase: Math.random() * Math.PI * 2,
          seed: Math.random() * 1000,
        };
        this.rootGroup.add(frame);
        this.mockCards.push(frame);
      }
    }

    bindSpeedControls() {
      const buttons = this.container?.querySelectorAll?.('[data-speed]') || [];
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const speed = Number(button.dataset.speed || 0.12);
          this.speedScale = speed;
          buttons.forEach((item) => item.classList.toggle('is-active', item === button));
          this.syncHud();
        });
      });
    }

    syncHud() {
      const countEl = this.container?.querySelector?.('[data-meta-count]');
      const ghostsEl = this.container?.querySelector?.('[data-meta-ghosts]');
      const speedEl = this.container?.querySelector?.('[data-meta-speed]');
      const readoutEl = this.container?.querySelector?.('[data-speed-readout]');
      if (countEl) countEl.textContent = `cards ${this.mockCards.length}`;
      if (ghostsEl) ghostsEl.textContent = `ghosts ${this.ghostCards.length}`;
      if (speedEl) speedEl.textContent = `speed x${this.speedScale.toFixed(2)}`;
      if (readoutEl) readoutEl.textContent = `引力流速：${this.speedScale.toFixed(2)}`;
    }

    resize = () => {
      if (!this.renderer || !this.camera || !this.composer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    };

    animate = () => {
      this.animationId = requestAnimationFrame(this.animate);
      if (!this.initialized) return;
      const elapsed = this.clock.getElapsedTime();
      this.centerOrbit += this.speedScale * 0.08;

      if (this.rootGroup) {
        this.rootGroup.rotation.y = Math.sin(elapsed * 0.12) * 0.03;
        this.rootGroup.rotation.x = Math.sin(elapsed * 0.08) * 0.02;
      }
      if (this.bgGroup) {
        this.bgGroup.rotation.y = elapsed * 0.008;
        this.bgGroup.rotation.x = Math.sin(elapsed * 0.02) * 0.01;
      }
      if (this.dustPoints) {
        this.dustPoints.rotation.y = elapsed * 0.005;
      }

      if (this.centerStar) {
        this.centerStar.rotation.y = elapsed * 0.2;
        this.centerStar.rotation.z = Math.sin(elapsed * 0.28) * 0.03;
        this.centerStar.scale.setScalar(2.0 + Math.sin(elapsed * 0.8) * 0.03);
      }
      if (this.centerAvatar) {
        this.centerAvatar.material.opacity = 0.98;
      }
      if (this.centerHalo) {
        this.centerHalo.rotation.z = elapsed * 0.18;
        this.centerHalo.material.opacity = 0.08 + Math.sin(elapsed * 0.7) * 0.012;
      }
      if (this.centerRings) {
        this.centerRings.forEach((ring, idx) => {
          ring.rotation.z = elapsed * (0.14 + idx * 0.02);
          ring.material.opacity = 0.12 - idx * 0.02 + Math.sin(elapsed * (0.7 + idx * 0.14)) * 0.01;
        });
      }

      for (let i = 0; i < this.ghostCards.length; i += 1) {
        const ghost = this.ghostCards[i];
        const seed = ghost.userData.seed;
        ghost.rotation.y = elapsed * 0.05 + seed * 0.001;
        ghost.rotation.z = Math.sin(elapsed * 0.15 + seed) * 0.05;
        ghost.position.z += ghost.userData.speed * 0.0027 * this.speedScale;
        if (ghost.position.z > 900) {
          ghost.position.z = -1600 - Math.random() * 1800;
          ghost.position.x = (Math.random() - 0.5) * 28;
          ghost.position.y = (Math.random() - 0.5) * 16;
        }
        ghost.material.opacity = 0.06 + (Math.sin(elapsed * 0.6 + seed) + 1) * 0.03;
      }

      for (let i = 0; i < this.mockCards.length; i += 1) {
        const card = this.mockCards[i];
        const seed = card.userData.seed;
        const phase = card.userData.orbitPhase;
        const orbitAngle = card.userData.orbitAngle + elapsed * (0.0165 + (seed % 11) * 0.00075) + Math.sin(elapsed * 0.024 + phase) * 0.14;
        const orbitRadius = card.userData.orbitRadius + Math.sin(elapsed * 0.036 + seed) * 0.68;
        const orbitX = Math.cos(orbitAngle) * orbitRadius + Math.sin(elapsed * 0.03 + seed) * 0.42;
        const orbitY = Math.sin(orbitAngle) * orbitRadius * 0.72 + Math.cos(elapsed * 0.024 + seed) * 0.22;
        card.position.x = orbitX;
        card.position.y = orbitY;

        card.position.z += card.userData.speed * 0.0040 * this.speedScale;
        if (card.position.z > 500) {
          const resetAngle = Math.PI * 2 * Math.random();
          const resetRadius = 14 + Math.random() * 28;
          const sideBias = Math.random() < 0.5 ? -1 : 1;
          card.position.z = -1200 + Math.random() * 1700;
          card.position.x = sideBias * (26 + Math.random() * 28) + Math.cos(resetAngle) * resetRadius * 0.5;
          card.position.y = (Math.random() - 0.5) * 24 + Math.sin(resetAngle) * resetRadius * 0.34;
          card.userData.orbitAngle = resetAngle;
          card.userData.orbitRadius = resetRadius;
          card.userData.orbitPhase = Math.random() * Math.PI * 2;
          card.userData.seed = Math.random() * 1000;
        }

        const distance = Math.max(0, Math.min(1, (card.position.z + 1200) / 1700));
        const naturalJitter = 0.92 + Math.sin(elapsed * 0.14 + seed) * 0.08 + Math.cos(elapsed * 0.1 + i) * 0.05;
        card.material.opacity = Math.max(0.22, 1.0 - distance * 0.4);
        card.scale.setScalar((0.5 + (1 - distance) * 0.68) * naturalJitter);
        card.rotation.z += 0.00028;
        card.rotation.y = Math.sin(elapsed * 0.04 + i * 0.17) * 0.034;
      }
      this.syncHud();
      this.composer?.render();
    };

    async mount(container) {
      if (!container) return;
      this.destroy();
      const { shell, canvasHost, ui } = this.buildBase(container);
      this.uiRoot = ui;
      await this.initThree(canvasHost);
      window.addEventListener('resize', this.resize);
      this.animate();
      return shell;
    }

    destroy() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      this.animationId = null;
      this.initialized = false;
      window.removeEventListener('resize', this.resize);
      if (this.renderer?.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      this.pmremGenerator?.dispose?.();
      this.composer?.dispose?.();
      this.renderer?.dispose?.();
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.composer = null;
      this.pmremGenerator = null;
      this.bgGroup = null;
      this.rootGroup = null;
      this.dustPoints = null;
      this.clock = null;
      this.mockCards = [];
      this.ghostCards = [];
      this.uiRoot = null;
      this.centerStar = null;
      this.centerHalo = null;
      this.centerRing = null;
      this.centerOrbit = 0;
    }
  }

  window.StarEchoEngine = StarEchoEngine;
  window.MemorialWall = {
    async mount(container) {
      const engine = new StarEchoEngine();
      window.__starEchoEngine = engine;
      return engine.mount(container);
    },
    destroy() {
      window.__starEchoEngine?.destroy?.();
      window.__starEchoEngine = null;
    },
  };
})();
