import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample,summarizeTrainingSession,scoreTrainingMetrics} from './session.mjs';
import {resetReplayRuntime} from './replay-runtime.mjs';

resetReplayRuntime();
const s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,{t:0,state:{rearX:0,rearZ:0,yaw:Math.PI,speed:0,steer:0,gear:'R'},deviation:{lateral:0,headingErrorDeg:0}});
recordTrainingSample(s,{t:Number.NaN,state:{rearX:Number.NaN,rearZ:Infinity,yaw:Number.NaN,speed:Number.NaN,steer:Number.NaN,gear:'R'},deviation:{lateral:Number.NaN,headingErrorDeg:Infinity}});
recordTrainingSample(s,{t:2,state:{rearX:.2,rearZ:-.2,yaw:Math.PI,speed:-.2,steer:.1,gear:'R'},deviation:{lateral:.1,headingErrorDeg:3}});

assert.equal(s.samples.length,3);
for(const sample of s.samples){
  for(const key of ['t','rearX','rearZ','yaw','speed','steer','lateral','headingErrorDeg']){
    assert.ok(Number.isFinite(sample[key]),`${key} must be finite after recording`);
  }
}
assert.ok(s.samples[1].t>=s.samples[0].t,'sanitized timestamp must stay monotonic');

const summary=summarizeTrainingSession(s);
for(const key of ['score','durationSec','distanceM','maxLateralM','maxHeadingErrorDeg','maxSpeedKmh','totalPenalty']){
  assert.ok(Number.isFinite(summary[key]),`${key} must remain finite after a corrupted sample`);
}
assert.ok(summary.score>=0&&summary.score<=100);

const scoring=scoreTrainingMetrics({lineTouchEvents:Number.NaN,maxLateralM:Infinity,maxHeadingErrorDeg:Number.NaN,maxSpeedKmh:Infinity,steeringDirectionChanges:Number.NaN,completed:false});
assert.ok(Number.isFinite(scoring.score));
assert.ok(Number.isFinite(scoring.totalPenalty));
for(const value of Object.values(scoring.penalties))assert.ok(Number.isFinite(value));

console.log('session-corruption-tests: all assertions passed');
