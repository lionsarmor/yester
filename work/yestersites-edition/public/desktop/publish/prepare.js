const encoder=new TextEncoder();
  function dataUri(bytes, type) {
    let binary = '';
    for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return 'data:image/'+type+';base64,'+btoa(binary);
  }
  // A fixed 216-colour cube leaves one independent transparent palette entry.
  // Frequent clear codes keep the LZW stream at nine bits throughout.
  async function classicGif(src,maxSide=256) {
    const photo = new Image(); photo.src=src; await photo.decode();
    const canvas=document.createElement('canvas');
    const scale=Math.min(1,maxSide/Math.max(photo.naturalWidth,photo.naturalHeight));
    canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
    const ctx=canvas.getContext('2d'); ctx.drawImage(photo,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const records=[...encoder.encode('GIF89a'),canvas.width&255,canvas.width>>8,canvas.height&255,canvas.height>>8,247,0,0];
    for(let i=0;i<256;i++) records.push((Math.floor(i/36)%6)*51,(Math.floor(i/6)%6)*51,(i%6)*51);
    records.push(33,249,4,1,0,0,255,0,44,0,0,0,0,canvas.width&255,canvas.width>>8,canvas.height&255,canvas.height>>8,0,8);
    const blocks=[]; let buffer=0,bits=0;
    const write=code=>{buffer|=code<<bits;bits+=9;while(bits>=8){blocks.push(buffer&255);buffer>>>=8;bits-=8;}};
    for(let i=0;i<pixels.length;i+=4) {
      if(i%880===0) write(256);
      write(pixels[i+3]<128 ? 255 : Math.round(pixels[i]/51)*36+Math.round(pixels[i+1]/51)*6+Math.round(pixels[i+2]/51));
    }
    write(257);if(bits)blocks.push(buffer&255);
    for(let i=0;i<blocks.length;i+=255){const part=blocks.slice(i,i+255);records.push(part.length,...part);}
    records.push(0,59);return Uint8Array.from(records);
  }
async function classicPicture(src){return dataUri(await classicGif(src),'gif');}
  async function hostedProject(doc){
    const copy=RetroModel.normalize(doc);
    for(const [,p] of RetroModel.pages(copy))for(const o of p.items){
      if(o.kind==='text' && o.font_family==='Lightning Display'){
        o.src=RetroModel.appearance(o);o.kind='image';o.font_family='Arial';
      }
      if(o.kind==='image' && o.src?.startsWith('data:image/png;')){
        o.classic_src=await classicPicture(o.src);
      }
    }
    return copy;
  }
