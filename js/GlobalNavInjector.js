const GlobalNavInjector = (() => {
  const NAV_MODULES = [
    { key: 'story',     label: '主剧情',   href: './story.html',            locked: false },
    { key: 'auction',   label: '拍卖场',   href: './auction-board.html',    locked: true  },
    { key: 'bounty',    label: '悬赏',     href: './bounty-board.html',     locked: true  },
    { key: 'identity',  label: '身份',     href: './memorial-wall.html',    locked: true  },
    { key: 'truth',     label: '真理烙印', href: './truth-branding.html',   locked: true  },
    { key: 'wall',      label: '照片墙',   href: './wall-test.html',        locked: true  },
    { key: 'archive',   label: '归档',     href: './bounty-delivery.html',  locked: true  },
  ];

  const STORAGE_KEY = 'stardust_user_state';
  const VISITED_KEY = 'stardust_visited_modules';

  function isStoryCompleted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).isStoryCompleted : false;
    } catch {
      return false;
    }
  }

  function getVisited() {
    try {
      const raw = localStorage.getItem(VISITED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  function markVisited(key) {
    const visited = getVisited();
    visited.add(key);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
  }

  function isModuleUnlocked(mod) {
    // 已完成序章 → 全开
    if (isStoryCompleted()) return true;
    // 主剧情始终解锁
    if (mod.key === 'story') return true;
    // 去过 memorial-wall（identity）= 序章完成，全开
    if (getVisited().has('identity')) return true;
    // 其余全部锁着
    return false;
  }

  function resolveCurrentModule() {
    const path = window.location.pathname;
    if (path.includes('story.html')) return 'story';
    if (path.includes('auction-board.html')) return 'auction';
    if (path.includes('bounty-board.html')) return 'bounty';
    if (path.includes('memorial-wall.html')) return 'identity';
    if (path.includes('truth-branding.html')) return 'truth';
    if (path.includes('wall-test.html')) return 'wall';
    if (path.includes('bounty-delivery.html')) return 'archive';
    return null;
  }

  function handleNavClick(mod) {
    if (mod.locked) {
      alert('该模块尚未解锁，请完成序章剧情后再次尝试。');
      return;
    }
    window.location.href = mod.href;
  }

  function inject() {
    if (document.getElementById('global-nav-injected')) return;

    const current = resolveCurrentModule();

    const nav = document.createElement('nav');
    nav.id = 'global-nav-injected';
    nav.innerHTML = NAV_MODULES.map((mod) => {
      const unlocked = isModuleUnlocked(mod);
      const isActive = mod.key === current;
      const cls = ['global-nav-item'];
      if (isActive) cls.push('is-active');
      if (!unlocked) cls.push('is-locked');
      const icon = !unlocked ? '\u{1f512} ' : '';
      return `<span class="${cls.join(' ')}" data-key="${mod.key}" data-href="${mod.href}" data-locked="${!unlocked}">${icon}${mod.label}</span>`;
    }).join('');

    nav.addEventListener('click', (e) => {
      const item = e.target.closest('.global-nav-item');
      if (!item) return;
      const locked = item.dataset.locked === 'true';
      if (locked) {
        alert('该模块尚未解锁，请完成序章剧情后再次尝试。');
        return;
      }
      const href = item.dataset.href;
      if (href && !item.classList.contains('is-active')) {
        window.location.href = href;
      }
    });

    document.body.appendChild(nav);
  }

  return { inject, NAV_MODULES, isStoryCompleted, resolveCurrentModule };
})();

window.GlobalNavInjector = GlobalNavInjector;
