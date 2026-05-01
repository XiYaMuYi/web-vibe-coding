(function () {
  const KEYS = ['stardust_balance', 'user_submitted', 'purchased_items'];

  function isTestMode() {
    return new URLSearchParams(window.location.search).has('test') || localStorage.getItem('memorial_mode') === 'test';
  }

  function resetState() {
    KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('stardust_balance', '0');
    window.EconomyManager?.setBalance?.(0);
    window.CommodityService?.reset?.();
  }

  function goHome() {
    const target = isTestMode() ? './memorial-wall.html?test' : './memorial-wall.html';
    window.location.href = target;
  }

  function updateBadge() {
    const badge = document.getElementById('modeBadge');
    if (!badge) return;
    badge.textContent = isTestMode() ? '测试模式' : '正式模式';
  }

  function bindResetButton() {
    const button = document.getElementById('resetEntryBtn');
    if (!button) return;
    button.addEventListener('click', () => {
      resetState();
      goHome();
    });
  }

  function mount() {
    updateBadge();
    bindResetButton();
  }

  window.GlobalReset = {
    resetState,
    goHome,
    isTestMode,
    updateBadge,
    bindResetButton,
    mount,
  };

  window.addEventListener('DOMContentLoaded', mount);
})();
