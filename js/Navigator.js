const Navigator = (() => {
  const state = {
    flags: {
      has_key: false,
      sanity: 100,
    },
    history: [],
    currentNodeId: null,
    currentUnbind: null,
    story: null,
  };

  function init(story) {
    state.story = story ?? window.StoryRenderer?.getStory?.() ?? null;
    if (!state.currentNodeId) {
      state.currentNodeId = state.story?.meta?.startNode ?? 'node_000';
      state.history = [state.currentNodeId];
    }
    return state;
  }

  function getStory() {
    return state.story ?? window.StoryRenderer?.getStory?.() ?? null;
  }

  function getNode(nodeId) {
    return getStory()?.nodes?.[nodeId] ?? null;
  }

  function bindInteraction(unbindFn) {
    if (typeof unbindFn === 'function') {
      state.currentUnbind = unbindFn;
    }
  }

  function unbindCurrent() {
    if (typeof state.currentUnbind === 'function') {
      state.currentUnbind();
    }
    state.currentUnbind = null;
    window.InteractionController?.unbind?.();
  }

  function checkCondition(requires) {
    if (!requires) return true;
    const { flag, value } = requires;
    return state.flags?.[flag] === value;
  }

  function applyMutations(setFlags) {
    if (!setFlags) return;
    Object.assign(state.flags, setFlags);
  }

  function applyEconomy(node) {
    if (!node) return true;
    if (Number(node.rewardStardust || 0) > 0) {
      window.EconomyManager?.addStardust?.(node.rewardStardust);
    }
    const cost = Number(node.costStardust || 0);
    if (cost > 0) {
      if (!window.EconomyManager?.spendStardust?.(cost)) {
        window.Debugger?.log?.('星辰不足，无法进入该节点。');
        return false;
      }
    }
    return true;
  }

  function goTo(nodeId, mutations = null) {
    const node = getNode(nodeId);
    if (!node) return false;

    if (!applyEconomy(node)) return false;
    unbindCurrent();
    if (mutations?.setFlags) applyMutations(mutations.setFlags);
    if (node.interaction?.setFlags) applyMutations(node.interaction.setFlags);

    state.currentNodeId = nodeId;
    state.history.push(nodeId);

    window.StoryRenderer?.renderNode?.(nodeId);
    const activeNode = getNode(nodeId);
    if (activeNode?.audio?.bgm) {
      window.AudioManager?.fadeBGM?.(activeNode.audio.bgm);
    }

    const nextUnbind = window.InteractionController?.bind?.(activeNode?.interaction, (nextId) => {
      const fallback = activeNode?.interaction?.successTo || activeNode?.options?.[0]?.to;
      goTo(nextId || fallback);
    });
    bindInteraction(nextUnbind);

    if (activeNode?.fxTheme) {
      window.FxEngine?.setTheme?.(activeNode.fxTheme.trailType, activeNode.fxTheme.impactType, activeNode.fxTheme.colorHex);
    }

    return true;
  }

  function goBack() {
    if (state.history.length < 2) return false;
    unbindCurrent();
    state.history.pop();
    const prev = state.history[state.history.length - 1] || state.story?.meta?.startNode || 'node_000';
    state.currentNodeId = prev;
    window.StoryRenderer?.renderNode?.(prev);
    const node = getNode(prev);
    if (node?.audio?.bgm) window.AudioManager?.fadeBGM?.(node.audio.bgm);
    if (!applyEconomy(node)) return false;
    const nextUnbind = window.InteractionController?.bind?.(node?.interaction, (nextId) => {
      const fallback = node?.interaction?.successTo || node?.options?.[0]?.to;
      goTo(nextId || fallback);
    });
    bindInteraction(nextUnbind);
    return true;
  }

  function handleHiddenEggTrigger() {
    window.AppController?.showCameraModal?.();
  }

  return {
    init,
    goTo,
    goBack,
    bindInteraction,
    unbindCurrent,
    checkCondition,
    applyMutations,
    handleHiddenEggTrigger,
    get flags() {
      return state.flags;
    },
    get history() {
      return state.history;
    },
    get currentNodeId() {
      return state.currentNodeId;
    },
  };
})();

window.Navigator = Navigator;
