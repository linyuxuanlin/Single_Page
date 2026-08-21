import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample} from './session.mjs';
import {enterReplayMode,exitReplayMode,resetReplayRuntime} from './replay-runtime.mjs';

resetReplayRuntime();
const session=createTrainingSession({gear:'R'},0);
const sample=t=>({t,state:{rearX:t,rearZ:0,yaw:0,speed:-.3,steer:0,gear:'R'},deviation:{lateral:0,headingErrorDeg:0},lineTouch:false,parkingSuccess:false});
recordTrainingSample(session,sample(0));
assert.equal(session.samples.length,1);
enterReplayMode();
recordTrainingSample(session,sample(1));
recordTrainingSample(session,sample(2));
assert.equal(session.samples.length,1,'replay inspection must not append training samples');
exitReplayMode({restore:false});
recordTrainingSample(session,sample(3));
assert.equal(session.samples.length,2,'recording resumes after replay exits');
resetReplayRuntime();
console.log('replay-session-integration-tests: all assertions passed');
