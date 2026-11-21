(() => {
  if (parent===window) return;
  const tell=(type,detail)=>parent.postMessage({surfer:type,...detail},'https://yestersites.com');
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
      !['www','retropage','mail','smtp','pop','imap','ftp','api','admin','accounts','studio','assets','ns1','ns2'].includes(sub[1]);
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
  let start;
  document.addEventListener('touchstart',e=>{
    start=!e.target.closest?.('a,button,input,textarea,select,audio,video,iframe,.cartridge-stage,.retro-player,.ref-deck,[role=button],[contenteditable=true]') && e.touches.length===1 ? [e.touches[0].clientX,e.touches[0].clientY] : null;
  },{passive:true});
  document.addEventListener('touchcancel',()=>{start=null;});
  document.addEventListener('touchend',e=>{
    if (!start) return;
    const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1]; start=null;
    if (Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*2) tell('swipe',{forward:dx<0});
  },{passive:true});
})();
