function debounce(fn, wait = 120) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, wait = 60) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      last = now;
      fn.apply(this, args);
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      last = Date.now();
      fn.apply(this, args);
    }, remaining);
  };
}

function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.Utils = { debounce, throttle, rand, clamp };
