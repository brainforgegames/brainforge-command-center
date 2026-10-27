import {readFile,writeFile,mkdir,rename,unlink,open,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function valid(s){
 if(s?.version!==1||!s.provenance?.source||!Number.isFinite(s.provenance.capturedAt)||!s.documents?.['settings/global']||!Object.keys(s.documents).some(k=>k.startsWith('projects/'))||!Object.keys(s.documents).some(k=>k.startsWith('tasks/'))||!Array.isArray(s.outbox))throw Error('Local database requires a valid saved settings/projects/tasks snapshot with provenance.');
 return s;
}
async function locked(file,fn){
 await mkdir(path.dirname(file),{recursive:true});const lock=file+'.lock',guard=lock+'.recovery';let handle;const token=randomUUID(),deadline=Date.now()+30000;
 while(!handle){
  if(Date.now()>deadline)throw Error('Local database lock unavailable; preserving saved state.');
  try{await readFile(guard+'/owner');await sleep(20);continue;}catch{}
  try{handle=await open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,token}));}
  catch(e){if(e.code!=='EEXIST')throw e;
   try{const owner=JSON.parse(await readFile(lock,'utf8'));let dead=false;try{process.kill(owner.pid,0);}catch(e){dead=e.code==='ESRCH';}
    if(dead){await mkdir(guard);try{await writeFile(guard+'/owner',String(process.pid));const current=JSON.parse(await readFile(lock,'utf8'));if(current.token===owner.token)await unlink(lock);}finally{await unlink(guard+'/owner').catch(()=>{});await rmdir(guard);}}
   }catch{}
   if(Date.now()>deadline)throw Error('Local database lock unavailable; preserving saved state.');await sleep(20);
  }
 }
 try{return await fn();}finally{await handle.close();const current=JSON.parse(await readFile(lock,'utf8'));if(current.token===token)await unlink(lock);}
}
async function save(file,state){const tmp=file+'.'+randomUUID()+'.tmp';const h=await open(tmp,'wx');try{await h.writeFile(JSON.stringify(state));await h.sync();}finally{await h.close();}await rename(tmp,file);}
export async function readLocalState(file){return valid(JSON.parse(await readFile(file,'utf8')));}
export async function mutateLocalState(file,fn){return locked(file,async()=>{const s=await readLocalState(file);const result=await fn(s);valid(s);await save(file,s);return result;});}
export async function seedLocalDatabase(file,seed){return locked(file,async()=>{try{await readFile(file);throw Error('Local database already exists; refusing snapshot overwrite.');}catch(e){if(e.code!=='ENOENT')throw e;}const s=valid({version:1,provenance:clone(seed.provenance),documents:clone(seed.documents),outbox:[]});await save(file,s);});}
const field=(data,key)=>key.split('.').reduce((v,k)=>v?.[k],data);
function assign(data,key,value){const bits=key.split('.');let at=data;for(const k of bits.slice(0,-1))at=at[k]??={};at[bits.at(-1)]=clone(value);}
function merge(a,b){for(const [k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]&&typeof a[k]==='object'?a[k]:{},v);else a[k]=clone(v);}return a;}
export function localDatabase(file){
 function doc(p){if(typeof p!=='string'||p.split('/').length%2||p.split('/').some(x=>!x))throw Error('Invalid document path');return {path:p,id:p.split('/').at(-1),get:()=>readLocalState(file).then(s=>snapshot(p,s)),set:(data,options)=>write([{type:'set',path:p,data,options}]),update:data=>write([{type:'update',path:p,data}]),create:data=>write([{type:'create',path:p,data}]),delete:()=>write([{type:'delete',path:p}])};}
 function snapshot(p,s){const data=s.documents[p];return {id:p.split('/').at(-1),exists:data!==undefined,ref:doc(p),data:()=>clone(data)};}
 function query(p,filters=[],orders=[],cap=Infinity){return {path:p,_query:true,_read:s=>{let rows=Object.keys(s.documents).filter(k=>k.startsWith(p+'/')&&k.split('/').length===p.split('/').length+1).map(k=>snapshot(k,s));for(const [key,op,value]of filters)rows=rows.filter(r=>{const a=key==='__name__'?r.id:field(r.data(),key);switch(op){case '==':return JSON.stringify(a)===JSON.stringify(value);case 'in':return value.includes(a);case '<=':return a<=value;case '>=':return a>=value;case '<':return a<value;case '>':return a>value;default:throw Error('Unsupported local query operator '+op);}});rows.sort((a,b)=>{for(const [key,dir]of orders){const x=key==='__name__'?a.id:field(a.data(),key),y=key==='__name__'?b.id:field(b.data(),key);if(x!==y)return (x<y?-1:1)*(dir==='desc'?-1:1);}return a.id.localeCompare(b.id);});rows=rows.slice(0,cap);return {docs:rows,empty:!rows.length,size:rows.length,forEach:fn=>rows.forEach(fn)};},where:(...f)=>query(p,[...filters,f],orders,cap),orderBy:(key,dir='asc')=>query(p,filters,[...orders,[key,dir]],cap),limit:n=>query(p,filters,orders,n),get:()=>readLocalState(file).then(s=>query(p,filters,orders,cap)._read(s))};}
 function apply(s,ops){const changes=[];for(const op of ops){const before=clone(s.documents[op.path]);if(op.type==='create'&&before!==undefined)throw Object.assign(Error('Document exists'),{code:6});if(op.type==='update'&&before===undefined)throw Object.assign(Error('Document missing'),{code:5});if(op.type==='delete')delete s.documents[op.path];else if(op.type==='update'){const next=clone(before);for(const [k,v]of Object.entries(op.data))assign(next,k,v);s.documents[op.path]=next;}else s.documents[op.path]=op.options?.merge?merge(clone(before)||{},op.data):clone(op.data);changes.push({...clone(op),before:before??null,after:clone(s.documents[op.path])??null});}if(changes.length)s.outbox.push({id:randomUUID(),at:Date.now(),mutations:changes});}
 const write=ops=>mutateLocalState(file,s=>apply(s,ops));
 return {doc,collection:p=>query(p),terminate:async()=>{},runTransaction:fn=>mutateLocalState(file,async s=>{const ops=[],tx={get:async ref=>ref._query?ref._read(s):snapshot(ref.path,s),set:(ref,data,options)=>ops.push({type:'set',path:ref.path,data,options}),update:(ref,data)=>ops.push({type:'update',path:ref.path,data}),create:(ref,data)=>ops.push({type:'create',path:ref.path,data}),delete:ref=>ops.push({type:'delete',path:ref.path})};const result=await fn(tx);apply(s,ops);return result;}),batch:()=>{const ops=[];return {set:(ref,data,options)=>ops.push({type:'set',path:ref.path,data,options}),update:(ref,data)=>ops.push({type:'update',path:ref.path,data}),delete:ref=>ops.push({type:'delete',path:ref.path}),commit:()=>write(ops)};}};
}
