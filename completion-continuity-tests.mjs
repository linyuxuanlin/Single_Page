import assert from 'node:assert/strict';
import { createTrainingSession, recordTrainingSample, PARKING_COMPLETION_DWELL_SEC } from './session.mjs';

const parked={rearX:0,rearZ:-4,yaw:Math.PI,speed:0,steer:0,gear:'R'};
const sample=t=>({t,state:parked,deviation:{lateral:0,headingErrorDeg:0},lineTouch:false,parkingSuccess:true});

// A long browser/background sampling gap must not count as continuous stable parking.
const s=createTrainingSession(parked,0);
recordTrainingSample(s,sample(0));
recordTrainingSample(s,sample(2));
assert.equal(s.completed,false,'a 2 s observation gap must not instantly satisfy stable-parking dwell');
assert.equal(s.completionCandidateSince,2,'dwell should restart after a long observation gap');
recordTrainingSample(s,sample(2+PARKING_COMPLETION_DWELL_SEC));
assert.equal(s.completed,true,'fresh continuous dwell after the gap should complete parking');

console.log('completion-continuity-tests: all assertions passed');
