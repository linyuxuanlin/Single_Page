import assert from 'node:assert/strict';
import { lineViolation, predictPathSegments } from './physics.mjs';
import { predictLineRisk } from './coach.mjs';

// Facing out of the bay: positive distance moves toward +Z, while the residual
// reverse motion moves toward the back line at Z=-5.40. The rear bumper starts
// about 3 cm clear of the line. At -0.60 m/s the direction-change braking
// distance is 6 cm, so the short braking phase touches the back line before the
// selected D gear can move the car away again.
const nearBackLine = {
  rearX: 0,
  rearZ: -4.42,
  yaw: Math.PI,
  speed: -0.60,
  steer: 0,
  gear: 'D',
};

assert.equal(lineViolation(nearBackLine), false, 'fixture must begin clear of the back line');

// The public visual sampler keeps samples=1 as a hard budget and therefore
// collapses this reversal to its dominant post-stop forward phase.
const visualBudget = predictPathSegments(nearBackLine, { distance: 4.2, samples: 1 });
assert.equal(visualBudget.length, 1);
assert.equal(visualBudget[0].direction, 1, 'one-sample visual path should retain its documented dominant phase');

// Collision coaching must never sacrifice the short safety-critical braking
// phase just to honor that visual budget. It may spend one extra segment only
// when needed to preserve the reversal boundary.
const risk = predictLineRisk(nearBackLine, { distance: 4.2, samples: 1 });
assert.equal(risk.requestedSamples, 1);
assert.equal(risk.reversalSafetyFloorApplied, true);
assert.equal(risk.samples, 2, 'reversal collision checks need both motion phases');
assert.equal(risk.reversing, true);
assert.equal(risk.willTouch, true, 'short residual reverse motion must still trigger a collision warning');
assert.equal(risk.alreadyTouching, false);
assert.ok(risk.hitLines.includes('back'), 'the safety-floor collision must identify the back line');
assert.ok(Number.isFinite(risk.distanceAhead));
assert.ok(risk.distanceAhead > 0.02 && risk.distanceAhead < 0.04, `expected first touch near 3 cm, got ${risk.distanceAhead}`);
assert.ok(risk.firstTouchState && Number.isFinite(risk.firstTouchState.rearZ));

// No reversal means no hidden sample expansion: the diagnostic budget remains
// exactly what the caller asked for.
const normal = predictLineRisk({ ...nearBackLine, rearZ: 0, speed: 0, gear: 'D' }, { distance: 1, samples: 1 });
assert.equal(normal.reversalSafetyFloorApplied, false);
assert.equal(normal.requestedSamples, 1);
assert.equal(normal.samples, 1);

console.log('reversal-safety-floor-tests: all assertions passed');
