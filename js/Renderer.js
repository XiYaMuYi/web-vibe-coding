const state = {
  story: null,
  currentNodeId: null,
  bgActiveIndex: 0,
  typingTimer: null,
  isBooted: false,
  sceneTimerIds: [],
};

const el = {
  storyTitle: null,
  storyText: null,
  actionArea: null,
  stardustVal: null,
  bgLayer: null,
  stage: null,
  dialog: null,
};

function resolveEls() {
  el.storyTitle = document.getElementById('story-title') || document.getElementById('storyTitle');
  el.storyText = document.getElementById('story-text') || document.getElementById('storyText');
  el.actionArea = document.getElementById('action-area') || document.getElementById('optionList');
  el.stardustVal = document.getElementById('stardust-val') || document.getElementById('stardust-val');
  el.bgLayer = document.getElementById('bg-layer') || document.getElementById('bgLayerA');
  el.dialog = document.getElementById('cinematic-dialog');
}

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

function normalizeStoryPayload(story) {
  if (!story) return null;
  if (story.nodes) return story;
  if (story.story?.nodes) return story.story;
  return null;
}

function getNode(nodeId) {
  return state.story?.nodes?.[nodeId] ?? null;
}

function normalizeAssetPath(url = '') {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:') || url.startsWith('./') || url.startsWith('/')) return url;
  return `./${url.replace(/^\.?\/?/, '')}`;
}

function applyBackgroundImage(url = '') {
  if (!el.bgLayer) return;
  const resolvedUrl = normalizeAssetPath(url);
  if (!resolvedUrl) {
    el.bgLayer.style.backgroundImage = 'linear-gradient(180deg, #0b0f19 0%, #070b12 48%, #03050a 100%)';
    return;
  }
  el.bgLayer.style.backgroundImage = `url('${resolvedUrl}')`;
}

function setBackground(node) {
  applyBackgroundImage(node.background?.image ?? '');
}

function clearTyping() {
  if (state.typingTimer) clearTimeout(state.typingTimer);
  state.typingTimer = null;
}

function renderTypewriter(text, speed = 24) {
  clearTyping();
  if (!el.storyText) return;
  el.storyText.textContent = '';
  const chars = [...(text ?? '')];
  let index = 0;

  const tick = () => {
    if (!el.storyText) return;
    if (index >= chars.length) {
      clearTyping();
      return;
    }
    el.storyText.textContent += chars[index] ?? '';
    index += 1;
    state.typingTimer = window.setTimeout(tick, speed);
  };

  state.typingTimer = window.setTimeout(tick, speed);
}

function isLockedOption(option) {
  return !window.Navigator?.checkCondition?.(option.requires);
}

function renderOptions(options = []) {
  if (!el.actionArea) return;
  el.actionArea.innerHTML = '';
  options.forEach((option) => {
    const locked = isLockedOption(option);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = locked ? 'story-option story-option--locked' : 'story-option story-option--active';
    button.textContent = locked ? `🔒 ${option.label}` : option.label;
    button.dataset.to = option.to ?? '';
    if (option.setFlags) button.dataset.setFlags = JSON.stringify(option.setFlags);
    if (locked) button.disabled = true;
    el.actionArea.appendChild(button);
  });
}

