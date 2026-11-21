import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {route} from './router.mjs';
const server=createServer(async(input,output)=>{
  try{
    const host=input.headers.host||'';
    if(!/^[a-z0-9.-]+(?::\d+)?$/.test(host)||!input.url.startsWith('/')||input.url.startsWith('//')){output.writeHead(400).end();return;}
    const ctrl=new AbortController();output.on('close',()=>{if(!output.writableEnded)ctrl.abort();});
    const init={method:input.method,headers:new Headers(),signal:ctrl.signal};
    for(const key of ['origin','content-type','accept','range','if-range'])if(typeof input.headers[key]==='string')init.headers.set(key,input.headers[key]);
    if(input.method==='POST'){init.body=Readable.toWeb(input);init.duplex='half';}
    const response=await route(new Request('https://'+host+input.url,init));
    output.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body)await pipeline(Readable.fromWeb(response.body),output);else output.end();
  }catch{if(!output.headersSent)output.writeHead(502);output.end();}
});
server.requestTimeout=30000;
server.listen(8137,'127.0.0.1');
