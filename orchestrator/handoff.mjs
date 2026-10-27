/** Drain terminal task handoffs in one scheduled invocation; never spin on waiting work. */
export async function runHandoffs(step, {maxSteps=8, deadline=Date.now()+45*60000, clock=Date.now}={}) {
  for(let index=0;index<maxSteps;index++) {
    if(clock()>=deadline)return 'deadline';
    if(!await step())return 'waiting';
  }
  return 'bounded';
}
