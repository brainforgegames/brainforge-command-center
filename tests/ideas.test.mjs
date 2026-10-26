import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIdea,ideaRows,conceptVisual,ideaCards,ideaDialog,ideasPage} from '../src/ideas.js';
const proposal={id:'sample-concept',projectId:'brainforge-company',name:'Sample puzzle',hook:'A synthetic example for layout checks.',mechanicKey:'light-fold',stage:'proposal',playSteps:['Choose a piece.','Try a move.'],whyItMayWork:['Easy to explain.'],risks:['The challenge may be too simple.'],firstTest:'Try a paper version.',recommendation:true,updatedAt:1};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('private idea schema rejects unsupported mechanics, stages and unbounded text',()=>{
 assert.equal(validateIdea(proposal).name,'Sample puzzle');
 for(const invalid of [{...proposal,id:'"><script>'},{...proposal,projectId:'sikhi-khoj'},{...proposal,stage:'released'},{...proposal,mechanicKey:'<svg>'},{...proposal,playSteps:[]},{...proposal,firstTest:'x'.repeat(401)}])assert.throws(()=>validateIdea(invalid));
 assert.deepEqual(ideaRows([null,{name:'bad'},proposal]),[validateIdea(proposal)]);
});
test('each generic concept visual illustrates two distinct labelled states without external assets',()=>{
 for(const key of ['light-fold','movable-track','counterweight']){
  const start=conceptVisual(key),next=conceptVisual(key,true);assert.notEqual(start,next);assert.match(start,/role="img"/);assert.match(start,/aria-label=/);assert.ok(!/href=|<script|<image|foreignObject/.test(start+next));
 }
 assert.equal(conceptVisual('unknown'),'');
});
test('semantic cards and focused detail escape private copy and label concept status honestly',()=>{
 const row={...proposal,name:'<img src=x onerror=evil()>',hook:'Sample "hook"'};
 const card=ideaCards([row],esc,()=> 'Today');assert.match(card,/<button class="idea-card/);assert.match(card,/&lt;img/);assert.ok(!card.includes('<img'));
 const dialog=ideaDialog(row,esc);assert.match(dialog,/<dialog/);assert.match(dialog,/aria-labelledby="idea-dialog-title"/);assert.match(dialog,/not a built game/);assert.match(dialog,/How to play/);assert.match(dialog,/The first test/);
 assert.match(ideasPage([],esc,()=>'',false),/No visual ideas shared yet/);assert.match(ideasPage([],esc,()=>'',true),/Loading your ideas/);
});
