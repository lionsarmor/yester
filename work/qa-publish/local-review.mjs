/* Browser fixture. Authenticates only against a disposable in-memory local service. */
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {extname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {memoryD1} from './d1.mjs';
const checkout = new URL('../yestersites-edition/',import.meta.url);
const editor = new URL('../retro-page-web/',import.meta.url);
const stage=mkdtempSync(join(tmpdir(),'retro-review-'));
copyFileSync(process.env.RETRO_TEST_WORKER || new URL('dist/server/index.js',checkout),join(stage,'worker.mjs'));
const worker=(await import(pathToFileURL(join(stage,'worker.mjs')))).default;
const env={DB:memoryD1(new URL('drizzle/',checkout))};
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json','.gif':'image/gif'};
const server=createServer(async(req,res)=>{
  try{
    const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base);
    if(url.pathname.startsWith('/editor/')){
      const name=url.pathname.slice(8)||'index.html';
      const path=new URL(name,editor);
      if(!path.href.startsWith(editor.href))throw Error('not in app');
      res.writeHead(200,{'content-type':types[extname(name)]||'application/octet-stream'});
      res.end(readFileSync(path));return;
    }
    const body=[];for await(const chunk of req)body.push(chunk);
    const headers=new Headers(req.headers);
    headers.set('oai-authenticated-user-id','fixture-author');
    headers.set('oai-authenticated-user-email','fixture@example.invalid');
    const response=await worker.fetch(new Request(url,{method:req.method,headers,
      body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)}),env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(err){res.writeHead(500);res.end(String(err));}
});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
process.on('SIGTERM',()=>{server.close();rmSync(stage,{recursive:true,force:true});process.exit(0);});
