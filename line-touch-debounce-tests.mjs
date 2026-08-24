import assert from 'node:assert/strict';
import { createTrainingSession, recordTrainingSample, LINE_TOUCH_REARM_CLEAR_SEC } from './session.mjs';

const state={rearX:0,rearZ:0,yaw:Math.PI,speed:0,steer:0,gear:'R'};
const sample=(t,lineTouch)=>({t,state,deviation:{lateral:0,headingErrorDeg:0},lineTouch,parkingSuccess:false});

let s=createTrainingSession(state,0);
recordTrainingSample(s,sample(0,true));
assert.equal(s.lineTouchEvents,1,'first contact counts');
recordTrainingSample(s,sample(.10,false));
recordTrainingSample(s,sample(.20,true));
assert.equal(s.lineTouchEvents,1,'brief clear/contact jitter must not count as a second collision episode');
recordTrainingSample(s,sample(.30,false));
recordTrainingSample(s,sample(.30+LINE_TOUCH_REARM_CLEAR_SEC+.01,false));
recordTrainingSample(s,sample(.30+LINE_TOUCH_REARM_CLEAR_SEC+.02,true));
assert.equal(s.lineTouchEvents,2,'a genuinely separated contact after sustained clearance counts again');

s=createTrainingSession(state,0);
recordTrainingSample(s,sample(0,false));
recordTrainingSample(s,sample(.5,true));
recordTrainingSample(s,sample(.6,true));
assert.equal(s.lineTouchEvents,1,'continuous contact is one episode');

console.log('line-touch-debounce-tests: all assertions passed');
