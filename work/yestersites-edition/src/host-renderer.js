const hostRender = (()=>{
  const M={fonts:desktopFonts};
  const editions = ['modern','phone','classic','text'];
  const encoder = new TextEncoder();
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const file = (id, ed='') => (id === 'home' ? ed || 'index' : 'page-'+id+(ed ? '-'+ed : ''))+'.html';
  const labels = {modern:'Desktop',phone:'Phone',classic:'Classic',text:'Text only'};
  const navSigns = new Set(['/','|','·','•','»','›','–','-']);
  function rows(page, backdrop) {
    const rows=[];
    for(const o of page.items.filter(o=>o!==backdrop).sort((a,b)=>a.y-b.y||a.x-b.x)){
      const row=rows[rows.length-1];
      if(row&&o.y<Math.min(...row.map(p=>p.y+p.h/2))&&row.every(p=>o.x>=p.x+p.w||p.x>=o.x+o.w))row.push(o);
      else rows.push([o]);
    }
    return rows.map(row=>row.sort((a,b)=>a.x-b.x));
  }
  const boardCss='.board{position:relative;width:100%;margin:auto;overflow:hidden}.object{position:absolute;box-sizing:border-box;overflow:hidden;pointer-events:none;line-height:normal;overflow-wrap:anywhere}.object img{display:block;width:100%;height:100%}.object a{display:block;width:100%;height:100%;color:inherit;pointer-events:auto}';
  const phoneCss='.phone{max-width:42rem;margin:auto;padding:1rem;box-sizing:border-box;min-height:70vh;overflow-wrap:anywhere;line-height:1.45}.phone p{margin:0 0 1rem}.phone img{max-width:100%;height:auto;vertical-align:middle}.phone a{display:inline-block;min-height:44px;align-content:center;color:inherit}.navlinks{display:flex;flex-wrap:wrap;gap:0 .45em;align-items:center}';
  function render(page,id,edition,media,names=file) {
    const hasMedia=o=>media.has(o.id);
    const first=page.items[0], backdrop=first&&first.kind==='image'&&first.src&&!first.text.trim()&&!first.href&&!first.x&&!first.y&&first.w===page.width&&first.h===page.height?first:null;
    const [r,g,b]=page.background.slice(1).match(/../g).map(x=>parseInt(x,16));
    const ink=r*299+g*587+b*114>145000?'#161616':'#f8f7ee';
    function link(o,body){
      const href=o.href.startsWith('page:')?names(o.href.slice(5),edition):o.href;
      return href ? '<a href="'+escape(href)+'">'+(body||escape(o.text||href))+'</a>':body;
    }
    function content(o,layout) {
      if(RetroCraft.isCraft(o))return RetroCraft.render(o,layout);
      const text=escape(o.text).replace(/\r?\n/g,'<br>');
      if(o.widget==='bbs-art'||o.widget==='bbs-files')return '<tt>'+text.replace(/ /g,'&nbsp;')+'</tt>';
      if(layout==='text'&&o.kind==='image')return text?'[Image: '+text+']':'';
      if(layout!=='text'&&hasMedia(o))return '<img src="'+media.get(o.id)[Number(layout==='classic')]+'" width="'+o.w+'" height="'+o.h+'" border="0" alt="'+escape(o.text)+'">';
      return text;
    }
    function style(o){return 'text-align:'+o.align+';font-family:'+M.fonts[o.font_family]+';color:'+o.color+';font-weight:'+(o.bold?'bold':'normal')+';font-style:'+(o.italic?'italic':'normal')+';';}
    const drawPanel=(o,layout)=>RetroMedia.panel(o,layout,key=>names(key,edition));
    function board(){
      let html='<div class="board" style="max-width:'+page.width+'px;background:'+page.background+'"><div style="padding-top:'+100*page.height/page.width+'%"></div>';
      for(const [index,o] of page.items.entries()){
        const css=style(o)+'left:'+100*o.x/page.width+'%;top:'+100*o.y/page.height+'%;width:'+100*o.w/page.width+'%;height:'+100*o.h/page.height+'%;z-index:'+(index+1)+';background:'+(o.kind==='rule'?o.color:o.fill||'transparent')+';font-size:'+o.font_size+'px;font-size:min('+o.font_size+'px,'+100*o.font_size/page.width+'vw);'+(o.kind==='box'?'box-shadow:inset 0 0 0 1px '+o.color:'');
        html+='<div class="object rp-'+o.kind+'" style="'+escape(css)+'">'+(RetroMedia.isPanel(o)?drawPanel(o,'modern'):RetroMedia.isPlayer(o)?RetroMedia.render(o,'modern'):link(o,content(o,'modern')))+'</div>';
      }return html+'</div>';
    }
    function flow(layout){
      let html=layout==='text'?'<h1>'+escape(page.title)+'</h1>':'';
      for(const row of rows(page,backdrop)){
        const parts=[];
        for(const o of row){
          if((layout==='text'||layout==='classic') && RetroCraft.hasFallback(o,layout)){
            parts.push([o,RetroCraft.fallback(o,layout,media.get(o.id)?.[2])]);continue;
          }
          if(RetroCraft.isCraft(o)){parts.push([o,RetroCraft.render(o,layout)]);continue;}
          if (RetroMedia.isPanel(o)){const html=drawPanel(o,layout);if(html)parts.push([o,html]);continue;}
          if (RetroMedia.isPlayer(o)){parts.push([o,RetroMedia.render(o,layout)]);continue;}
          let body=content(o,layout);
          if(o.kind==='rule'){parts.push([o,layout==='phone'?'<hr class="rp-rule">':'<hr>']);continue;}
          if(!body&&!o.href)continue;
          if(layout==='classic'){
            const levels=[10,13,16,18,24,32,48],delta=levels.map(s=>Math.abs(s-o.font_size));
            if(o.bold)body='<b>'+body+'</b>';if(o.italic)body='<i>'+body+'</i>';
            body='<font color="'+o.color+'" face="'+escape(M.fonts[o.font_family])+'" size="'+(1+delta.indexOf(Math.min(...delta)))+'">'+(body||escape(o.href))+'</font>';
          }
          body=link(o,body);
          if(layout==='phone')body='<span class="rp-'+o.kind+'" style="'+escape(style(o)+'font-size:'+Math.max(16,Math.min(56,o.font_size))+'px;background:'+(o.fill||'transparent'))+'">'+body+'</span>';
          parts.push([o,body]);
        }
        if(row.length>1&&row.some(o=>o.href)&&row.every(o=>o.href||navSigns.has(o.text.trim())))html+='<p class="navlinks">'+parts.map(p=>p[1]).join(' ')+'</p>';
        else if(layout==='classic'&&parts.length>1)html+='<table border="0" cellpadding="4" cellspacing="0"><tr>'+parts.map(([o,x])=>'<td valign="top" align="'+o.align+'">'+x+'</td>').join('')+'</tr></table>';
        else html+=parts.map(([o,x])=>o.kind==='rule'?x:'<p align="'+(layout==='phone'&&hasMedia(o)?'center':o.align)+'">'+x+'</p>').join('');
      }
      if(layout==='classic')return '<center><table border="0" cellpadding="6" cellspacing="0" width="'+Math.min(600,page.width)+'"><tr><td>'+html+'</td></tr></table></center>';
      if(layout==='phone')return '<article class="phone">'+html+'</article>';
      return html;
    }
    const layout=edition|| (page.profile==='text'?'text':'auto');
    const old=layout==='classic'||layout==='text';
    const choices=names===file?editions:['classic','text'];
    const footer='<div class="editions"><hr><p>'+(page.byline?escape(page.byline)+' &middot; ':'')+choices.filter(e=>e!==edition).map(e=>'<a href="'+names(id,e)+'">'+labels[e]+'</a>').join(' | ')+'</p></div>';
    let css='',attrs='';
    if(layout==='classic')attrs=' bgcolor="'+page.background+'" text="'+ink+'" link="'+ink+'" vlink="'+ink+'"'+(backdrop?' background="'+media.get(backdrop.id)[1]+'"':'');
    if(!old){
      css='body{margin:0;background-color:'+page.background+';color:'+ink+';'+(backdrop?'background-image:url('+media.get(backdrop.id)[0]+');background-position:center top;background-size:'+page.width+'px '+page.height+'px':'')+'}.editions{box-sizing:border-box;margin:auto;max-width:'+page.width+'px;padding:.3em .75em;font:13px/1.5 Arial,sans-serif}.editions a{color:inherit}'+boardCss+phoneCss;
      if(layout==='auto')css+='.phone{display:none}@media(max-width:600px){.phone{display:block}.board{display:none}}';
    }
    const hasPlayers=page.items.some(o=>RetroMedia.isPlayer(o)||RetroMedia.isFrame(o)||RetroCraft.isCraft(o));
    if(!old && page.items.some(RetroMedia.isPanel))css+=RetroMedia.panelCss;
    if(!old && hasPlayers)css+=RetroMedia.css;
    if(!old && page.items.some(o=>RetroCraft.isCraft(o)))css+=RetroCraft.css;
    if(layout==='auto' && hasPlayers)css+='@media(max-width:600px){.board{display:flex;flex-direction:column;gap:8px;padding:8px;box-sizing:border-box}.board>div:first-child{display:none}.board>.object{position:static;width:100%!important;height:auto!important;font-size:16px!important}.board .retro-player.video :is(video,iframe){min-height:220px}.board .object img{width:auto;max-width:100%;height:auto}}';
    if(!old && page.pageStyles)css+=RetroCraft.pageCSS(page.pageStyles);
    const controls=!old && page.items.some(o=>o.widget==='game-cartridge' || RetroMedia.isPlayer(o) && (o.widget==='video-player' || o.playerSkin && o.playerSkin!=='deck'))?'<script>'+RetroMedia.script+'</script>':'';
    const body=layout==='auto'?(hasPlayers?board():board()+flow('phone')):layout==='modern'?board():flow(layout);
    return '<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escape(page.title)+'</title>'+(css?'<style>'+css+'</style>':'')+'</head><body'+attrs+'>'+body+footer+controls+'</body></html>';
  }
  return render;
})();
