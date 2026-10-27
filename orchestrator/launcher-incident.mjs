import {readFile} from 'node:fs/promises';
import {recordIncident} from './incidents.mjs';
const [root,lane]=process.argv.slice(2);
if(!['lane-1','lane-2','legacy'].includes(lane))throw Error('Invalid lane');
const input=JSON.parse(await new Promise(resolve=>{let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>resolve(s));}));
let cp={};try{cp=JSON.parse(await readFile(`${root}/.local/lanes/${lane}/checkpoint.json`,'utf8'));}catch{}
const text=String(input.message||'Worker exited unexpectedly.');
if(/Worker lane is already running|Lane lock recovery in progress/.test(text)){console.log(JSON.stringify({retry:false,expected:true}));process.exit(0);}
const category=/permission denied|unauthenticated|invalid authentication/i.test(text)?'security':/Quota exceeded/.test(text)?'quota':/EPERM.*rename|EBUSY.*rename|sharing violation/i.test(text)?'snapshot-contention':'launcher-error';
const event=await recordIncident(root,{lane,taskId:cp.task?.id||null,category,message:text});
console.log(JSON.stringify({retry:category==='snapshot-contention'&&event.occurrences<=3,expected:event.expected}));
