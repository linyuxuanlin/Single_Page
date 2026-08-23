import assert from 'node:assert/strict';
import { INITIAL_STATE, VEHICLE, stepVehicle, velocityStep } from './physics.mjs';

const near = (a, b, e = 1e-10, msg = '') => assert.ok(Math.abs(a - b) <= e, `${msg} expected ${b}, got ${a}`);

// If a vehicle reaches zero before the end of a long protected frame, it must
// stop moving at that instant instead of spreading the deceleration over the
// whole frame. Reverse motion with yaw=0 increases rearZ.
let s = { ...INITIAL_STATE, rearX: 0, rearZ: 0, yaw: 0, speed: -0.01, gear: 'R', steer: 0 };
let after = stepVehicle(s, 0.25, { forward: true });
const reverseStopTime = 0.01 / VEHICLE.directionChangeBrake;
const expectedReverseDistance = 0.5 * 0.01 * reverseStopTime;
near(after.speed, 0, 1e-12, 'direction-change speed');
near(after.rearZ, expectedReverseDistance, 1e-12, 'direction-change stopping distance');

// Coasting to rest has the same requirement: once zero speed is reached, the
// rest of the frame contributes no extra distance.
s = { ...INITIAL_STATE, rearX: 0, rearZ: 0, yaw: 0, speed: 0.1, gear: 'D', steer: 0 };
after = stepVehicle(s, 0.25, {});
const coastStopTime = 0.1 / VEHICLE.coastBrake;
const expectedCoastDistance = 0.5 * 0.1 * coastStopTime;
near(after.speed, 0, 1e-12, 'coast speed');
near(after.rearZ, -expectedCoastDistance, 1e-12, 'coast stopping distance');

// Reaching cruise speed early should include the remaining constant-speed
// portion of the frame, not under-count it.
const accel = velocityStep(0, 0.1, 1, 0.25);
near(accel.speed, 0.1, 1e-12, 'target speed reached');
near(accel.distance, 0.5 * 0.1 * 0.1 + 0.1 * 0.15, 1e-12, 'distance after reaching target early');
assert.equal(accel.reached, true);

// If the target is not reached within the frame, ordinary trapezoidal
// integration remains exact for constant acceleration.
const partial = velocityStep(0, 1, 2, 0.25);
near(partial.speed, 0.5, 1e-12, 'partial acceleration speed');
near(partial.distance, 0.5 * (0 + 0.5) * 0.25, 1e-12, 'partial acceleration distance');
assert.equal(partial.reached, false);

console.log('stopping-distance-tests: all assertions passed');
