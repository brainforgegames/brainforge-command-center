import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationRetry} from '../orchestrator/recovery.mjs';
test('temporary timeouts back off and stop after three retries',()=>{
 const e={passed:false,category:'timeout',timedOut:true};
 assert.deepEqual([0,1,2].map(n=>verificationRetry(e,n).delayMs),[120000,300000,900000]);
 assert.equal(verificationRetry(e,3),null);
});
test('failures and control stops never turn into automatic timeout retries',()=>{
 for(const category of ['product_assertion','mixed','process_access','missing_dependency','stopped','unknown']) assert.equal(verificationRetry({passed:false,category,timedOut:true}),null);
 assert.equal(verificationRetry({passed:true,category:'timeout',timedOut:true}),null);
});
