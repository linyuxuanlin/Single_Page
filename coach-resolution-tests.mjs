import assert from 'node:assert/strict';
import { INITIAL_STATE, cloneState } from './physics.mjs';
import { predictLineRisk, coachHint } from './coach.mjs';

const state = cloneState(INITIAL_STATE);

// Normal live horizon must remain fully resolved and trustworthy.
const normal = predictLineRisk(state, { distance: 4.6, samples: 32 });
assert.equal(normal.resolutionLimited, false);
assert.equal(normal.predictionReliable, true);

// An intentionally extreme one-segment horizon exceeds the 2048 * 4 cm
// swept-collision spatial budget. If it happens not to find a line, the
// result must not be represented as a trustworthy clear path.
const extreme = predictLineRisk(state, { distance: 100, samples: 1 });
assert.equal(extreme.resolutionLimited, true);
assert.equal(extreme.predictionReliable, false);

// coachHint clamps browser hot-path density to <=32, but still must surface
// uncertainty rather than claim path-clear when its spatial guarantee is lost.
const hint = coachHint(state, { distance: 3000, samples: 1 });
if (!hint.risk.willTouch) {
  assert.equal(hint.risk.predictionReliable, false);
  assert.equal(hint.code, 'prediction-resolution-limited');
  assert.equal(hint.level, 'warn');
  assert.match(hint.text, /无法可靠排除中途触线/);
}

console.log('coach-resolution-tests: all assertions passed');
