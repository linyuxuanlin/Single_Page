import assert from 'node:assert/strict';
import { INITIAL_STATE, predictionDirection, predictStates } from './physics.mjs';

assert.equal(predictionDirection({...INITIAL_STATE,speed:0,gear:'R'}),-1,'stopped R should predict reverse');
assert.equal(predictionDirection({...INITIAL_STATE,speed:0,gear:'D'}),1,'stopped D should predict forward');
assert.equal(predictionDirection({...INITIAL_STATE,speed:-0.4,gear:'D'}),-1,'meaningful reverse motion overrides D gear');
assert.equal(predictionDirection({...INITIAL_STATE,speed:-0.04,gear:'D'}),-1,'low-speed residual reverse motion must still override D gear');
assert.equal(predictionDirection({...INITIAL_STATE,speed:0.04,gear:'R'}),1,'low-speed residual forward motion must still override R gear');
assert.equal(predictionDirection({...INITIAL_STATE,speed:-0.00005,gear:'D'}),1,'near-zero numerical drift should fall back to gear');

const reversing={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,steer:0,speed:-0.04,gear:'D'};
const reversePrediction=predictStates(reversing,{distance:.2,samples:4});
assert.ok(reversePrediction[0].rearZ>reversing.rearZ,'prediction must initially continue backward while residual speed is negative');

const rollingForward={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,steer:0,speed:0.04,gear:'R'};
const forwardPrediction=predictStates(rollingForward,{distance:.2,samples:4});
assert.ok(forwardPrediction[0].rearZ<rollingForward.rearZ,'prediction must initially continue forward while residual speed is positive');

console.log('prediction-direction-tests: all assertions passed');
