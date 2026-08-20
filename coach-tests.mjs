import assert from 'node:assert/strict';
import { INITIAL_STATE } from './physics.mjs';
import { coachHint, innerRearWheelKey, predictedSweepSamples, predictLineRisk } from './coach.mjs';

assert.equal(innerRearWheelKey(0.3), 'rl', 'left steer must make left rear wheel the inner wheel');
assert.equal(innerRearWheelKey(-0.3), 'rr', 'right steer must make right rear wheel the inner wheel');
assert.equal(innerRearWheelKey(0), null, 'straight steering has no inner rear wheel');

const sweep = predictedSweepSamples({ ...INITIAL_STATE, gear: 'R', steer: 0.2 }, { distance: 2, samples: 20 });
assert.equal(sweep.length, 20);
assert.equal(sweep[0].polygon.length, 4, 'each swept sample must contain the full body polygon');
assert.ok(Number.isFinite(sweep.at(-1).pose.rearX));

const farSafe = { ...INITIAL_STATE, rearX: 8, rearZ: 8, yaw: 0, gear: 'D', speed: 0, steer: 0 };
const safeRisk = predictLineRisk(farSafe, { distance: 1, samples: 20 });
assert.equal(safeRisk.willTouch, false, 'far-away straight prediction should remain clear');
assert.equal(safeRisk.distanceAhead, null);
assert.equal(coachHint(farSafe, { distance: 1, samples: 20 }).code, 'path-clear');

const nearBackLine = { ...INITIAL_STATE, rearX: 0, rearZ: -4.25, yaw: Math.PI, gear: 'R', speed: 0, steer: 0 };
const backRisk = predictLineRisk(nearBackLine, { distance: 1, samples: 100 });
assert.equal(backRisk.willTouch, true, 'continuing to reverse from the parked pose must predict the back-line touch');
assert.ok(backRisk.distanceAhead > 0 && backRisk.distanceAhead < 0.5, `unexpected back-line risk distance ${backRisk.distanceAhead}`);
assert.equal(backRisk.firstTouchIndex >= 0, true);
assert.equal(coachHint(nearBackLine, { distance: 1, samples: 100 }).code, 'predicted-line-touch');

const turningSafe = { ...farSafe, steer: 0.2 };
const turningHint = coachHint(turningSafe, { distance: 0.2, samples: 10 });
assert.equal(turningHint.code, 'watch-inner-rear-wheel');
assert.match(turningHint.text, /左后轮/);

console.log('coach-tests: all assertions passed');
