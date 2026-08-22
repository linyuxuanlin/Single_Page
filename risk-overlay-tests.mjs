import assert from 'node:assert/strict';
import { normalizeRiskLines, riskVisualState, riskLineText, riskSummaryText, riskAnnouncementText, publishRiskOverlay, resetRiskOverlayState } from './risk-overlay.mjs';

assert.deepEqual(normalizeRiskLines(['left','bogus','left','back','right']), ['left','right','back']);
assert.deepEqual(normalizeRiskLines(['back','left']), ['left','back']);
assert.deepEqual(normalizeRiskLines(null), []);

let v = riskVisualState({willTouch:false,hitLines:['left']});
assert.equal(v.active,false); assert.equal(v.level,'clear');
assert.equal(riskSummaryText(v),''); assert.equal(riskAnnouncementText(v),'');

v = riskVisualState({willTouch:true,alreadyTouching:true,distanceAhead:2,hitLines:['left','left']});
assert.equal(v.level,'touch'); assert.deepEqual(v.lines,['left']); assert.equal(v.distanceAhead,0); assert.ok(v.opacity>.9);
assert.equal(riskLineText('left',v),'左侧库线 · 已触线');
assert.equal(riskSummaryText(v),'已触碰左侧库线');
assert.equal(riskAnnouncementText(v),'已触线。已触碰左侧库线');

v = riskVisualState({willTouch:true,distanceAhead:.4,hitLines:['right']});
assert.equal(v.level,'danger'); assert.equal(v.active,true);
assert.equal(riskLineText('right',v),'右侧库线 · 0.4 m');
assert.equal(riskSummaryText(v),'0.4 m 后可能触碰右侧库线');
assert.equal(riskAnnouncementText(v),'危险。0.4 m 后可能触碰右侧库线');

v = riskVisualState({willTouch:true,distanceAhead:1.4,hitLines:['back']});
assert.equal(v.level,'warn');
assert.equal(riskLineText('back',v),'后侧库线 · 1.4 m');
assert.equal(riskAnnouncementText(v),'预警。1.4 m 后可能触碰后侧库线');

v = riskVisualState({willTouch:true,distanceAhead:3.2,hitLines:['back','left']});
assert.equal(v.level,'caution'); assert.deepEqual(v.lines,['left','back']);
assert.equal(riskSummaryText(v),'3.2 m 后可能触碰左侧库线、后侧库线');
assert.equal(riskAnnouncementText(v),'注意。3.2 m 后可能触碰左侧库线、后侧库线');

v = riskVisualState({willTouch:true,distanceAhead:NaN,hitLines:['left']});
assert.equal(v.level,'caution'); assert.equal(v.distanceAhead,null);
assert.equal(riskLineText('left',v),'左侧库线 · 注意');
assert.equal(riskSummaryText(v),'当前轨迹可能触碰左侧库线');

let danger = riskVisualState({willTouch:true,distanceAhead:.79,hitLines:['left']});
let heldDanger = riskVisualState({willTouch:true,distanceAhead:.86,hitLines:['left']}, danger);
assert.equal(heldDanger.level,'danger');
let releasedDanger = riskVisualState({willTouch:true,distanceAhead:.98,hitLines:['left']}, heldDanger);
assert.equal(releasedDanger.level,'warn');

let warn = riskVisualState({willTouch:true,distanceAhead:1.95,hitLines:['back']});
let heldWarn = riskVisualState({willTouch:true,distanceAhead:2.08,hitLines:['back']}, warn);
assert.equal(heldWarn.level,'warn');
let releasedWarn = riskVisualState({willTouch:true,distanceAhead:2.25,hitLines:['back']}, heldWarn);
assert.equal(releasedWarn.level,'caution');

let multiWarn = riskVisualState({willTouch:true,distanceAhead:1.95,hitLines:['back','left']});
let reorderedHeld = riskVisualState({willTouch:true,distanceAhead:2.08,hitLines:['left','back']}, multiWarn);
assert.equal(reorderedHeld.level,'warn'); assert.deepEqual(reorderedHeld.lines,['left','back']);

const changedLine = riskVisualState({willTouch:true,distanceAhead:.86,hitLines:['right']}, danger);
assert.equal(changedLine.level,'warn');
const cleared = riskVisualState({willTouch:false,distanceAhead:null,hitLines:[]}, danger);
assert.equal(cleared.level,'clear'); assert.equal(cleared.active,false);

resetRiskOverlayState();
let published = publishRiskOverlay({willTouch:true,distanceAhead:.79,hitLines:['back']});
assert.equal(published.level,'danger');
published = publishRiskOverlay({willTouch:true,distanceAhead:.86,hitLines:['back']});
assert.equal(published.level,'danger');
resetRiskOverlayState();
published = publishRiskOverlay({willTouch:true,distanceAhead:.86,hitLines:['back']});
assert.equal(published.level,'warn');

console.log('risk-overlay-tests: all assertions passed');
