import assert from 'node:assert/strict';
import { trainingTravelDistance, summarizeTrainingSession } from './session.mjs';

const quarterTurn = {
  initialPose: {rearX:0,rearZ:0,speed:1,steer:0,gear:'D'},
  samples: [{
    t:Math.PI/2,rearX:1,rearZ:-1,yaw:-Math.PI/2,speed:1,steer:0,gear:'D',
    lateral:0,headingErrorDeg:0,lineTouch:false,parkingSuccess:false,coachCode:null
  }],
  lineTouchEvents:0,steeringDirectionChanges:0,gearChanges:0,completed:false,completionCandidateSince:null
};
const arcDistance=trainingTravelDistance(quarterTurn);
assert.ok(Math.abs(arcDistance-Math.PI/2)<1e-9,'quarter-circle travel should use arc-length speed integral');
assert.ok(arcDistance>Math.SQRT2+.15,'curved travel must not collapse to the straight chord');

const reversal = {
  initialPose:{rearX:0,rearZ:0,speed:-1,steer:0,gear:'R'},
  samples:[{
    t:2,rearX:0,rearZ:0,yaw:0,speed:1,steer:0,gear:'D',
    lateral:0,headingErrorDeg:0,lineTouch:false,parkingSuccess:false,coachCode:null
  }]
};
assert.ok(Math.abs(trainingTravelDistance(reversal)-1)<1e-9,'linear speed reversal should integrate absolute travel through zero');

const defensiveChord = {
  initialPose:{rearX:0,rearZ:0,speed:0,steer:0,gear:'R'},
  samples:[{
    t:1,rearX:0,rearZ:-.6,yaw:0,speed:0,steer:0,gear:'R',
    lateral:0,headingErrorDeg:0,lineTouch:false,parkingSuccess:false,coachCode:null
  }]
};
assert.ok(Math.abs(trainingTravelDistance(defensiveChord)-.6)<1e-9,'position chord must remain a lower bound if velocity samples are incomplete');

const summary=summarizeTrainingSession({
  ...quarterTurn,
  samples:[...quarterTurn.samples],
  lastLineTouch:false,lastSteerSign:0,lastGear:'D',startedAt:0,replayPauseBaselineMs:0,elapsedSec:Math.PI/2
});
assert.ok(Math.abs(summary.distanceM-Math.PI/2)<1e-9,'training summary must expose the arc-aware travel distance');

console.log('session-distance-tests: all assertions passed');
