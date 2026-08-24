import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample,summarizeTrainingSession,extractTrainingEvents,STEERING_CORRECTION_MIN_SPEED_MPS} from './session.mjs';

const sample=(t,steer,speed)=>({t,state:{rearX:0,rearZ:0,yaw:0,steer,speed,gear:'R'},deviation:{lateral:0,headingErrorDeg:0}});

// Turning the wheel left/right while parked is setup, not a trajectory correction.
let s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,sample(0,.25,0));
recordTrainingSample(s,sample(.1,-.25,0));
recordTrainingSample(s,sample(.2,.25,0));
assert.equal(s.steeringDirectionChanges,0);
assert.equal(extractTrainingEvents(s).steeringChanges.length,0);
assert.equal(summarizeTrainingSession(s).penalties.steering,0);

// Once the vehicle is actually moving, opposite steering directions count.
s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,sample(0,.25,-.2));
recordTrainingSample(s,sample(.1,-.25,-.2));
recordTrainingSample(s,sample(.2,.25,-.2));
assert.equal(s.steeringDirectionChanges,2);
assert.deepEqual(extractTrainingEvents(s).steeringChanges.map(e=>e.index),[1,2]);

// Sub-threshold creep should not turn steering-wheel setup into noisy corrections.
s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,sample(0,.25,STEERING_CORRECTION_MIN_SPEED_MPS-.001));
recordTrainingSample(s,sample(.1,-.25,STEERING_CORRECTION_MIN_SPEED_MPS-.001));
assert.equal(s.steeringDirectionChanges,0);
assert.equal(extractTrainingEvents(s).steeringChanges.length,0);

// A steering reversal completed while stopped is setup for the next movement.
// Resuming with that prepared steering angle must not retroactively count it as
// a moving trajectory correction.
s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,sample(0,.25,-.2));
recordTrainingSample(s,sample(.1,-.25,0));
recordTrainingSample(s,sample(.2,-.25,-.2));
assert.equal(s.steeringDirectionChanges,0);
assert.deepEqual(extractTrainingEvents(s).steeringChanges.map(e=>e.index),[]);

// After resuming, a new opposite steering change while moving is a real correction.
recordTrainingSample(s,sample(.3,.25,-.2));
assert.equal(s.steeringDirectionChanges,1);
assert.deepEqual(extractTrainingEvents(s).steeringChanges.map(e=>e.index),[3]);

// Centering the wheel while stopped must clear the previous segment's turn
// direction. A later first turn in the opposite direction is not a correction
// of the old segment; only a reversal within the new moving segment counts.
s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,sample(0,.25,-.2));       // moving left-turn baseline
recordTrainingSample(s,sample(.1,0,0));          // stop and center: reset baseline
recordTrainingSample(s,sample(.2,0,-.2));        // resume straight
recordTrainingSample(s,sample(.3,-.25,-.2));     // first right turn in new segment
assert.equal(s.steeringDirectionChanges,0);
assert.deepEqual(extractTrainingEvents(s).steeringChanges.map(e=>e.index),[]);
recordTrainingSample(s,sample(.4,.25,-.2));      // actual reversal while moving
assert.equal(s.steeringDirectionChanges,1);
assert.deepEqual(extractTrainingEvents(s).steeringChanges.map(e=>e.index),[4]);

console.log('steering-correction-motion-tests: all assertions passed');
