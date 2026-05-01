const AudioManager = (() => {
  const audioMap = new Map();
  let unlocked = false;
  let audioContext = null;
  let unlockListenerAttached = false;

  function clampVolume(value) {
    return Math.max(0, Math.min(1, value));
  }

  function getAudio(src) {
    if (!src) return null;
    if (audioMap.has(src)) return audioMap.get(src);

    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = true;
    audioMap.set(src, audio);
    return audio;
  }

  function primeAudioUnlock() {
    if (unlockListenerAttached) return;
    unlockListenerAttached = true;

    const unlock = async () => {
      if (unlocked) return;
      unlocked = true;

      try {
        if (!audioContext) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) audioContext = new Ctx();
        }
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      } catch (_) {}

      for (const audio of audioMap.values()) {
        try {
          audio.muted = true;
          const playResult = audio.play();
          if (playResult?.then) await playResult.catch(() => {});
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        } catch (_) {}
      }

      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('click', unlock, true);
    };

    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  async function playBGM(src, { loop = true } = {}) {
    primeAudioUnlock();
    const audio = getAudio(src);
    if (!audio) return null;
    audio.loop = loop;

    try {
      const playResult = audio.play();
      if (playResult?.then) await playResult.catch(() => {});
    } catch (_) {}

    return audio;
  }

  async function fadeBGM(newSrc, { duration = 900 } = {}) {
    primeAudioUnlock();

    const current = [...audioMap.values()].find((audio) => !audio.paused && audio.volume > 0.01) ?? null;
    const next = getAudio(newSrc);
    if (!next) return null;

    next.loop = true;
    next.volume = 0;
    try {
      const playResult = next.play();
      if (playResult?.then) await playResult.catch(() => {});
    } catch (_) {}

    const start = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        if (current) current.volume = clampVolume(1 - p);
        next.volume = clampVolume(p);
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          if (current) {
            current.pause();
            current.currentTime = 0;
          }
          resolve(next);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  function preload(src) {
    primeAudioUnlock();
    return getAudio(src);
  }

  function stopAll() {
    for (const audio of audioMap.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  primeAudioUnlock();

  return {
    preload,
    playBGM,
    fadeBGM,
    stopAll,
  };
})();

window.AudioManager = AudioManager;
