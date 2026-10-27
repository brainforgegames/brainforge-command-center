import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceSnapshot} from '../orchestrator/local-database.mjs';
test('temporary Windows snapshot contention retries without removing original',async()=>{
 let calls=0;const delays=[];
 await replaceSnapshot('pending','original',async(a,b)=>{assert.equal(a,'pending');assert.equal(b,'original');if(++calls<3)throw Object.assign(Error('sharing'),{code:'EPERM'});},async n=>delays.push(n));
 assert.equal(calls,3);assert.deepEqual(delays,[25,50]);
});
test('permanent permission failures are bounded and other errors are immediate',async()=>{
 let calls=0;await assert.rejects(replaceSnapshot('a','b',async()=>{calls++;throw Object.assign(Error('denied'),{code:'EACCES'});},async()=>{}));assert.equal(calls,8);
 calls=0;await assert.rejects(replaceSnapshot('a','b',async()=>{calls++;throw Object.assign(Error('disk full'),{code:'ENOSPC'});},async()=>{}));assert.equal(calls,1);
});
