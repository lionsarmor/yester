export type DragSample = {
  phase: "move" | "end" | "cancel";
  dx: number;
  dy: number;
  elapsed: number;
  held: boolean;
};

export const turnThreshold = (width: number) => Math.min(176, Math.max(80, width * 0.38));

export function turnDecision(sample: DragSample, width: number) {
  const distance = Math.abs(sample.dx);
  const horizontal = distance >= 10 && distance > Math.abs(sample.dy) * 1.5;
  const threshold = turnThreshold(width);
  const crossed = horizontal && distance >= threshold;
  const flick = !sample.held && distance >= 38 &&
    distance / Math.max(1, sample.elapsed) >= 0.58;
  return {
    direction: sample.dx < 0 ? 1 as const : -1 as const,
    horizontal,
    crossed,
    commit: sample.phase !== "cancel" && horizontal &&
      ((sample.held && crossed) || (sample.phase === "end" && (crossed || flick))),
  };
}

// Runs in the main document of the phone WebView. The frame grip handles pages
// that own their touch surface (including games and cross-origin iframes).
export const pageTouches = `(function(){
  if (window.__yesterPageTurn) return;
  window.__yesterPageTurn = true;
  var start, horizontal = false;
  var controls = 'a,button,input,textarea,select,label,summary,audio,video,iframe,canvas,object,embed,[draggable=true],[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=link],[role=application],.retro-player,.cartridge-stage,.ref-deck';
  function safe(target) {
    if (!target || target.closest(controls) || document.fullscreenElement || String(window.getSelection())) return false;
    for (var el=target; el; el=el.parentElement) {
      var style=getComputedStyle(el);
      if (style.touchAction==='none' || ((/auto|scroll/.test(style.overflowX) || el===document.scrollingElement) && el.scrollWidth>el.clientWidth+2)) return false;
    }
    return true;
  }
  function send(phase, dx, dy) {
    window.ReactNativeWebView.postMessage(JSON.stringify({turn:{phase:phase,dx:dx,dy:dy,held:start.held,elapsed:performance.now()-start.time}}));
  }
  function cancel() {
    if(start && horizontal) send('cancel',0,0);
    start=null; horizontal=false;
  }
  document.addEventListener('touchstart',function(e){
    cancel();
    if(!window.__yesterTurnsOn || !e.isTrusted || e.touches.length!==1 || !safe(e.target)) return;
    var t=e.touches[0];
    window.ReactNativeWebView.postMessage(JSON.stringify({turn:{phase:'start'}}));
    start={x:t.screenX,y:t.screenY,time:performance.now(),held:false};
  },{capture:true,passive:true});
  function sample(e,phase){
    if(!start || !e.isTrusted) return;
    if(document.fullscreenElement || (phase==='move' && e.touches.length!==1)) return cancel();
    var t=e.changedTouches[0],dx=t.screenX-start.x,dy=t.screenY-start.y;
    if(!horizontal){
      if(Math.abs(dy)>9 && Math.abs(dy)>=Math.abs(dx)) return cancel();
      if(Math.abs(dx)<9 || Math.abs(dx)<Math.abs(dy)*1.5) { if(phase==='end') cancel(); return; }
      start.held=performance.now()-start.time>=350;
      horizontal=true;
    }
    if(e.cancelable) e.preventDefault();
    send(phase,dx,dy);
    if(phase==='end'){ start=null; horizontal=false; }
  }
  document.addEventListener('touchmove',function(e){sample(e,'move');},{capture:true,passive:false});
  document.addEventListener('touchend',function(e){sample(e,'end');},{capture:true,passive:false});
  document.addEventListener('touchcancel',cancel,true);
})(); true;`;
