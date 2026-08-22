import assert from 'node:assert/strict';
import { INITIAL_STATE, lineViolation } from './physics.mjs';
import { predictLineRisk, coachHint } from './coach.mjs';

// Vehicle overlaps the left bay line now, but is pointed so a forward prediction can move away.
// The coach must report the current collision at 0 m rather than only inspecting future samples.
const touchingLeft = {
  ...INITIAL_STATE,
  rearX: -0.40,
  rearZ: -2.80,
  yaw: Math.PI,
  speed: 0,
  gear: 'D',
  steer: 0,
};
assert.equal(lineViolation(touchingLeft), true, 'fixture must currently touch a bay line');
const risk = predictLineRisk(touchingLeft, { distance: 2, samples: 40 });
assert.equal(risk.willTouch, true);
assert.equal(risk.alreadyTouching, true);
assert.equal(risk.distanceAhead, 0, 'current contact must be reported at zero distance');
assert.equal(risk.firstTouchIndex, -1, 'current contact is not a future prediction sample');
assert.equal(risk.firstTouchState, touchingLeft);
const hint = coachHint(touchingLeft, { distance: 2, samples: 40 });
assert.equal(hint.code, 'line-touch-now');
assert.equal(hint.level, 'danger');
assert.match(hint.text, /已经触线/);

console.log('coach-current-touch-tests: all assertions passed');
