import assert from 'node:assert/strict';
import { createTrainingSession, recordTrainingSample, summarizeTrainingSession, LINE_TOUCH_REARM_CLEAR_SEC } from './session.mjs';

const state={rearX:0,rearZ:0,yaw:0,speed:0,steer:0,gear:'R'};
const sample=(t,lineTouch)=>({t,state,lineTouch,parkingSuccess:false,deviation:{lateral:0,headingErrorDeg:0}});

assert.equal(LINE_TOUCH_REARM_CLEAR_SEC,0.25,'touch episode re-arm window should remain explicit and testable');

{
  const s=createTrainingSession(state,0);
  recordTrainingSample(s,sample(0,true));
  recordTrainingSample(s,sample(0.10,false));
  recordTrainingSample(s,sample(0.20,true));
  assert.equal(s.lineTouchEvents,1,'a 100 ms SAT boundary flicker must remain the same touch episode');
  assert.equal(summarizeTrainingSession(s).penalties.lineTouch,25,'boundary flicker must not add another 25-point penalty');
}

{
  const s=createTrainingSession(state,0);
  recordTrainingSample(s,sample(0,true));
  recordTrainingSample(s,sample(0.10,false));
  recordTrainingSample(s,sample(0.36,true));
  assert.equal(s.lineTouchEvents,2,'a touch after at least 250 ms clearly off-line should count as a new episode even without an intermediate sample');
}

{
  const s=createTrainingSession(state,0);
  recordTrainingSample(s,sample(0,true));
  recordTrainingSample(s,sample(0.10,false));
  recordTrainingSample(s,sample(0.35,false));
  assert.equal(s.lineTouchArmed,true,'sustained clear observations should re-arm touch counting');
  recordTrainingSample(s,sample(0.36,true));
  assert.equal(s.lineTouchEvents,2,'a genuinely separate second collision should still be counted');
  assert.equal(summarizeTrainingSession(s).penalties.lineTouch,50,'two separate touch episodes should retain the existing 50-point penalty cap');
}

{
  const s=createTrainingSession(state,0);
  recordTrainingSample(s,sample(0,false));
  recordTrainingSample(s,sample(0.10,true));
  assert.equal(s.lineTouchEvents,1,'the first real touch must always count immediately');
}

console.log('line-touch-episode-tests: all assertions passed');