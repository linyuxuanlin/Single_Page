import assert from 'node:assert/strict';
import { scoreTrainingMetrics } from './session.mjs';

const corrupted=scoreTrainingMetrics({
  lineTouchEvents:-9,
  maxLateralM:-2,
  maxHeadingErrorDeg:NaN,
  maxSpeedKmh:-8,
  steeringDirectionChanges:-20,
  completed:true,
});
assert.equal(corrupted.score,100,'corrupted negative metrics must never create a score above 100');
assert.equal(corrupted.totalPenalty,0);
for(const [name,value] of Object.entries(corrupted.penalties))assert.ok(Number.isFinite(value)&&value>=0,`${name} penalty must be finite and non-negative`);

const extreme=scoreTrainingMetrics({
  lineTouchEvents:Infinity,
  maxLateralM:Infinity,
  maxHeadingErrorDeg:Infinity,
  maxSpeedKmh:Infinity,
  steeringDirectionChanges:Infinity,
  completed:false,
});
assert.ok(extreme.score>=0&&extreme.score<=100);
assert.ok(Number.isFinite(extreme.totalPenalty));
for(const value of Object.values(extreme.penalties))assert.ok(Number.isFinite(value)&&value>=0);

const normal=scoreTrainingMetrics({lineTouchEvents:1,maxLateralM:.5,maxHeadingErrorDeg:12,maxSpeedKmh:5,steeringDirectionChanges:7,completed:false});
assert.ok(normal.score>=0&&normal.score<=100,'normal scoring remains bounded');
assert.equal(normal.penalties.lineTouch,25);
assert.equal(normal.penalties.incomplete,12);

console.log('score-corruption-tests: all assertions passed');
