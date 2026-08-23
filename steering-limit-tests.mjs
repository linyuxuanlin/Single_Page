import assert from 'node:assert/strict';
import { VEHICLE, INITIAL_STATE, integratePose, stepVehicle, steeringAtFraction, velocityStep } from './physics.mjs';

const near = (a,b,e=1e-10,msg='') => assert.ok(Math.abs(a-b)<=e, `${msg} expected ${b}, got ${a}`);

const dt=.25;
const almostLeft=VEHICLE.maxRoadWheelAngle-.01;
const almostRight=-VEHICLE.maxRoadWheelAngle+.01;

// If full lock is reached before the distance-weighted time, the effective steering angle must already be clamped at full lock.
near(steeringAtFraction(almostLeft,{left:true},dt,.5),VEHICLE.maxRoadWheelAngle,1e-12,'left full-lock clamp');
near(steeringAtFraction(almostRight,{right:true},dt,.5),-VEHICLE.maxRoadWheelAngle,1e-12,'right full-lock clamp');

// No steering input holds the existing wheel angle, and active centering remains immediate.
near(steeringAtFraction(.31,{},dt,.8),.31,1e-12,'held steering');
near(steeringAtFraction(.31,{centerSteering:true},dt,.8),0,1e-12,'center steering');

// Regression: the old implementation interpolated from the start angle to the clamped final angle across the whole frame,
// which under-steered whenever the road wheel hit its limit early in a long/catch-up physics step.
const start={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,speed:.8,steer:almostLeft,gear:'D'};
const motion=velocityStep(start.speed,VEHICLE.forwardSpeed,VEHICLE.acceleration,dt);
const actual=stepVehicle(start,dt,{forward:true,left:true});
const expectedSteer=steeringAtFraction(start.steer,{left:true},dt,motion.timeFraction);
const expected=integratePose(start,motion.distance,expectedSteer);
const oldInterpolatedSteer=start.steer+(VEHICLE.maxRoadWheelAngle-start.steer)*motion.timeFraction;
const oldPose=integratePose(start,motion.distance,oldInterpolatedSteer);

near(actual.steer,VEHICLE.maxRoadWheelAngle,1e-12,'final steer reaches full lock');
near(actual.rearX,expected.rearX,1e-10,'full-lock x');
near(actual.rearZ,expected.rearZ,1e-10,'full-lock z');
near(actual.yaw,expected.yaw,1e-10,'full-lock yaw');
assert.ok(Math.abs(actual.yaw)>Math.abs(oldPose.yaw)+1e-6,'full-lock time must not be diluted across the whole step');

console.log('steering-limit-tests: all assertions passed');