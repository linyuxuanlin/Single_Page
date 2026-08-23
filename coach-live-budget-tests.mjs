import assert from 'node:assert/strict';
import { INITIAL_STATE, cloneState } from './physics.mjs';
import { LIVE_COACH_MAX_SAMPLES, coachHint, predictLineRisk } from './coach.mjs';

const state = cloneState(INITIAL_STATE);

assert.equal(LIVE_COACH_MAX_SAMPLES, 32, 'live coach budget should remain intentionally small');

const live = coachHint(state, { distance: 4.6, samples: 85 });
assert.ok(live.risk.samples <= LIVE_COACH_MAX_SAMPLES, 'coachHint must cap legacy high-density UI requests');
assert.ok(live.risk.samples > 0, 'live coach should still produce a useful prediction');

const diagnostic = predictLineRisk(state, { distance: 4.6, samples: 85 });
assert.equal(diagnostic.samples, 85, 'direct diagnostic prediction must continue honoring explicit density');

const lowBudget = coachHint(state, { distance: 4.6, samples: 7 });
assert.equal(lowBudget.risk.samples, 7, 'coachHint must not increase a caller-provided lower budget');

const invalidBudget = coachHint(state, { distance: 4.6, samples: Number.NaN });
assert.ok(invalidBudget.risk.samples <= LIVE_COACH_MAX_SAMPLES, 'invalid live budgets must fall back safely');

console.log('coach-live-budget-tests: all assertions passed');