function renderInteraction(interaction) {
  if (!el.actionArea) return;
  if (!interaction) return;

  if (state.currentNodeId === 'node_004') {
    el.actionArea.innerHTML = '';
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'story-option story-option--active energy-core';
  button.textContent = interaction.type === 'hold'
    ? '长按唤醒第一段记忆'
    : interaction.type === 'mash'
      ? '持续狂点 · 开采星辰矿脉'
      : interaction.type === 'connect'
        ? '拖拽鼠标：连接星辰节点，校准跃迁坐标'
        : interaction.hint || {
            drag: 'DRAG · SLIDE',
          }[interaction.type] || interaction.type;
  button.dataset.interaction = interaction.type;
  button.dataset.selector = interaction.selector ?? '';
  if (interaction.type === 'hold') button.dataset.holdMs = String(interaction.targetMs ?? 0);
  if (interaction.type === 'drag') button.dataset.drag = '1';
  if (interaction.type === 'mash') button.dataset.mash = String(interaction.targetCount ?? 0);
  el.actionArea.prepend(button);
}

function applyLayout(node) {
  const layout = node.layout ?? 'fullscreen-cinematic';
  document.body.dataset.layout = layout;
}

function setSceneTransition(active) {
  document.body.classList.toggle('scene-transition', active);
  document.body.classList.toggle('scene-enter', !active);
  if (el.dialog) {
    el.dialog.classList.toggle('dialog-fade-out', active);
    el.dialog.classList.toggle('dialog-fade-in', !active);
  }
}

function clearSceneTimers() {
  state.sceneTimerIds.forEach((id) => clearTimeout(id));
  state.sceneTimerIds = [];
}

function scheduleSceneTransition(nextNodeId) {
  const nextNode = getNode(nextNodeId);
  if (!nextNode) return;
  clearSceneTimers();

  const toast = document.getElementById('scene-toast') || (() => {
    const node = document.createElement('div');
    node.id = 'scene-toast';
    document.body.appendChild(node);
    return node;
  })();
  toast.textContent = '任务完成，跃迁校准中...';
  toast.classList.remove('is-visible');
  void toast.offsetWidth;
  toast.classList.add('is-visible');

  setSceneTransition(true);
  if (el.storyTitle) el.storyTitle.classList.add('dialog-fade-out');
  if (el.storyText) el.storyText.classList.add('dialog-fade-out');
  if (el.actionArea) el.actionArea.classList.add('dialog-fade-out');

  state.sceneTimerIds.push(window.setTimeout(() => {
    setBackground(nextNode);
    if (el.bgLayer) {
      el.bgLayer.style.filter = 'brightness(0.35) saturate(0.88)';
    }
  }, 1000));

  state.sceneTimerIds.push(window.setTimeout(() => {
    if (el.bgLayer) {
      el.bgLayer.style.filter = 'brightness(0) saturate(0.8)';
    }
  }, 2000));

  state.sceneTimerIds.push(window.setTimeout(() => {
    setSceneTransition(false);
    renderNode(nextNodeId);
    window.setTimeout(() => {
      if (el.storyTitle) el.storyTitle.classList.add('dialog-fade-in');
      if (el.storyText) el.storyText.classList.add('dialog-fade-in');
      if (el.actionArea) el.actionArea.classList.add('dialog-fade-in');
      if (el.dialog) el.dialog.classList.add('dialog-fade-in');
    }, 100);
  }, 3000));
}

function renderNode(nodeId) {
  const node = getNode(nodeId);
  if (!node) return;

  applyLayout(node);
  setSceneTransition(false);
  if (el.bgLayer) el.bgLayer.style.filter = '';
  document.getElementById('constellation-canvas')?.remove();
  if (nodeId === 'node_004' && el.actionArea) el.actionArea.innerHTML = '';
  document.body.classList.remove('scene-transition');
  document.body.classList.add('scene-enter');

  state.currentNodeId = node.id;
  if (el.storyTitle) el.storyTitle.textContent = node.title ?? '';
  setBackground(node);

  if (window.EconomyManager && el.stardustVal) {
    el.stardustVal.textContent = String(window.EconomyManager.getBalance?.() ?? 0);
  }

  const interaction = node.interaction ?? null;
  renderOptions(node.options ?? []);
  if (interaction) renderInteraction(interaction);

  clearTyping();
  renderTypewriter(node.text ?? '');

  if (interaction) {
    const nextUnbind = window.InteractionController?.bind?.(interaction);
    window.Navigator?.bindInteraction?.(nextUnbind);
  }
}

async function boot() {
  if (state.isBooted) return state.story;
  state.isBooted = true;
  resolveEls();
  const rawStory = await loadStory();
  state.story = normalizeStoryPayload(rawStory);
  if (!state.story) {
    setFallbackMessage('故事结构无效，未发现 nodes。');
    throw new Error('Invalid story payload');
  }
  return state.story;
}

function setStory(story) {
  state.story = story;
}

function shutdown() {
  clearTyping();
}

window.StoryRenderer = {
  boot,
  renderNode,
  scheduleSceneTransition,
  getStory: () => state.story,
  getCurrentNodeId: () => state.currentNodeId,
  setStory,
  shutdown,
};
