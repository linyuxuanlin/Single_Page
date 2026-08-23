import assert from 'node:assert/strict';
import { predictPathSegments } from './physics.mjs';

const reversing={rearX:0,rearZ:0,yaw:Math.PI,speed:-0.04,steer:0,gear:'D'};
const segments=predictPathSegments(reversing,{distance:4.2,samples:1});
assert.ok(segments.length<=1,'samples=1 must remain a hard total sample budget');
assert.equal(segments.length,1);
assert.equal(segments[0].direction,1,'with one sample, preserve the dominant post-stop selected-gear phase');
assert.ok(Math.abs(segments[0].distance-4.2)<1e-9,'single segment must preserve the requested total path length');

const normal=predictPathSegments(reversing,{distance:4.2,samples:32});
assert.equal(normal.length,32,'multi-phase prediction must not exceed the requested total sample count');
assert.ok(normal.some(s=>s.direction===-1),'normal budget should preserve the short braking phase');
assert.ok(normal.some(s=>s.direction===1),'normal budget should preserve the selected-gear phase');
const total=normal.reduce((sum,s)=>sum+Math.abs(s.distance),0);
assert.ok(Math.abs(total-4.2)<1e-9,'phase allocation must preserve total prediction distance');

console.log('prediction-budget-tests: all assertions passed');
