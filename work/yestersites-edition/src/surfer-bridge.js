(() => {
  if (parent===window) return;
  const tell=(type,detail)=>parent.postMessage({surfer:type,...detail},'https://yestersites.com');
  const restore = yesterReadingPlace(place=>tell('reading-place',{url:location.href,place}));
  window.addEventListener('message',event=>{
    if(event.origin==='https://yestersites.com' && event.source===parent && event.data?.surfer==='restore-place'
        && event.data.url===location.href) restore(event.data.place);
  });
  const standby=new URL(location.href).searchParams.get('yester-standby')==='1';
  let active=!standby, counted=!standby;
  const embeds=new Map();
  function parkMedia(){
    for(const player of document.querySelectorAll('audio,video')){player.pause();player.muted=true;}
    for(const node of document.querySelectorAll('iframe[src],iframe[srcdoc]')){
      if(node.getAttribute('src')==='about:blank' && !node.hasAttribute('srcdoc'))continue;
      embeds.set(node,[node.getAttribute('src'),node.getAttribute('srcdoc')]);
      node.removeAttribute('srcdoc');node.src='about:blank';
    }
  }
  const observer=new MutationObserver(parkMedia);
  function setActive(value){
    active=value;
    if(active){
      observer.disconnect();
      for(const [node,[src,srcdoc]] of embeds){
        if(!node.isConnected)continue;
        if(srcdoc!==null)node.setAttribute('srcdoc',srcdoc);
        if(src!==null)node.setAttribute('src',src);else node.removeAttribute('src');
      }
      embeds.clear();
      if(!counted){
        counted=true;
        const url=new URL(location.href);url.searchParams.set('surfer','seen');
        new Image().src=url.href;
      }
    }else{
      parkMedia();observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcdoc']});
    }
  }
  if(standby)setActive(false);
  document.addEventListener('play',e=>{if(!active && e.target instanceof HTMLMediaElement){e.target.muted=true;e.target.pause();}},true);
  window.addEventListener('message',e=>{
    if(e.source===parent && e.origin==='https://yestersites.com' && e.data?.surfer==='page-state'){
      if(e.data.active===true || e.data.active===false)setActive(e.data.active);
    }
  });
  let lastActivity=-1000;
  function activity(){if(performance.now()-lastActivity>500){lastActivity=performance.now();tell('activity',{});}}
  for(const event of ['pointermove','pointerdown','keydown'])document.addEventListener(event,activity,{passive:true});
  tell('ready',{url:location.href,sound:document.querySelector('meta[name=yestersites-sound]')?.content||''});
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button!==0 || a.hasAttribute('download') || a.target==='_blank') return;
    const target=new URL(a.href);
    const localMember=target.origin===location.origin && target.pathname.startsWith('/members/');
    const sub=/^([a-z0-9-]{1,40})\.yestersites\.com$/.exec(target.hostname);
    const publicMember=target.protocol==='https:' && !target.port && !target.username && !target.password && sub &&
      !['www','android','retropage','mail','smtp','pop','imap','ftp','api','admin','accounts','studio','assets','ns1','ns2'].includes(sub[1]);
    if(!localMember && !publicMember){
      if(['http:','https:'].includes(target.protocol)){a.target='_blank';a.rel='noopener';}
      return;
    }
    // Content-Disposition controls these links; replacing the iframe discards the download.
    if(/\/bbs-files\/|(?:^|[-/])terminal\.(?:ans|pet)$/.test(target.pathname))return;
    e.preventDefault();tell('link',{url:target.href});
  });
  window.addEventListener('message',event=>{
    if(event.origin!=='https://yestersites.com' || event.source!==parent || event.data?.surfer!=='sound')return;
    for(const player of document.querySelectorAll('audio,video')){
      player.muted=event.data.muted===true || (player.autoplay && !event.data.enabled);
      if(event.data.enabled && player.autoplay)player.play().catch(()=>{});
    }
    if(!event.data.enabled && document.activeElement?.matches('.retro-player iframe')){
      const embed=document.activeElement;embed.src=embed.src;
    }
  });
  let viewerDrag=false, gesture=null;
  const controls='a,button,input,textarea,select,label,summary,video,audio,canvas,img,svg,iframe,embed,object,[draggable=true],[contenteditable]:not([contenteditable=false]),[role=button],[role=link],[role=slider],[role=application],.retro-player,.cartridge-stage,.ref-deck';
  function textHit(x,y){
    const caret=document.caretPositionFromPoint?.(x,y);
    const range=caret?null:document.caretRangeFromPoint?.(x,y);
    const node=caret?.offsetNode || range?.startContainer;
    if(node?.nodeType!==3)return false;
    const offset=caret?.offset ?? range.startOffset;
    const test=document.createRange();
    test.setStart(node,Math.max(0,offset-1));
    test.setEnd(node,Math.min(node.length,offset+1));
    return Array.from(test.getClientRects()).some(r=>x>=r.left && x<=r.right && y>=r.top && y<=r.bottom);
  }
  // Only a short, stationary press on the page background summons the browser keys.
  // Keep this separate from swipe recognition so it also works with swipes disabled.
  let tap=null;
  document.addEventListener('pointerdown',e=>{
    tap=null;
    if(!active || !e.isPrimary || e.button!==0 || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey ||
       document.fullscreenElement || e.target.closest?.(controls+',form,[onclick],[tabindex],details,dialog') ||
       textHit(e.clientX,e.clientY) || !window.getSelection()?.isCollapsed)return;
    tap={id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp};
  },true);
  document.addEventListener('pointermove',e=>{
    if(tap?.id===e.pointerId && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)tap=null;
  },{passive:true,capture:true});
  document.addEventListener('pointerup',e=>{
    const start=tap;tap=null;
    if(active && start?.id===e.pointerId && e.timeStamp-start.time<400 &&
       Math.hypot(e.clientX-start.x,e.clientY-start.y)<=8 && window.getSelection()?.isCollapsed)
      tell('blank-tap',{});
  },true);
  document.addEventListener('pointercancel',()=>{tap=null;},true);
  document.addEventListener('scroll',()=>{tap=null;},{passive:true,capture:true});
  function cancel(){
    if(gesture?.axis==='x')tell('page-drag',{phase:'cancel'});
    gesture=null;
  }
  window.addEventListener('message',e=>{
    if(e.source!==parent || e.origin!=='https://yestersites.com' || e.data?.surfer!=='page-gestures')return;
    cancel();viewerDrag=e.data.enabled===true;
  });
  function begin(e,p,mouse){
    cancel();
    if(!viewerDrag || document.fullscreenElement || e.target.closest?.(controls) ||
        (mouse && (textHit(p.clientX,p.clientY) || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)))return;
    let scroller=document.scrollingElement;
    for(let el=e.target;el && el!==document.body;el=el.parentElement){
      const css=getComputedStyle(el);
      if(css.touchAction==='none' || (el.scrollWidth>el.clientWidth+2 && /auto|scroll/.test(css.overflowX)))return;
      if(scroller===document.scrollingElement && el.scrollHeight>el.clientHeight+2 && /auto|scroll/.test(css.overflowY))scroller=el;
    }
    gesture={motionX:0,motionScale:null,clientX:p.clientX,x:p.screenX,y:p.screenY,start:performance.now(),mouse,scroller,top:scroller.scrollTop,axis:null,held:false};
    if(mouse)e.preventDefault();
  }
  function move(e,p,end){
    if(!gesture)return;
    const g=gesture,dx=p.screenX-g.x,dy=p.screenY-g.y,elapsed=performance.now()-g.start;
    if(g.mouse && !end)g.motionX+=p.movementX;
    if(!g.axis && Math.max(Math.abs(dx),Math.abs(dy))>=9){
      g.axis=Math.abs(dx)>Math.abs(dy)*1.25?'x':'y';
      g.held=elapsed>=350;
      // Calibrate mouse movement units against CSS pixels before the frame moves.
      if(g.mouse && g.axis==='x' && Number.isFinite(g.motionX) && g.motionX!==0){
        const scale=(p.clientX-g.clientX)/g.motionX;
        if(scale>0)g.motionScale=scale;
      }
    }
    if(g.axis==='x'){
      if(e.cancelable)e.preventDefault();
      // Touch screen coordinates and relative mouse motion survive a moving iframe.
      const dragX=g.mouse?(g.motionScale===null?undefined:g.motionX*g.motionScale):dx;
      tell('page-drag',{phase:end?'end':'move',dx,dragX,localDx:p.clientX-g.clientX,dy,elapsed,held:g.held});
    }else if(g.axis==='y' && g.mouse)g.scroller.scrollTop=g.top-dy;
    if(end)gesture=null;
  }
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse' || e.button!==0)return;
    begin(e,e,true);
    if(gesture)e.target.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{if(gesture?.mouse && e.pointerType==='mouse')move(e,e,false);});
  document.addEventListener('pointerup',e=>{if(gesture?.mouse && e.pointerType==='mouse')move(e,e,true);});
  document.addEventListener('lostpointercapture',()=>{if(gesture?.mouse)cancel();});
  window.addEventListener('blur',cancel);
  document.addEventListener('touchstart',e=>{
    if(e.touches.length===1)begin(e,e.touches[0],false);else cancel();
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(gesture && !gesture.mouse)move(e,e.changedTouches[0],false);
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(gesture && !gesture.mouse)move(e,e.changedTouches[0],true);
  },{passive:false});
  document.addEventListener('touchcancel',cancel);
  let start;
  document.addEventListener('touchstart',e=>{
    start=!viewerDrag && !e.target.closest?.('a,button,input,textarea,select,audio,video,iframe,.cartridge-stage,.retro-player,.ref-deck,[role=button],[contenteditable=true]') && e.touches.length===1 ? [e.touches[0].clientX,e.touches[0].clientY] : null;
  },{passive:true});
  document.addEventListener('touchcancel',()=>{start=null;});
  document.addEventListener('touchend',e=>{
    if (!start) return;
    const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1]; start=null;
    if (Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*2) tell('swipe',{forward:dx<0});
  },{passive:true});
})();
