import assert from 'node:assert/strict';
import {replayHighlightState,replayHighlightStyle} from './replay-highlight.mjs';

let h=replayHighlightState(null);assert.equal(h.active,false);assert.deepEqual(h.lines,[]);
h=replayHighlightState({t:1,collision:{lines:['left','left','bogus']},marker:null});assert.equal(h.active,true);assert.deepEqual(h.lines,['left']);assert.equal(h.label,'触线：左侧库线');assert.ok(h.pulse>=0&&h.pulse<=1);
h=replayHighlightState({t:2,collision:{lines:['right','back']},marker:{type:'line-touch'}});assert.deepEqual(h.lineLabels,['右侧库线','后侧库线']);assert.equal(h.label,'触线：右侧库线、后侧库线');
h=replayHighlightState({t:0,collision:{lines:[]},marker:{type:'line-touch'}});assert.equal(h.active,true);assert.equal(h.label,'首次触线');
let s=replayHighlightStyle(h);assert.ok(s.bodyOpacity>0);assert.ok(s.lineEmissive>0);assert.ok(s.bodyScale>=1);
s=replayHighlightStyle(replayHighlightState(null));assert.equal(s.bodyOpacity,0);assert.equal(s.lineEmissive,0);assert.equal(s.bodyScale,1);
console.log('replay-highlight-tests: all assertions passed');
