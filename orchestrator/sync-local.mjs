import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from './database.mjs';
import {syncOnce} from './offline-sync.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await readFile(path.join(root,'worker.config.json'),'utf8'));
const cloud=database(cfg.firebaseProjectId,cfg.credentialMode);
try{
 const result=await syncOnce(cloud,path.join(root,'.local/offline-queue.json'),{limit:20});
 await writeFile(path.join(root,'.local/offline-sync-status.json'),JSON.stringify({...result,at:Date.now()}));
 if(result.status==='deferred')await writeFile(path.join(root,'.local/database-cooldown.json'),JSON.stringify({retryAt:Date.now()/1000+1800,reason:result.reason}));
}catch(error){
 if(error.offlineSecurityFailure)await writeFile(path.join(root,'.local/offline-security-stop.json'),JSON.stringify({at:Date.now(),reason:'Cloud authentication or permissions changed. Review access before continuing.'}));
 console.error(error.message);process.exitCode=1;
}finally{await cloud.terminate();}
