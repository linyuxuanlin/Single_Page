import assert from 'node:assert/strict';
import { INITIAL_STATE, referenceTrajectory } from './physics.mjs';
import {
  coachHint,
  innerRearWheelKey,
  nearestReferencePose,
  predictedSweepSamples,
  predictLineRisk,
  referenceDeviation,
} from './coach.mjs';

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
assert.deepEqual(safeRisk.hitLines, []);
assert.equal(coachHint(farSafe, { distance: 1, samples: 20 }).code, 'path-clear');

const nearBackLine = { ...INITIAL_STATE, rearX: 0, rearZ: -4.25, yaw: Math.PI, gear: 'R', speed: 0, steer: 0 };
const backRisk = predictLineRisk(nearBackLine, { distance: 1, samples: 100 });
assert.equal(backRisk.willTouch, true, 'continuing to reverse from the parked pose must predict the back-line touch');
assert.ok(backRisk.distanceAhead > 0 && backRisk.distanceAhead < 0.5, `unexpected back-line risk distance ${backRisk.distanceAhead}`);
assert.equal(backRisk.firstTouchIndex >= 0, true);
assert.deepEqual(backRisk.hitLines, ['back'], 'prediction should identify the exact line at risk');
const backHint = coachHint(nearBackLine, { distance: 1, samples: 100 });
assert.equal(backHint.code, 'predicted-line-touch');
assert.match(backHint.text, /后侧库线/);

const touchingLeft = { ...INITIAL_STATE, rearX: -1.25, rearZ: -2.5, yaw: Math.PI, gear: 'D', speed: 0, steer: 0 };
const currentRisk = predictLineRisk(touchingLeft, { distance: 0.2, samples: 10 });
assert.equal(currentRisk.alreadyTouching, true);
assert.ok(currentRisk.hitLines.includes('left'), 'current collision should identify left line');
const currentHint = coachHint(touchingLeft, { distance: 0.2, samples: 10 });
assert.equal(currentHint.code, 'line-touch-now');
assert.match(currentHint.text, /左侧库线/);

const turningSafe = { ...farSafe, steer: 0.2 };
const turningHint = coachHint(turningSafe, { distance: 0.2, samples: 10 });
assert.equal(turningHint.code, 'watch-inner-rear-wheel');
assert.match(turningHint.text, /左后轮/);

const ref = referenceTrajectory();
const midIndex = Math.floor(ref.length * 0.55);
const mid = ref[midIndex];
const nearest = nearestReferencePose(mid, ref);
assert.equal(nearest.index, midIndex, 'exact reference pose should match itself');
assert.ok(nearest.distance < 1e-10);
assert.ok(nearest.progress > 0.4 && nearest.progress < 0.7);

const c = Math.cos(mid.yaw), si = Math.sin(mid.yaw);
const shiftedRight = {
  ...mid,
  rearX: mid.rearX + 0.5 * c,
  rearZ: mid.rearZ - 0.5 * si,
  speed: 0,
  gear: 'D',
  steer: 0,
};
const rightDeviation = referenceDeviation(shiftedRight, ref);
assert.ok(rightDeviation.lateral > 0.45, `expected positive/right lateral deviation, got ${rightDeviation.lateral}`);
assert.ok(Math.abs(rightDeviation.headingErrorDeg) < 1e-8);
const lateralHint = coachHint(shiftedRight, { distance: 0.1, samples: 5 });
assert.equal(lateralHint.code, 'reference-lateral-deviation');
assert.match(lateralHint.text, /偏右/);

const headingOff = {
  ...mid,
  yaw: mid.yaw + 10 * Math.PI / 180,
  speed: 0,
  gear: 'D',
  steer: 0,
};
const headingDeviation = referenceDeviation(headingOff, ref);
assert.ok(Math.abs(headingDeviation.headingErrorDeg - 10) < 1e-8);
const headingHint = coachHint(headingOff, { distance: 0.1, samples: 5 });
assert.equal(headingHint.code, 'reference-heading-deviation');
assert.match(headingHint.text, /10°/);

console.log('coach-tests: all assertions passed');
