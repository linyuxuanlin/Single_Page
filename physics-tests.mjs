import assert from 'node:assert/strict';
import {
  VEHICLE, COURSE, CONTROL_BINDINGS, INITIAL_STATE, PARKING_STOP_SPEED, cloneState, localToWorld, frontDirection,
  normalizeAngle, integratePose, stepVehicle, ackermannAngles, bodyPolygon, lineViolation,
  isFullyInsideBay, headingErrorToBay, parkingSuccess, predictionDirection, predictStates,
  referenceTrajectory, polygonsOverlapSAT, rectPolygon,
} from './physics.mjs';

const near = (a,b,e=1e-8,msg='') => assert.ok(Math.abs(a-b) <= e, `${msg} expected ${b}, got ${a}`);
const angleNear = (a,b,e=1e-8,msg='') => {
  let d=a-b; while(d>Math.PI)d-=2*Math.PI; while(d<=-Math.PI)d+=2*Math.PI;
  assert.ok(Math.abs(d)<=e, `${msg} expected ${b}, got ${a}`);
};

// Angle normalization must be constant-time and finite even for corrupted state.
near(normalizeAngle(0),0);
near(normalizeAngle(9*Math.PI),Math.PI);
near(normalizeAngle(-9*Math.PI),Math.PI);
near(normalizeAngle(Infinity),0);
near(normalizeAngle(-Infinity),0);
near(normalizeAngle(NaN),0);

let s = { ...INITIAL_STATE, rearX:0, rearZ:0, yaw:0 };
near(frontDirection(s).x, 0); near(frontDirection(s).z, -1);
s.yaw = -Math.PI/2; near(frontDirection(s).x, 1); near(frontDirection(s).z, 0);

s = { ...INITIAL_STATE, rearX:0,rearZ:0,yaw:0,steer:0 };
let f = integratePose(s, 5, 0); near(f.rearX,0); near(f.rearZ,-5); angleNear(f.yaw,0);
let r = integratePose(s,-5,0); near(r.rearX,0); near(r.rearZ,5); angleNear(r.yaw,0);

const corruptedPose=integratePose({...s,rearX:Infinity,rearZ:NaN,yaw:Infinity,steer:Infinity},Infinity,Infinity);
for(const value of [corruptedPose.rearX,corruptedPose.rearZ,corruptedPose.yaw,corruptedPose.steer])assert.ok(Number.isFinite(value),'corrupted integratePose output must stay finite');
assert.ok(Math.abs(corruptedPose.steer)<=VEHICLE.maxRoadWheelAngle,'corrupted steer must be clamped');

const delta = 0.42, R = VEHICLE.wheelbase/Math.tan(delta), quarter = Math.PI/2*R;
s = { ...INITIAL_STATE, rearX:0,rearZ:0,yaw:0,steer:delta };
f = integratePose(s,quarter,delta);
near(f.rearX,-R,1e-8,'quarter arc x'); near(f.rearZ,-R,1e-8,'quarter arc z'); angleNear(f.yaw,Math.PI/2,1e-8,'quarter arc yaw');

s = { ...INITIAL_STATE, rearX:1.2,rearZ:-0.7,yaw:0.37,steer:-0.31 };
f = integratePose(s,3.7,s.steer); r = integratePose(f,-3.7,s.steer);
near(r.rearX,s.rearX,1e-8); near(r.rearZ,s.rearZ,1e-8); angleNear(r.yaw,s.yaw,1e-8);

assert.equal(CONTROL_BINDINGS.KeyW,'forward','W must map to forward');
assert.equal(CONTROL_BINDINGS.KeyS,'reverse','S must map to reverse');
assert.equal(CONTROL_BINDINGS.KeyA,'left','A must map to left steering');
assert.equal(CONTROL_BINDINGS.KeyD,'right','W must map to right steering'.replace('W','D'));

s = cloneState(INITIAL_STATE);
for(let i=0;i<120;i++) s=stepVehicle(s,1/120,{forward:true});
assert.ok(s.speed > 0, 'W/forward must produce positive speed');
s = { ...INITIAL_STATE, gear:'R' };
for(let i=0;i<120;i++) s=stepVehicle(s,1/120,{reverse:true});
assert.ok(s.speed < 0, 'S/reverse must produce negative speed');

const corruptedStep=stepVehicle({...INITIAL_STATE,rearX:NaN,rearZ:Infinity,yaw:-Infinity,speed:NaN,steer:Infinity},Infinity,{forward:true,left:true});
for(const value of [corruptedStep.rearX,corruptedStep.rearZ,corruptedStep.yaw,corruptedStep.speed,corruptedStep.steer])assert.ok(Number.isFinite(value),'corrupted stepVehicle output must stay finite');
assert.ok(Math.abs(corruptedStep.steer)<=VEHICLE.maxRoadWheelAngle,'stepVehicle steer must stay bounded');
assert.ok(Math.abs(corruptedStep.speed)<=VEHICLE.forwardSpeed+1e-9,'stepVehicle speed must stay bounded');
const frozenStep=stepVehicle({...INITIAL_STATE,speed:.5},NaN,{forward:true});
near(frozenStep.rearX,INITIAL_STATE.rearX,1e-12,'NaN dt must not move x');
near(frozenStep.rearZ,INITIAL_STATE.rearZ,1e-12,'NaN dt must not move z');

