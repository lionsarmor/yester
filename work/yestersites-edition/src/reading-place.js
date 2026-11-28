// The member iframe and the native WebView use the same viewport anchor.
function yesterReadingPlace(report) {
  let restoring = false, stop = () => {};
  function capture() {
    if (restoring) return;
    const y = Math.round(scrollY);
    const spot = {y};
    const path = [];
    let el = document.elementFromPoint(innerWidth / 2, innerHeight / 3);
    if (el && y > 0 && !el.closest('[role=dialog]')) {
      const top = Math.round(el.getBoundingClientRect().top);
      while (el && el !== document.body && path.length < 24) {
        if (!el.parentElement || ['fixed','sticky'].includes(getComputedStyle(el).position)) break;
        path.unshift(Array.prototype.indexOf.call(el.parentElement.children, el));
        el = el.parentElement;
      }
      if (el === document.body && path.length) Object.assign(spot, {path, top});
    }
    report(spot);
  }
  window.addEventListener('scroll', capture, {passive:true});
  return function restore(spot) {
    stop();
    if (!spot || !Number.isFinite(spot.y) || spot.y < 0) return;
    restoring = true;
    function align() {
      let el = document.body;
      if (Array.isArray(spot.path) && spot.path.length <= 24 && Number.isFinite(spot.top)) {
        for (const i of spot.path) el = Number.isInteger(i) ? el?.children[i] : null;
      } else el = null;
      const y = el && el !== document.body && el.getClientRects().length ?
        scrollY + el.getBoundingClientRect().top - spot.top : spot.y;
      window.scrollTo({top:y, behavior:'instant'});
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(align) : null;
    const inputs = ['pointerdown','touchstart','wheel','keydown'];
    const timer = setTimeout(() => stop(), 3500);
    stop = () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('load',align);
      for (const event of inputs) window.removeEventListener(event,stop,true);
      restoring = false;
      stop = () => {};
    };
    for (const event of inputs) window.addEventListener(event,stop,{capture:true,passive:true});
    observer?.observe(document.body);
    window.addEventListener('load',align);
    align();
  };
}
