import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample,summarizeTrainingSession,PARKING_COMPLETION_DWELL_SEC} from './session.mjs';
import {resetReplayRuntime} from './replay-runtime.mjs';

resetReplayRuntime();
const session=createTrainingSession({gear:'R'},0);
recordTrainingSample(session,{t:0,state:{rearX:0,rearZ:-3.6,yaw:Math.PI,speed:-.2,steer:0,gear:'R'},deviation:{lateral:.12,headingErrorDeg:2}});
recordTrainingSample(session,{t:1,state:{rearX:0,rearZ:-4.2,yaw:Math.PI,speed:0,steer:0,gear:'R'},deviation:{lateral:.08,headingErrorDeg:1},parkingSuccess:true});
assert.equal(session.completed,false,'first valid stopped frame only starts the completion dwell');
recordTrainingSample(session,{t:1+PARKING_COMPLETION_DWELL_SEC,state:{rearX:0,rearZ:-4.2,yaw:Math.PI,speed:0,steer:0,gear:'R'},deviation:{lateral:.08,headingErrorDeg:1},parkingSuccess:true});
assert.equal(session.completed,true,'stable valid parking must complete after the dwell');

const sampleCount=session.samples.length;
const before=summarizeTrainingSession(session);

recordTrainingSample(session,{t:2,state:{rearX:1.4,rearZ:-5.2,yaw:Math.PI/2,speed:1.2,steer:.5,gear:'D'},deviation:{lateral:1.4,headingErrorDeg:90},lineTouch:true});
recordTrainingSample(session,{t:3,state:{rearX:-1.4,rearZ:-5.2,yaw:0,speed:1.2,steer:-.5,gear:'R'},deviation:{lateral:-1.4,headingErrorDeg:-90},lineTouch:true});

const after=summarizeTrainingSession(session);
assert.equal(session.samples.length,sampleCount,'completed attempt must stop accepting new samples');
assert.deepEqual(after,before,'review metrics must remain identical after post-completion driving');
assert.equal(session.lineTouchEvents,0,'post-completion contact must not alter touch count');
assert.equal(session.gearChanges,0,'post-completion shifts must not alter gear-change count');
assert.equal(session.steeringDirectionChanges,0,'post-completion steering must not alter correction count');
console.log('session-completion-freeze-tests: all assertions passed');