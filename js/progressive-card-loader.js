// Progressive texture loading for StarEchoEngine on wall-test.html
// Replaces placeholder canvas textures with real image textures
// as data arrives from /api/wall, market-gallery.json, and /api/bounty

(async function () {
  // Wait for engine to be ready
  let engine = null;
  let attempts = 0;
  while (!engine && attempts < 60) {
    engine = window.__starEchoEngine;
    if (!engine) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
  }

  if (!engine || !engine.mockCards || engine.mockCards.length === 0) {
    console.warn('[progressive-loader] No engine or mockCards found');
    return;
  }

  const THREE = engine.THREE;
  if (!THREE) {
    console.warn('[progressive-loader] THREE not available');
    return;
  }

  // ── Collect all real image sources ──
  async function collectRealImages() {
    const images = [];

    // 1. /api/wall — Supabase wall entries
    try {
      const res = await fetch('/api/wall');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach(entry => {
            if (entry?.image_url || entry?.imageUrl) {
              images.push(entry.image_url || entry.imageUrl);
            }
          });
        }
      }
    } catch (_) {}

    // 2. market-gallery.json — commodity items
    try {
      const res = await fetch('./data/market-gallery.json');
      if (res.ok) {
        const data = await res.json();
        if (data?.items && Array.isArray(data.items)) {
          data.items.forEach(item => {
            if (item?.imageUrl || item?.url) {
              images.push(item.imageUrl || item.url);
            }
          });
        }
      }
    } catch (_) {}

    // 3. /api/bounty — bounty entries
    try {
      const res = await fetch('/api/bounty');
      if (res.ok) {
        const data = await res.json();
        if (data?.data && Array.isArray(data.data)) {
          data.data.forEach(entry => {
            if (entry?.image_url) {
              images.push(entry.image_url);
            }
          });
        }
      }
    } catch (_) {}

    return images;
  }

  // ── Generate picsum placeholder URL for a given card index ──
  function placeholderUrl(index) {
    const seeds = [
      'star-echo', 'cosmos', 'nebula', 'aurora', 'void',
      'pulsar', 'quasar', 'galaxy', 'meteor', 'comet',
      'eclipse', 'supernova', 'singularity', 'horizon', 'drift',
      'stellar', 'orbit', 'cosmic-dust', 'dark-matter', 'warp'
    ];
    const seed = seeds[index % seeds.length] + '-' + Math.floor(index / seeds.length);
    return `https://picsum.photos/seed/${seed}/512/704`;
  }

  // ── Replace a card's texture with a loaded image ──
  function applyTextureToCard(cardMesh, imageUrl) {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // Find the photo mesh (child with .material.map)
        cardMesh.children?.forEach?.(child => {
          if (child.material?.map) {
            child.material.map.dispose();
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        });
        // Also check if cardMesh itself has a map
        if (cardMesh.material?.map) {
          cardMesh.material.map.dispose();
          cardMesh.material.map = texture;
          cardMesh.material.needsUpdate = true;
        }
      },
      undefined,
      () => { /* load failed, keep placeholder */ }
    );
  }

  // ── Phase 1: Replace canvas "TEST" textures with picsum placeholders ──
  const cards = engine.mockCards;
  const totalCards = cards.length;

  // Replace first half with picsum placeholders immediately (staggered)
  const placeholderCount = Math.min(totalCards, Math.floor(totalCards * 0.6));
  for (let i = 0; i < placeholderCount; i++) {
    const url = placeholderUrl(i);
    applyTextureToCard(cards[i], url);
  }

  console.log(`[progressive-loader] Applied ${placeholderCount} picsum placeholders to ${totalCards} mock cards`);

  // ── Phase 2: Load real data and progressively replace ──
  const realImages = await collectRealImages();
  console.log(`[progressive-loader] Collected ${realImages.length} real images`);

  if (realImages.length > 0) {
    // Shuffle and spread real images across cards for visual mix
    const shuffled = realImages.sort(() => Math.random() - 0.5);
    const replaceCount = Math.min(shuffled.length, totalCards);

    // Stagger replacements to avoid blocking main thread
    for (let i = 0; i < replaceCount; i++) {
      const cardIndex = i; // Sequential replacement across first N cards
      const imageUrl = shuffled[i % shuffled.length];

      // Delay between replacements: spread over 3 seconds
      setTimeout(() => {
        applyTextureToCard(cards[cardIndex], imageUrl);
      }, i * 120);
    }

    console.log(`[progressive-loader] Scheduled ${replaceCount} real image replacements`);
  }
})();