s = { ...INITIAL_STATE, steer:0.4 };
const held = stepVehicle(s,1/60,{}); near(held.steer,0.4,1e-12,'steering hold');
const centered = stepVehicle(s,1/60,{centerSteering:true}); near(centered.steer,0,1e-12,'center steering');

let a = ackermannAngles(0.4); assert.ok(a.left>a.right && a.left>0 && a.right>0);
a = ackermannAngles(-0.4); assert.ok(Math.abs(a.right)>Math.abs(a.left) && a.left<0 && a.right<0);
const badAckermann=ackermannAngles(Infinity);assert.ok(Number.isFinite(badAckermann.left)&&Number.isFinite(badAckermann.right));

let leftTurn={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,speed:1,steer:0.3,gear:'D'};
leftTurn=integratePose(leftTurn,1,leftTurn.steer);
assert.ok(frontDirection(leftTurn).x<0,'forward + left steer must point left');
let rightTurn={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,speed:1,steer:-0.3,gear:'D'};
rightTurn=integratePose(rightTurn,1,rightTurn.steer);
assert.ok(frontDirection(rightTurn).x>0,'forward + right steer must point right');
let reverseLeft={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0,speed:-1,steer:0.3,gear:'R'};
reverseLeft=integratePose(reverseLeft,-1,reverseLeft.steer);
assert.ok(reverseLeft.yaw<0,'reverse + left steer must reverse yaw evolution naturally');

const rl = localToWorld(-VEHICLE.trackWidth/2,0,{...INITIAL_STATE,rearX:0,rearZ:0,yaw:0});
near(rl.x,-VEHICLE.trackWidth/2);
assert.ok(VEHICLE.trackWidth + VEHICLE.wheelWidth <= VEHICLE.width + 1e-9);

const carBox = rectPolygon(0,0,VEHICLE.width,VEHICLE.length);
const centerLine = rectPolygon(0,0,0.08,8);
assert.equal(polygonsOverlapSAT(carBox,centerLine),true);

s = { ...INITIAL_STATE, rearX:0,rearZ:-4.25,yaw:Math.PI,speed:0,steer:0 };
assert.equal(lineViolation(s),false,'centered parked pose should not touch lines');
assert.equal(isFullyInsideBay(s),true,'centered parked pose should be fully inside');
assert.ok(headingErrorToBay(s)<1e-9);
assert.equal(parkingSuccess(s),true,'fully stopped valid pose should complete');
assert.equal(parkingSuccess({...s,speed:PARKING_STOP_SPEED}),true,'completion threshold is inclusive');
assert.equal(parkingSuccess({...s,speed:PARKING_STOP_SPEED+.001}),false,'creeping pose must not complete early');
assert.equal(parkingSuccess({...s,speed:.079}),false,'legacy 0.08 m/s creeping threshold must no longer complete');
const crossed = { ...s, rearX:COURSE.bayWidth/2 };
assert.equal(lineViolation(crossed),true,'vehicle crossing side line must be detected');
assert.equal(parkingSuccess(crossed),false,'crossing a line cannot complete');

assert.equal(predictionDirection({...INITIAL_STATE,speed:0,gear:'R'}),-1);
assert.equal(predictionDirection({...INITIAL_STATE,speed:0,gear:'D'}),1);
assert.equal(predictionDirection({...INITIAL_STATE,speed:-0.4,gear:'D'}),-1);
const preds = predictStates({...INITIAL_STATE,speed:0,gear:'R',steer:0},{distance:1,samples:10});
assert.ok(preds.at(-1).rearX < INITIAL_STATE.rearX,'initial reverse prediction should move west toward the bay');
const badPreds=predictStates({...INITIAL_STATE,rearX:Infinity,rearZ:NaN,yaw:Infinity,steer:Infinity},{distance:Infinity,samples:3});
assert.equal(badPreds.length,3);for(const pose of badPreds)for(const value of [pose.rearX,pose.rearZ,pose.yaw,pose.steer])assert.ok(Number.isFinite(value),'prediction output must stay finite');

const ref = referenceTrajectory();
assert.ok(ref.length>100);
const end = {...ref.at(-1),speed:0};
assert.equal(isFullyInsideBay(end),true,'reference end must be inside bay');
assert.ok(headingErrorToBay(end)<1e-8,'reference end heading');
assert.equal(parkingSuccess(end),true,'reference endpoint at rest should complete');
for (const pose of ref) assert.equal(lineViolation(pose),false,'reference path must be line-safe');
near(end.rearX,0,0.03,'reference centered x');
near(end.rearZ,-4.30,0.05,'reference rear z');

s={...INITIAL_STATE,rearX:0,rearZ:0,yaw:0};
const poly=bodyPolygon(s);
near(Math.abs(poly[1].x-poly[0].x),VEHICLE.width,1e-9);
near(Math.abs(poly[2].z-poly[1].z),VEHICLE.length,1e-9);

console.log('physics-tests: all assertions passed');
