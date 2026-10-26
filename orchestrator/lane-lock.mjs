import { open, readFile, unlink } from 'node:fs/promises';
export async function acquireLaneLock(lockPath, pid=process.pid, probe=(p)=>process.kill(p,0)) {
 let lock;
 try { lock=await open(lockPath,'wx'); }
 catch(e) {
  if(e.code!=='EEXIST') throw e;
  // Serialize stale-lock recovery, so two launchers cannot unlink a new owner's lock.
  const recovery=await open(lockPath+'.recovery','wx').catch(()=>{throw Error('Lane lock recovery in progress; inspect any abandoned recovery file locally.');});
  try {
   const oldPid=Number((await readFile(lockPath,'utf8')).trim());
   if(!Number.isSafeInteger(oldPid)||oldPid<1) throw Error('Unrecognized worker lock; inspect locally.');
   try { probe(oldPid); throw Error('Worker lane is already running.'); }
   catch(check) {if(check.code!=='ESRCH') throw check;}
   await unlink(lockPath); lock=await open(lockPath,'wx');
   await lock.writeFile(String(pid));
  } finally {await recovery.close();await unlink(lockPath+'.recovery');}
  return lock;
 }
 await lock.writeFile(String(pid)); return lock;
}
