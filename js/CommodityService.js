const CommodityService = (() => {
  const STORAGE_KEY = 'purchased_items';
  const listeners = new Set();
  let catalog = [];

  function normalizeItem(item = {}) {
    return {
      ...item,
      id: item.id,
      name: item.name ?? item.title ?? String(item.id ?? ''),
      title: item.title ?? item.name ?? String(item.id ?? ''),
      description: item.description ?? '',
      price: Number(item.price || 0),
      rarity: item.rarity ?? 'R',
      imageUrl: item.imageUrl ?? item.url ?? '',
      url: item.url ?? item.imageUrl ?? '',
      stock: item.stock ?? null,
      unlockCost: item.unlockCost ?? item.price ?? 0,
    };
  }

  function loadCatalog(items = []) {
    catalog = Array.isArray(items) ? items.map((item) => normalizeItem(item)) : [];
    emitChange();
    return catalog;
  }

  function getCatalog() {
    return catalog;
  }

  function getPurchasedIds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function setPurchasedIds(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
    emitChange();
  }

  function isPurchased(itemId) {
    return getPurchasedIds().includes(itemId);
  }

  function canPurchase(itemId) {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) return false;
    if (item.stock !== undefined && item.stock !== null && item.stock <= 0) return false;
    if (item.price && !window.EconomyManager?.canAfford?.(item.price)) return false;
    return true;
  }

  function purchaseItem(itemId) {
    const item = catalog.find((entry) => entry.id === itemId);
    if (!item) return { ok: false, reason: 'NOT_FOUND' };

    if (item.price && !window.EconomyManager?.spendStardust?.(item.price)) {
      return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
    }

    if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
      return { ok: false, reason: 'OUT_OF_STOCK' };
    }

    const purchased = getPurchasedIds();
    if (!purchased.includes(itemId)) purchased.push(itemId);
    setPurchasedIds(purchased);

    if (typeof item.stock === 'number') {
      item.stock = Math.max(0, item.stock - 1);
    }

    emitChange();
    return { ok: true, item };
  }

  function onChange(handler) {
    if (typeof handler !== 'function') return () => {};
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function emitChange() {
    const snapshot = {
      catalog: getCatalog(),
      purchasedIds: getPurchasedIds(),
    };
    listeners.forEach((handler) => {
      try {
        handler(snapshot);
      } catch (error) {
        console.error('[CommodityService] listener failed', error);
      }
    });
  }

  function reset() {
    setPurchasedIds([]);
  }

  return {
    loadCatalog,
    getCatalog,
    getPurchasedIds,
    isPurchased,
    canPurchase,
    purchaseItem,
    onChange,
    reset,
  };
})();

window.CommodityService = CommodityService;
