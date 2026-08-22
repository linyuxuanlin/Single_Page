import assert from 'node:assert/strict';
import { INITIAL_STATE, integratePose, lineCollisionDetails } from './physics.mjs';
import { sweptBodySamples, sweptLineCollision, sweptLineNames } from './swept-collision.mjs';

// A deliberately huge coarse step can start clear, cross the thin back line,
// and finish fully beyond it. Endpoint-only collision checks miss this case.
const start = { ...INITIAL_STATE, rearX: 0, rearZ: -4.0, yaw: Math.PI, steer: 0, speed: 0, gear: 'R' };
assert.equal(lineCollisionDetails(start).touching, false, 'fixture must start clear');
const farBeyond = integratePose(start, -6, 0);
assert.equal(lineCollisionDetails(farBeyond).touching, false, 'fixture endpoint must be clear again after tunnelling across the line');
const swept = sweptLineCollision(start, -6);
assert.equal(swept.touching, true, 'swept check must detect the line crossed between clear endpoints');
assert.ok(swept.distance > 0 && swept.distance < 2, `unexpected first-contact distance ${swept.distance}`);
assert.ok(swept.hits.some(hit => hit.name === 'back'), 'crossed line should be identified as the back line');
assert.deepEqual(sweptLineNames(start, -6), swept.hits.map(hit => hit.name));
assert.ok(swept.fraction > 0 && swept.fraction < 1);
assert.ok(Number.isFinite(swept.state.rearX) && Number.isFinite(swept.state.rearZ));

// Callers that have already proven the exact start clear can skip that duplicate
// SAT check without changing first-contact geometry or line identification.
const sweptKnownClear = sweptLineCollision(start, -6, { assumeStartClear: true });
assert.equal(sweptKnownClear.touching, swept.touching);
assert.ok(Math.abs(sweptKnownClear.distance - swept.distance) < 1e-12);
assert.deepEqual(sweptKnownClear.hits.map(hit => hit.name), swept.hits.map(hit => hit.name));
assert.ok(Math.abs(sweptKnownClear.state.rearX - swept.state.rearX) < 1e-12);
assert.ok(Math.abs(sweptKnownClear.state.rearZ - swept.state.rearZ) < 1e-12);

// The optimization is explicitly opt-in: standalone callers still detect a
// collision at distance zero when their starting pose is already touching.
const touchingStart = { ...INITIAL_STATE, rearX: -1.23, rearZ: -6.5, yaw: Math.PI, steer: 0 };
assert.equal(lineCollisionDetails(touchingStart).touching, true, 'touching fixture must begin on a bay line');
const touchingDefault = sweptLineCollision(touchingStart, -0.2);
assert.equal(touchingDefault.touching, true);
assert.equal(touchingDefault.distance, 0);
assert.equal(touchingDefault.stepsChecked, 0);

// Ordinary safe travel should stay cheap and return the actual end pose.
const safe = { ...INITIAL_STATE, rearX: 8, rearZ: 8, yaw: 0, steer: 0, gear: 'D' };
const safeSweep = sweptLineCollision(safe, 1);
assert.equal(safeSweep.touching, false);
assert.deepEqual(safeSweep.hits, []);
assert.ok(Math.abs(safeSweep.state.rearZ - 7) < 1e-9);

// Invalid tuning inputs are bounded and must never leak NaN/unbounded work.
const bounded = sweptLineCollision(safe, Number.NaN, { maxStep: Number.NaN, maxSubsteps: 999999 });
assert.equal(bounded.touching, false);
assert.ok(bounded.stepsChecked <= 2048);
assert.ok(Number.isFinite(bounded.state.rearX) && Number.isFinite(bounded.state.rearZ));

const bodySamples = sweptBodySamples(start, -1, { samples: 8 });
assert.equal(bodySamples.length, 9);
assert.equal(bodySamples[0].fraction, 0);
assert.equal(bodySamples.at(-1).fraction, 1);
assert.ok(bodySamples.every(sample => sample.polygon.length === 4 && sample.polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.z))));

console.log('swept-collision-tests: all assertions passed');
