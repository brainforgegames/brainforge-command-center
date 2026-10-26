import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation,parseRoute,routeHash} from '../src/navigation.js';
function browser(hash='') {
 const entries=['https://outside.example/',`https://example.com/bcc/?demo=1${hash}`];let index=1;const events={};
 const b={location:{},addEventListener:(name,fn)=>(events[name] ||= []).push(fn)};
 const sync=()=>{const url=new URL(entries[index]);b.location.hash=url.hash;b.location.href=url.href;};
 b.history={pushState:(_,__,hash)=>{entries.splice(++index);entries[index]=new URL(hash,b.location.href).href;sync();},replaceState:(_,__,hash)=>{entries[index]=new URL(hash,b.location.href).href;sync();}};
 b.go=delta=>{index+=delta;sync();for(const name of ['popstate','hashchange'])for(const fn of events[name]||[])fn();};
 b.editHash=hash=>{b.history.pushState(null,'',hash);for(const fn of events.hashchange||[])fn();};
 b.entries=entries;sync();return b;
}
test('every page round trips and private content never enters a route',()=>{
 for(const page of ['Today','Projects','Time split','Work board','Workers','Your help','Reports','Analytics','Screenshots','Ideas','Settings'])assert.equal(parseRoute(routeHash({page})).page,page);
 assert.equal(routeHash({page:'Ideas',secret:'private report',selectedIdea:'private-id'}),'#/ideas');
});
test('deep links and refresh preserve drilldown filters without adding entries',()=>{
 const hash='#/work?view=today&project=brainforge-company&status=review';const b=browser(hash),seen=[];
 createNavigation(b,r=>seen.push(r));assert.equal(b.entries.length,2);assert.equal(seen[0].statusFilter,'review');assert.equal(seen[0].projectFilter,'brainforge-company');
 assert.deepEqual(parseRoute(b.location.hash),parseRoute(hash));
 assert.equal(new URL(b.location.href).pathname,'/bcc/');assert.equal(new URL(b.location.href).search,'?demo=1');
 const refreshed=browser(b.location.hash);createNavigation(refreshed,r=>assert.deepEqual(r,seen[0]));assert.equal(refreshed.entries.length,2);
});
test('Back and Forward restore page and filters once per browser traversal',()=>{
 const b=browser(),seen=[],nav=createNavigation(b,r=>seen.push(r));
 nav.navigate({page:'Projects'});nav.navigate({page:'Work board',projectFilter:'sikhi-khoj',workView:'open'});nav.navigate({page:'Reports'});
 b.go(-1);assert.equal(seen.at(-1).projectFilter,'sikhi-khoj');assert.equal(seen.at(-1).workView,'open');assert.equal(seen.length,5);
 b.go(-1);assert.equal(seen.at(-1).page,'Projects');b.go(1);assert.equal(seen.at(-1).page,'Work board');b.go(1);assert.equal(seen.at(-1).page,'Reports');
});
test('same destination and data refresh do not add history; first Back can leave',()=>{
 const b=browser(),nav=createNavigation(b,()=>{});for(let i=0;i<10;i++)assert.equal(nav.navigate({page:'Today'}),false);
 assert.equal(b.entries.length,2);b.go(-1);assert.equal(new URL(b.location.href).host,'outside.example');
});
test('unknown and malformed routes safely replace current entry and manual hashes work',()=>{
 for(const hash of ['#/missing','javascript:alert(1)','#/%E0%A4%A']){const b=browser(hash);createNavigation(b,r=>assert.equal(r.page,'Today'));assert.equal(b.entries.length,2);assert.equal(b.location.hash,'#/today');}
 assert.equal(routeHash(parseRoute('#/work?view=no&status=no&project=%3Cscript%3E')),'#/work');
 const b=browser(),seen=[];createNavigation(b,r=>seen.push(r));b.editHash('#/screenshots?project=sikhi-khoj');assert.equal(seen.at(-1).previewFilter,'sikhi-khoj');b.go(-1);assert.equal(seen.at(-1).page,'Today');
});

test('Analytics participates in Back and Forward after the design integration',()=>{
 const b=browser(),seen=[],nav=createNavigation(b,r=>seen.push(r));
 nav.navigate({page:'Analytics'});assert.equal(b.location.hash,'#/analytics');
 nav.navigate({page:'Projects'});b.go(-1);assert.equal(seen.at(-1).page,'Analytics');
 b.go(1);assert.equal(seen.at(-1).page,'Projects');
 const refreshed=browser('#/analytics');createNavigation(refreshed,r=>assert.equal(r.page,'Analytics'));
});
