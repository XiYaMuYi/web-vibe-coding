const state = {
  story: null,
  currentNodeId: null,
  bgActiveIndex: 0,
  typingTimer: null,
  isBooted: false,
  backgroundPanTimer: null,
};

const el = {
  nodeId: document.getElementById('nodeId'),
  title: document.getElementById('storyTitle'),
  text: document.getElementById('storyText'),
  options: document.getElementById('optionList'),
  badge: document.getElementById('interactionBadge'),
  bgA: document.getElementById('bgLayerA'),
  bgB: document.getElementById('bgLayerB'),
};

const bgLayers = [el.bgA, el.bgB];

function setFallbackMessage(message) {
  const panel = document.getElementById('appError');
  if (!panel) return;
  panel.textContent = message;
  panel.classList.remove('hidden');
}

async function loadStory() {
  try {
    const res = await fetch('./story.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`story.json load failed: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(error);
    setFallbackMessage('认知矩阵加载失败，请刷新终端重试...');
    throw error;
  }
}

function getNode(nodeId) {
  return state.story?.nodes?.[nodeId] ?? null;
}

function isPlaceholderUrl(url = '') {
  return !url || url.includes('cdn.example.com');
}

function applyFallbackArt(layer) {
  layer.dataset.fallback = 'true';
  layer.style.backgroundImage = [
    'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.16), transparent 0 32%)',
    'radial-gradient(circle at 80% 30%, rgba(168,85,247,0.12), transparent 0 28%)',
    'radial-gradient(circle at 50% 110%, rgba(15,23,42,0.05), rgba(2,6,23,0.96) 64%)',
    'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
  ].join(', ');
}

function applyBackgroundImage(layer, url) {
  if (isPlaceholderUrl(url)) {
    applyFallbackArt(layer);
    return;
  }

  const img = new Image();
  img.onload = () => {
    layer.dataset.fallback = 'false';
    layer.style.backgroundImage = `url('${url}')`;
  };
  img.onerror = () => applyFallbackArt(layer);
  img.src = url;
}

function startKenBurns(layer, seed = 0) {
  stopKenBurns();
  let t = 0;
  state.backgroundPanTimer = window.setInterval(() => {
    t += 1;
    const scale = 1 + Math.min(0.05, 0.00028 * t);
    const x = Math.sin((t + seed) / 140) * 10;
    const y = Math.cos((t + seed) / 170) * 8;
    layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;
  }, 80);
}

function stopKenBurns() {
  if (state.backgroundPanTimer) clearInterval(state.backgroundPanTimer);
  state.backgroundPanTimer = null;
}

function setBackground(node) {
  const nextIndex = state.bgActiveIndex === 0 ? 1 : 0;
  const activeLayer = bgLayers[nextIndex];
  const idleLayer = bgLayers[state.bgActiveIndex];

  if (!activeLayer || !idleLayer) return;

  activeLayer.style.opacity = '1';
  activeLayer.classList.add('is-active');
  activeLayer.classList.remove('is-idle');
  applyBackgroundImage(activeLayer, node.background?.image ?? '');
  activeLayer.style.transform = 'translate3d(0,0,0) scale(1)';
  window.requestAnimationFrame(() => startKenBurns(activeLayer, state.currentNodeId?.length ?? 0));

  idleLayer.classList.remove('is-active');
  idleLayer.classList.add('is-idle');
  idleLayer.style.opacity = '0';
  idleLayer.style.transform = 'scale(1.07)';

  state.bgActiveIndex = nextIndex;
}

function renderTypewriter(text, speed = 24) {
  clearInterval(state.typingTimer);
  el.text.textContent = '';
  const chars = [...(text ?? '')];
  let index = 0;

  state.typingTimer = setInterval(() => {
    el.text.textContent += chars[index] ?? '';
    index += 1;
    if (index >= chars.length) {
      clearInterval(state.typingTimer);
      state.typingTimer = null;
    }
  }, speed);
}

function renderOptions(options = []) {
  el.options.innerHTML = '';
  options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-soft rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/88 backdrop-blur-xl transition-all duration-200 hover:border-cyan-300/25 hover:bg-white/8 hover:shadow-[0_0_28px_rgba(125,249,255,0.10)] active:scale-95 active:bg-white/12';
    button.textContent = option.label;
    button.dataset.to = option.to;
    el.options.appendChild(button);
  });
}

function renderInteraction(interaction) {
  if (!interaction) {
    el.badge.classList.add('hidden');
    el.badge.textContent = '';
    return;
  }

  const hintMap = {
    mash: `MASH · ${interaction.targetCount ?? 0}`,
    hold: `HOLD · ${interaction.targetMs ?? 0}MS`,
    drag: 'DRAG · SLIDE',
  };

  el.badge.textContent = hintMap[interaction.type] ?? interaction.type;
  el.badge.classList.remove('hidden');
}

function renderNode(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;

  state.currentNodeId = node.id;
  window.StoryRenderer.currentNodeId = node.id;
  el.nodeId.textContent = node.id;
  el.title.textContent = node.title ?? '';
  const storyImage = document.getElementById('storyImage');
  if (storyImage) {
    storyImage.onerror = () => {
      storyImage.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#0b1020"/><text x="50%" y="50%" fill="#9ca3af" font-size="36" text-anchor="middle" dominant-baseline="middle">视觉资源加载失败</text></svg>');
    };
    if (node.background?.image) storyImage.src = node.background.image;
    storyImage.style.opacity = '0';
    window.requestAnimationFrame(() => {
      storyImage.style.opacity = '1';
      storyImage.style.transform = 'scale(1.03)';
    });
  }
  renderInteraction(node.interaction);
  setBackground(node);
  renderTypewriter(node.text ?? '');
  renderOptions(node.options ?? []);
}

async function boot() {
  if (state.isBooted) return state.story;
  state.isBooted = true;
  state.story = await loadStory();
  return state.story;
}

function setStory(story) {
  state.story = story;
}

function clearTyping() {
  clearInterval(state.typingTimer);
  state.typingTimer = null;
}

function shutdown() {
  clearTyping();
  stopKenBurns();
}

window.StoryRenderer = {
  boot,
  renderNode,
  getStory: () => state.story,
  getCurrentNodeId: () => state.currentNodeId,
  setStory,
  shutdown,
};
