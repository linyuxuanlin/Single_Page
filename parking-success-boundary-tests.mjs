import assert from 'node:assert/strict';
import {COURSE,PARKING_STOP_SPEED,parkingSuccess,isFullyInsideBay,lineViolation,headingErrorToBay} from './physics.mjs';

// A centered, straight, fully stopped car deep enough in the bay must succeed.
const good={rearX:0,rearZ:-4.30,yaw:Math.PI,speed:0,steer:0,gear:'R'};
assert.equal(isFullyInsideBay(good,.015),true);
assert.equal(lineViolation(good),false);
assert.equal(parkingSuccess(good),true);

// Completion must remain strict at the user-visible boundaries: merely being inside
// the painted lines is not enough when the 1.5 cm safety margin is violated.
const nearLeft={...good,rearX:-0.345};
assert.equal(isFullyInsideBay(nearLeft,0),true,'fixture should still be geometrically inside the bay');
assert.equal(isFullyInsideBay(nearLeft,.015),false,'completion safety margin must be enforced');
assert.equal(parkingSuccess(nearLeft),false);

// The stop threshold is inclusive, but even a tiny amount above it must not count as parked.
assert.equal(parkingSuccess({...good,speed:PARKING_STOP_SPEED}),true);
assert.equal(parkingSuccess({...good,speed:PARKING_STOP_SPEED+1e-6}),false);
assert.equal(parkingSuccess({...good,speed:-PARKING_STOP_SPEED}),true);
assert.equal(parkingSuccess({...good,speed:-PARKING_STOP_SPEED-1e-6}),false);

// Heading tolerance is intentionally strict (< 5 deg), in both directions.
const d=Math.PI/180;
assert.ok(headingErrorToBay({...good,yaw:Math.PI+4.999*d})<5*d);
assert.equal(parkingSuccess({...good,yaw:Math.PI+4.999*d}),true);
assert.equal(parkingSuccess({...good,yaw:Math.PI+5*d}),false);
assert.equal(parkingSuccess({...good,yaw:Math.PI-5*d}),false);

// Moving the rear axle too close to the back line must fail even when centered/straight.
const tooDeep={...good,rearZ:COURSE.backZ+.91+.015+.04};
assert.equal(parkingSuccess(tooDeep),false);

console.log('parking-success-boundary-tests: all assertions passed');
