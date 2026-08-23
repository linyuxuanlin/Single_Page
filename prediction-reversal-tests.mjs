import assert from 'node:assert/strict';
import { INITIAL_STATE, VEHICLE, predictPathSegments, predictStates } from './physics.mjs';
import { predictLineRisk } from './coach.mjs';

const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);

// A D/R swap must not project the entire horizon in the stale motion direction.
// The car first travels its physical braking distance, then continues in gear.
const changingToDrive = {
  ...INITIAL_STATE,
  rearX: 0,
  rearZ: 0,
  yaw: 0,
  steer: 0,
  speed: -0.04,
  gear: 'D',
};
const distance = 0.2;
const segments = predictPathSegments(changingToDrive, { distance, samples: 4 });
assert.equal(segments.length, 4, 'two-phase prediction should keep requested sample count when possible');
assert.equal(segments[0].direction, -1, 'first segment must preserve residual reverse motion');
assert.equal(segments[1].direction, 1, 'prediction must switch to selected D direction after stopping');
const brakingDistance = changingToDrive.speed ** 2 / (2 * VEHICLE.directionChangeBrake);
close(Math.abs(segments[0].distance), brakingDistance, 1e-12);
close(segments.reduce((sum, segment) => sum + Math.abs(segment.distance), 0), distance, 1e-12);
assert.ok(segments[0].state.rearZ > 0, 'residual reverse segment should initially move rear axle backward');
assert.ok(segments.at(-1).state.rearZ < 0, 'remaining horizon should continue forward after the stop');

const states = predictStates(changingToDrive, { distance, samples: 4 });
assert.equal(states.length, 4);
close(states[0].rearZ, segments[0].state.rearZ);
close(states.at(-1).rearZ, segments.at(-1).state.rearZ);

// The phase boundary must still be represented when a caller asks for a single
// coarse sample; correctness is more important than hiding the direction swap.
const minimal = predictPathSegments(changingToDrive, { distance, samples: 1 });
assert.equal(minimal.length, 2, 'one requested sample may expand to two segments to preserve a real reversal');
assert.deepEqual(minimal.map(segment => segment.direction), [-1, 1]);
close(minimal.reduce((sum, segment) => sum + Math.abs(segment.distance), 0), distance, 1e-12);

// Regression for coaching: while residual reverse motion briefly carries the
// car away from the bay back line, the later D phase must still be swept and
// predict the eventual back-line contact.
const nearBackLine = {
  ...INITIAL_STATE,
  rearX: 0,
  rearZ: -1.0,
  yaw: 0,
  steer: 0,
  speed: -0.4,
  gear: 'D',
};
const risk = predictLineRisk(nearBackLine, { distance: 1.2, samples: 4 });
assert.equal(risk.willTouch, true, 'reversal prediction should still find the later collision');
assert.equal(risk.alreadyTouching, false);
assert.ok(risk.hitLines.includes('back'), 'later D phase should identify the back parking line');
assert.ok(Number.isFinite(risk.distanceAhead) && risk.distanceAhead > brakingDistance, 'collision distance should include the initial braking travel');
assert.ok(risk.firstTouchState && Number.isFinite(risk.firstTouchState.rearZ));

console.log('prediction-reversal-tests: all assertions passed');
