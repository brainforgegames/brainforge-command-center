import test from 'node:test';
import assert from 'node:assert/strict';
import {boardColumns,boardStatus,boardCard,syncLabel} from '../src/board.js';
import {initialState} from '../src/domain.js';
import {localBoardSnapshot,boardMiddleware} from '../orchestrator/board-view.mjs';
import {seedLocalDatabase,localDatabase} from '../orchestrator/local-database.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('four lists retain legacy unfinished tasks without changing records or counting drafts done',()=>{
 const s=initialState();s.tasks=['queued','backlog','ready','draft','running','blocked','review','verify','done','unknown'].map((status,i)=>({id:String(i),projectId:'sikhi-khoj',status}));
 const original=structuredClone(s.tasks), columns=boardColumns(s);
 assert.deepEqual(columns.map(c=>c.label),['To do','Blocked','In review','Done']);
 assert.equal(columns.flatMap(c=>c.tasks).length,s.tasks.length);
 assert.deepEqual(columns.find(c=>c.id==='done').tasks.map(t=>t.status),['done']);
 assert.equal(boardStatus({status:'unknown'}),'blocked');assert.deepEqual(s.tasks,original);
 assert.equal(boardStatus({status:'running'}),'queued');
 assert.ok(columns.find(c=>c.id==='queued').tasks.some(t=>t.status==='running'));
 assert.equal(boardColumns(s,'all','all','review').flatMap(c=>c.tasks).length,2);
});
test('project filters and priority order keep parked work visible and last',()=>{
 const s=initialState();s.projects.find(p=>p.id==='drivenix').enabled=false;
 s.tasks=[{id:'low',projectId:'sikhi-khoj',status:'queued',priority:1},{id:'parked',projectId:'drivenix',status:'queued',priority:3},{id:'high',projectId:'sikhi-khoj',status:'queued',priority:3}];
 assert.deepEqual(boardColumns(s)[0].tasks.map(t=>t.id),['high','low','parked']);
 assert.deepEqual(boardColumns(s,'all','drivenix')[0].tasks.map(t=>t.id),['parked']);
 assert.equal(boardColumns(s,'open').find(c=>c.id==='done').tasks.length,0);
});
test('cards expose useful task details and never offer status mutation controls',()=>{
 const s=initialState(),t={id:'task',projectId:'sikhi-khoj',status:'review',title:'Useful result',acceptance:'One deliverable',dependencies:['before'],workerLane:'lane-1',history:[{status:'queued'}]};
 const html=boardCard(s,t,v=>String(v??'').replaceAll('<','&lt;'));
 for(const text of ['Manual work','One deliverable','before','Task ID','Technical detail and history','Short result'])assert.ok(html.includes(text));
 assert.ok(!html.includes('draggable'));assert.ok(!html.includes('<button'));
 assert.match(syncLabel(null,'firebase'),/updated on request/);
});
test('board reads the durable queue after restart with IDs, history and pending results intact',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bcc-board-')),file=path.join(dir,'queue.json');
 try {
  await seedLocalDatabase(file,{provenance:{source:'test',capturedAt:1},documents:{'settings/global':{workerEnabled:true},'projects/a':{enabled:true,weight:100},'tasks/one':{title:'Original',status:'queued',history:['saved'],ownerToken:'private',worktree:'private-path'},'coordination/runtime':{claims:{one:{token:'secret'}}}}});
  await localDatabase(file).doc('tasks/one').update({status:'review',result:'Saved result'});
  const a=await localBoardSnapshot(file),b=await localBoardSnapshot(file);
  assert.deepEqual(a.tasks,b.tasks);assert.equal(a.tasks[0].id,'one');assert.deepEqual(a.tasks[0].history,['saved']);assert.equal(a.tasks[0].result,'Saved result');
  assert.equal(a.queueSync.pending,1);assert.equal(a.queueSync.lastSuccessAt,null);assert.ok(!JSON.stringify(a).includes('private'));assert.ok(!JSON.stringify(a).includes('secret'));
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('loopback queue endpoint rejects foreign origins, foreign hosts and writes',async()=>{
 for(const req of [{method:'GET',headers:{host:'evil.example'}},{method:'GET',headers:{host:'localhost:5173',origin:'https://evil.example'}},{method:'POST',headers:{host:'localhost:5173'}}]) {
  let status;await boardMiddleware('absent')({...req,socket:{remoteAddress:'127.0.0.1'},url:'/api/local-board'},{writeHead:n=>status=n,end(){}},()=>assert.fail('must not fall through'));
  assert.ok([403,405].includes(status));
 }
});

test('board orders projects by saved share before task priority and labels extended priorities',()=>{
 const s=initialState();s.projects=[{id:'sikhi',name:'Sikhi',enabled:true,weight:90},{id:'bcc',name:'BCC',enabled:true,weight:10},{id:'parked',name:'Parked',enabled:false,weight:0}];
 s.tasks=[{id:'bcc-high',projectId:'bcc',status:'queued',priority:9},{id:'sikhi-low',projectId:'sikhi',status:'queued',priority:1},{id:'sikhi-high',projectId:'sikhi',status:'queued',priority:8},{id:'parked',projectId:'parked',status:'queued',priority:100}];
 assert.deepEqual(boardColumns(s)[0].tasks.map(t=>t.id),['sikhi-high','sikhi-low','bcc-high','parked']);
 const html=boardCard(s,s.tasks[0],v=>String(v??''));assert.match(html,/Priority 9/);assert.ok(!html.includes('Priority unset'));
});

test('blocked cards show the short owner issue and keep raw diagnostic text in optional details',()=>{
 const s=initialState(),raw='Long technical diagnostic '.repeat(30);
 const html=boardCard(s,{id:'blocked',projectId:'sikhi-khoj',status:'blocked',blockedReason:raw,ownerUpdate:{issue:'Sign-in needs another check.'}},v=>String(v??''));
 const summary=html.split('<details')[0];assert.match(summary,/Sign-in needs another check\./);assert.ok(!summary.includes('Long technical diagnostic'));
 assert.ok(html.includes(raw));assert.ok(html.indexOf(raw)>html.indexOf('Technical detail and history'));
 const fallback=boardCard(s,{id:'blocked',projectId:'sikhi-khoj',status:'blocked',blockedReason:raw},v=>String(v??''));assert.ok(!fallback.split('<details')[0].includes('Long technical diagnostic'));
});

 test('manual board hides worker telemetry and supplies safe review links',()=>{
 const s=initialState();s.worker={workers:{'lane-1':{taskId:'a',status:'Working: old task',lastSeen:Date.now()}}};
 const t={id:'a',projectId:'sikhi-khoj',status:'review',workerLane:'lane-1',pr:'https://github.com/brainforgegames/Sikhi_Khoj/pull/14'};
 const html=boardCard(s,t,String);
 assert.match(html,/View the change/);assert.match(html,/rel="noopener noreferrer"/);
 assert.doesNotMatch(html,/lane-1|Active now|Unassigned/);
 for(const pr of ['javascript:alert(1)','https://github.com.evil.example/pull/1','https://secret@github.com/a/b']) assert.doesNotMatch(boardCard(s,{...t,pr},String),/View the change/);
 });
