(() => {
  const frame=document.getElementById('project-editor'),status=document.getElementById('edit-state');
  const origin=new URL(frame.src).origin;
  const project=fetch('project').then(async response=>{
    if(!response.ok)throw Error('Reopen My Sites and sign in again.');
    return response.json();
  });
  async function send(){
    try{frame.contentWindow.postMessage({type:'retropage-open',project:await project,publish:new URLSearchParams(location.search).has('publish')},origin);}
    catch(error){status.textContent=error.message;}
  }
  window.addEventListener('message',event=>{
    if(event.origin!==origin || event.source!==frame.contentWindow)return;
    if(event.data?.type==='retropage-ready')send();
    if(event.data?.type==='retropage-opened')status.hidden=true;
  });
  frame.addEventListener('load',send);
})();
