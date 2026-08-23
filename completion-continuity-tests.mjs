import assert from 'node:assert/strict';
import { createTrainingSession, recordTrainingSample, PARKING_COMPLETION_DWELL_SEC, PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC } from './session.mjs';

const parked={rearX:0,rearZ:-4,yaw:Math.PI,speed:0,steer:0,gear:'R'};
const sample=t=>({t,state:parked,deviation:{lateral:0,headingErrorDeg:0},lineTouch:false,parkingSuccess:true});

// A long browser/background sampling gap must not count as continuous stable parking.
const s=createTrainingSession(parked,0);
recordTrainingSample(s,sample(0));
recordTrainingSample(s,sample(2));
assert.equal(s.completed,false,'a 2 s observation gap must not instantly satisfy stable-parking dwell');
assert.equal(s.completionCandidateSince,2,'dwell should restart after a long observation gap');

// Normal ~10 Hz samples after recovery should accumulate a fresh dwell window.
recordTrainingSample(s,sample(2.1));
recordTrainingSample(s,sample(2.2));
recordTrainingSample(s,sample(2.3));
assert.equal(s.completed,false,'less than the required fresh dwell must remain incomplete');
recordTrainingSample(s,sample(2.4));
assert.equal(s.completed,true,'fresh continuous dwell after the gap should complete parking');
assert.ok(PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC<PARKING_COMPLETION_DWELL_SEC,'continuity gap must be stricter than total dwell');

// A borderline-normal interval is allowed, but anything above the continuity budget restarts dwell.
const s2=createTrainingSession(parked,0);
recordTrainingSample(s2,sample(0));
recordTrainingSample(s2,sample(PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC));
assert.equal(s2.completionCandidateSince,0,'maximum allowed sample gap should preserve dwell');
recordTrainingSample(s2,sample(PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC*2+0.001));
assert.equal(s2.completionCandidateSince,PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC*2+0.001,'gap above continuity budget should restart dwell');
assert.equal(s2.completed,false);

console.log('completion-continuity-tests: all assertions passed');
