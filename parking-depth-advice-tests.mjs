import assert from 'node:assert/strict';
import { bayClearances, parkingSuccess } from './physics.mjs';
import { summarizeTrainingSession } from './session.mjs';

function completedSession(rearZ){
  const sample={t:.35,rearX:0,rearZ,yaw:Math.PI,speed:0,steer:0,gear:'R',lateral:0,headingErrorDeg:0,lineTouch:false,parkingSuccess:true};
  return{samples:[sample],initialPose:{...sample},lineTouchEvents:0,steeringDirectionChanges:0,gearChanges:0,completed:true,completionCandidateSince:0};
}

const shallowState={rearX:0,rearZ:-3.84,yaw:Math.PI,speed:0,steer:0,gear:'R'};
const shallowClearance=bayClearances(shallowState);
assert.ok(parkingSuccess(shallowState),'shallow fixture must still be a valid completed parking pose');
assert.ok(shallowClearance.front>0&&shallowClearance.front<.15,'shallow fixture must leave little clearance at the bay opening');
assert.ok(shallowClearance.back>.5,'shallow fixture must leave large rear clearance');
const shallowSummary=summarizeTrainingSession(completedSession(shallowState.rearZ));
assert.ok(shallowSummary.advice.some(text=>text.includes('停车偏浅')&&text.includes('车头')),'completed shallow parking must produce reachable front-clearance advice');

const deepState={rearX:0,rearZ:-4.40,yaw:Math.PI,speed:0,steer:0,gear:'R'};
const deepClearance=bayClearances(deepState);
assert.ok(parkingSuccess(deepState),'deep fixture must still be a valid completed parking pose');
assert.ok(deepClearance.back>0&&deepClearance.back<.15,'deep fixture must leave little rear clearance');
assert.ok(deepClearance.front>.5,'deep fixture must leave large front clearance');
const deepSummary=summarizeTrainingSession(completedSession(deepState.rearZ));
assert.ok(deepSummary.advice.some(text=>text.includes('停车偏深')&&text.includes('车尾')),'completed deep parking must still produce rear-clearance advice');
assert.ok(!deepSummary.advice.some(text=>text.includes('停车偏浅')),'deep parking must not be mislabeled shallow');

const centered=bayClearances({rearX:0,rearZ:-4.12,yaw:Math.PI,speed:0,steer:0,gear:'R'});
assert.ok(centered.front>.15&&centered.back>.15,'centered parking should have comfortable front and rear clearance');
assert.equal(centered.min,Math.min(centered.left,centered.right,centered.front,centered.back),'minimum clearance must include the bay opening side');

console.log('parking-depth-advice-tests: all assertions passed');