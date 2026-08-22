import assert from 'node:assert/strict';
import { INITIAL_STATE, stepVehicle } from './physics.mjs';

const near = (a, b, e = 1e-10, msg = '') => assert.ok(Math.abs(a - b) <= e, `${msg} expected ${b}, got ${a}`);

// A reversing vehicle that receives W/D must finish braking before it can
// accelerate forward. Even the maximum guarded dt must not cross zero speed.
let s = { ...INITIAL_STATE, rearX: 0, rearZ: 0, yaw: 0, speed: -0.01, gear: 'R', steer: 0 };
const reverseToDrive = stepVehicle(s, 0.25, { forward: true });
near(reverseToDrive.speed, 0, 1e-12, 'reverse -> drive braking step');
assert.equal(reverseToDrive.gear, 'D', 'requested gear should still update to D');
assert.ok(reverseToDrive.rearZ > 0, 'braking step must keep moving in the old reverse direction until stopped');

const forwardAfterStop = stepVehicle(reverseToDrive, 0.25, { forward: true });
assert.ok(forwardAfterStop.speed > 0, 'forward acceleration may begin on the following physics step');
assert.ok(forwardAfterStop.rearZ < reverseToDrive.rearZ, 'after stopping, forward motion should begin');

// Symmetric case: a forward-moving vehicle that receives S/R must brake to
// zero first and may only reverse on a later physics step.
s = { ...INITIAL_STATE, rearX: 0, rearZ: 0, yaw: 0, speed: 0.01, gear: 'D', steer: 0 };
const driveToReverse = stepVehicle(s, 0.25, { reverse: true });
near(driveToReverse.speed, 0, 1e-12, 'drive -> reverse braking step');
assert.equal(driveToReverse.gear, 'R', 'requested gear should still update to R');
assert.ok(driveToReverse.rearZ < 0, 'braking step must keep moving in the old forward direction until stopped');

const reverseAfterStop = stepVehicle(driveToReverse, 0.25, { reverse: true });
assert.ok(reverseAfterStop.speed < 0, 'reverse acceleration may begin on the following physics step');
assert.ok(reverseAfterStop.rearZ > driveToReverse.rearZ, 'after stopping, reverse motion should begin');

// Normal small fixed timesteps must obey the same invariant: no single step
// may change the sign of a non-zero velocity while the opposite direction is requested.
for (const [speed, controls] of [[-0.4, { forward: true }], [0.4, { reverse: true }]]) {
  const before = { ...INITIAL_STATE, rearX: 0, rearZ: 0, yaw: 0, speed, gear: speed > 0 ? 'D' : 'R', steer: 0 };
  const after = stepVehicle(before, 1 / 120, controls);
  assert.ok(after.speed === 0 || Math.sign(after.speed) === Math.sign(speed), 'direction-change step must never overshoot through zero');
}

console.log('direction-change-tests: all assertions passed');
