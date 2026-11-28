import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../github-pages/browse/feed.js',import.meta.url),'utf8');
const Feed=runInNewContext(source+'\nNeighborhoodFeed');
const catalog=new Map(Array.from({length:12},(_,i)=>{
  const base='club'+String(i).padStart(2,'0');
  return [base,{base,listed:i!==11,playable:i%2===1,subjects:['radio'],creatorKey:'creator'+(i%3),updated:0}];
}));
const tuning={skips:['club09'],likes:[]};
for(const mode of ['all','playable','ring']){
  const feed=new Feed(catalog,mode,tuning);
  const count=mode==='playable'?4:10,visits=[];
  let here;
  for(let i=0;i<count;i++){
    const plan=feed.plan(here);
    assert.equal(new Set(plan).size,plan.length);
    assert.equal(feed.plan(here)[0],plan[0]);
    const next=plan[0];
    assert.ok(catalog.get(next)?.listed);assert.notEqual(next,'club09');
    if(mode==='playable')assert.ok(catalog.get(next).playable);
    if(mode==='ring' && here)assert.ok(next>here);
    visits.push(next);feed.visited(next);here=next;
  }
  assert.equal(new Set(visits).size,count);
  assert.notEqual(feed.plan(here)[0],here);
}
console.log('Passed shuffle, games, and ring discovery rounds.');
