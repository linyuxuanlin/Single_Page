import assert from 'node:assert/strict';
import { normalizeRiskLines, riskVisualState, publishRiskOverlay } from './risk-overlay.mjs';

assert.deepEqual(normalizeRiskLines(['left','bogus','left','back','right']), ['left','back','right']);
assert.deepEqual(normalizeRiskLines(null), []);

let v = riskVisualState({willTouch:false,hitLines:['left']});
assert.equal(v.active,false); assert.equal(v.level,'clear');

v = riskVisualState({willTouch:true,alreadyTouching:true,distanceAhead:2,hitLines:['left','left']});
assert.equal(v.level,'touch'); assert.deepEqual(v.lines,['left']); assert.equal(v.distanceAhead,0); assert.ok(v.opacity>.9);

v = riskVisualState({willTouch:true,distanceAhead:.4,hitLines:['right']});
assert.equal(v.level,'danger'); assert.equal(v.active,true);

v = riskVisualState({willTouch:true,distanceAhead:1.4,hitLines:['back']});
assert.equal(v.level,'warn');

v = riskVisualState({willTouch:true,distanceAhead:3.2,hitLines:['left','back']});
assert.equal(v.level,'caution'); assert.equal(v.lines.length,2);

v = riskVisualState({willTouch:true,distanceAhead:NaN,hitLines:['left']});
assert.equal(v.level,'caution'); assert.equal(v.distanceAhead,null);

const serverVisual = publishRiskOverlay({willTouch:true,distanceAhead:.2,hitLines:['back']});
assert.equal(serverVisual.level,'danger');

console.log('risk-overlay-tests: all assertions passed');
