import assert from 'node:assert/strict';
import {VEHICLE} from './physics.mjs';
import {SPEED_FREE_KMH,SPEED_ADVICE_KMH,scoreTrainingMetrics,createTrainingSession,recordTrainingSample,summarizeTrainingSession} from './session.mjs';

const reverseMaxKmh=VEHICLE.reverseSpeed*3.6;
const forwardMaxKmh=VEHICLE.forwardSpeed*3.6;
assert.ok(SPEED_FREE_KMH<reverseMaxKmh,'free-speed threshold must sit inside the attainable reverse-speed range');
assert.ok(SPEED_ADVICE_KMH<reverseMaxKmh,'advice threshold must be reachable during normal reverse driving');

const ideal=scoreTrainingMetrics({maxSpeedKmh:SPEED_FREE_KMH,completed:true});
assert.equal(ideal.penalties.speed,0);
assert.equal(ideal.score,100);

const briskReverse=scoreTrainingMetrics({maxSpeedKmh:reverseMaxKmh,completed:true});
assert.ok(briskReverse.penalties.speed>0,'driving at maximum reverse speed must affect the training score');
assert.ok(briskReverse.penalties.speed<=8);

const maxForward=scoreTrainingMetrics({maxSpeedKmh:forwardMaxKmh,completed:true});
assert.ok(maxForward.penalties.speed>=briskReverse.penalties.speed);
assert.ok(maxForward.penalties.speed<=8);

const s=createTrainingSession({rearX:0,rearZ:0,gear:'R'},0);
recordTrainingSample(s,{t:0,state:{rearX:0,rearZ:0,speed:-VEHICLE.reverseSpeed,steer:0,gear:'R'},deviation:{lateral:0,headingErrorDeg:0}});
const summary=summarizeTrainingSession(s);
assert.ok(summary.penalties.speed>0,'real session summary must expose reachable speed penalty');
assert.ok(summary.advice.some(text=>text.includes('最高速度')&&text.includes('km/h')),'reachable high reverse speed must generate actionable speed advice');

console.log('speed-scoring-tests: all assertions passed');