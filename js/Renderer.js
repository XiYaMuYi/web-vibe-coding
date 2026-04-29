const state = {
  story: null,
  currentNodeId: null,
  bgActiveIndex: 0,
  typingTimer: null,
  isBooted: false,
};

const el = {
  app: document.getElementById('app'),
  nodeId: document.getElementById('nodeId'),
  title: document.getElementById('storyTitle'),
  text: document.getElementById('storyText'),
  options: document.getElementById('optionList'),
  badge: document.getElementById('interactionBadge'),
  bgA: document.getElementById('bgLayerA'),
  bgB: document.getElementById('bgLayerB'),
  stage: document.getElementById('stage'),
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

function normalizeAssetPath(url = '') {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:') || url.startsWith('./') || url.startsWith('/')) return url;
  return `./${url.replace(/^\.?\/?/, '')}`;
}

function applyBackgroundImage(layer, url) {
  const resolvedUrl = normalizeAssetPath(url);
  if (isPlaceholderUrl(resolvedUrl)) {
    layer.dataset.fallback = 'true';
    layer.style.backgroundImage = [
      'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.16), transparent 0 32%)',
      'radial-gradient(circle at 80% 30%, rgba(168,85,247,0.12), transparent 0 28%)',
      'radial-gradient(circle at 50% 110%, rgba(15,23,42,0.05), rgba(2,6,23,0.96) 64%)',
      'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
    ].join(', ');
    return;
  }

  const img = new Image();
  img.onload = () => {
    layer.dataset.fallback = 'false';
    layer.style.backgroundImage = `url('${resolvedUrl}')`;
  };
  img.onerror = () => {
    layer.dataset.fallback = 'true';
    layer.style.backgroundImage = [
      'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.16), transparent 0 32%)',
      'radial-gradient(circle at 80% 30%, rgba(168,85,247,0.12), transparent 0 28%)',
      'radial-gradient(circle at 50% 110%, rgba(15,23,42,0.05), rgba(2,6,23,0.96) 64%)',
      'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(2,6,23,0.98))'
    ].join(', ');
  };
  img.src = resolvedUrl;
}

function setBackground(node) {
  const nextIndex = state.bgActiveIndex === 0 ? 1 : 0;
  const activeLayer = bgLayers[nextIndex];
  const idleLayer = bgLayers[state.bgActiveIndex];

  if (!activeLayer || !idleLayer) return;

  activeLayer.style.opacity = '1';
  activeLayer.style.transform = 'scale(1)';
  activeLayer.classList.add('is-active');
  activeLayer.classList.remove('is-idle');
  applyBackgroundImage(activeLayer, node.background?.image ?? '');

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

  const tick = () => {
    el.text.textContent += chars[index] ?? '';
    index += 1;
    if (index >= chars.length) {
      clearInterval(state.typingTimer);
      state.typingTimer = null;
      return;
    }
    state.typingTimer = window.setTimeout(() => {
      requestAnimationFrame(tick);
    }, speed);
  };

  state.typingTimer = window.setTimeout(() => {
    requestAnimationFrame(tick);
  }, speed);
}

function isLockedOption(option) {
  return !window.Navigator?.checkCondition?.(option.requires);
}

function renderOptions(options = []) {
  el.options.innerHTML = '';
  options.forEach((option) => {
    const locked = isLockedOption(option);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = locked
      ? 'btn-soft rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/45 backdrop-blur-xl transition-opacity transition-transform transition-filter opacity-60 cursor-not-allowed'
      : 'btn-soft rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/88 backdrop-blur-xl transition-opacity transition-transform transition-filter hover:border-cyan-300/25 hover:bg-white/8 active:scale-95 active:bg-white/12';
    button.textContent = locked ? `🔒 ${option.label}` : option.label;
    button.dataset.to = option.to ?? '';
    if (option.setFlags) button.dataset.setFlags = JSON.stringify(option.setFlags);
    if (locked) button.disabled = true;
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

function applyLayout(node) {
  const layout = node.layout ?? 'fullscreen-cinematic';
  const root = el.app;
  if (!root) return;
  root.classList.remove('layout-fullscreen-cinematic', 'layout-character-dialogue', 'layout-terminal-override');
  root.classList.add(`layout-${layout}`);
}

function renderNode(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;

  applyLayout(node);

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
  }
  renderInteraction(node.interaction);
  renderOptions(node.options ?? []);
  setBackground(node);
  renderTypewriter(node.text ?? '');
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
}

window.StoryRenderer = {
  boot,
  renderNode,
  getStory: () => state.story,
  getCurrentNodeId: () => state.currentNodeId,
  setStory,
  shutdown,
};
