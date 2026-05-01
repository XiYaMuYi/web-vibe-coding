const EconomyManager = (() => {
  const STORAGE_KEY = 'stardust_balance';
  const listeners = new Set();

  function readBalance() {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  }

  function notify(balance) {
    listeners.forEach((handler) => {
      try {
        handler(balance);
      } catch (error) {
        console.error('[EconomyManager] listener failed', error);
      }
    });
  }

  function writeBalance(nextBalance) {
    const balance = Math.max(0, Number(nextBalance) || 0);
    localStorage.setItem(STORAGE_KEY, String(balance));
    notify(balance);
    return balance;
  }

  function getBalance() {
    return readBalance();
  }

  function setBalance(nextBalance) {
    return writeBalance(nextBalance);
  }

  function addStardust(amount = 0) {
    const delta = Number(amount) || 0;
    return writeBalance(readBalance() + delta);
  }

  function spendStardust(amount = 0) {
    const cost = Number(amount) || 0;
    if (readBalance() < cost) return false;
    writeBalance(readBalance() - cost);
    return true;
  }

  function canAfford(amount = 0) {
    return readBalance() >= (Number(amount) || 0);
  }

  function onChange(handler) {
    if (typeof handler !== 'function') return () => {};
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function reset() {
    return writeBalance(0);
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    notify(readBalance());
  });

  return {
    getBalance,
    setBalance,
    addStardust,
    spendStardust,
    canAfford,
    onChange,
    reset,
  };
})();

window.EconomyManager = EconomyManager;
