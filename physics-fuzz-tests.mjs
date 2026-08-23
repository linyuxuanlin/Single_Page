import assert from 'node:assert/strict';
import {
  VEHICLE, INITIAL_STATE, normalizeAngle, integratePose, stepVehicle,
  ackermannAngles, bodyPolygon, wheelPoints, predictStates,
} from './physics.mjs';

// Deterministic pseudo-random regression sweep. This is deliberately dependency-free
// so it can run locally with `node physics-fuzz-tests.mjs` without consuming Actions.
let seed = 0x5eed1234;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const between = (lo, hi) => lo + (hi - lo) * rnd();
const finitePose = pose => [pose.rearX, pose.rearZ, pose.yaw, pose.speed, pose.steer]
  .every(Number.isFinite);

for (let i = 0; i < 5000; i++) {
  const state = {
    ...INITIAL_STATE,
    rearX: between(-12, 12),
    rearZ: between(-12, 12),
    yaw: between(-40 * Math.PI, 40 * Math.PI),
    speed: between(-1.5, 1.5),
    steer: between(-0.9, 0.9),
    gear: rnd() < .5 ? 'D' : 'R',
  };
  const dt = between(0, .4); // deliberately exceeds the protected 250 ms ceiling sometimes
  const controls = {
    forward: rnd() < .35,
    reverse: rnd() < .35,
    left: rnd() < .35,
    right: rnd() < .35,
    centerSteering: rnd() < .04,
  };
  const next = stepVehicle(state, dt, controls);
  assert.ok(finitePose(next), `step ${i}: vehicle state must stay finite`);
  assert.ok(Math.abs(next.steer) <= VEHICLE.maxRoadWheelAngle + 1e-12, `step ${i}: steer bound`);
  assert.ok(next.speed <= VEHICLE.forwardSpeed + 1e-12, `step ${i}: forward speed bound`);
  assert.ok(next.speed >= -VEHICLE.reverseSpeed - 1e-12, `step ${i}: reverse speed bound`);
  assert.ok(next.yaw > -Math.PI - 1e-12 && next.yaw <= Math.PI + 1e-12, `step ${i}: normalized yaw`);

  const wheels = wheelPoints(next);
  const body = bodyPolygon(next);
  for (const p of [...Object.values(wheels), ...body]) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `step ${i}: geometry must stay finite`);
  }

  const ack = ackermannAngles(next.steer);
  assert.ok(Number.isFinite(ack.left) && Number.isFinite(ack.right), `step ${i}: Ackermann finite`);

  // Constant-steer pose integration should be reversible to numerical precision.
  const distance = between(-8, 8);
  const start = { ...next, speed: 0 };
  const out = integratePose(start, distance, start.steer);
  const back = integratePose(out, -distance, start.steer);
  assert.ok(Math.hypot(back.rearX - start.rearX, back.rearZ - start.rearZ) < 1e-8, `step ${i}: reversible position`);
  assert.ok(Math.abs(normalizeAngle(back.yaw - start.yaw)) < 1e-8, `step ${i}: reversible heading`);
}

// Corrupted-input corpus: these values previously caused hangs/NaN propagation risks.
const bad = [NaN, Infinity, -Infinity, undefined, null];
for (const value of bad) {
  const state = { ...INITIAL_STATE, rearX:value, rearZ:value, yaw:value, speed:value, steer:value };
  const next = stepVehicle(state, value, { forward:true, left:true });
  assert.ok(finitePose(next), `corrupted ${String(value)}: step output finite`);
  const predictions = predictStates(state, { distance:value, samples:value });
  assert.ok(predictions.length >= 1 && predictions.length <= 2000, 'prediction work must stay bounded');
  for (const pose of predictions) assert.ok(finitePose({ ...pose, speed:pose.speed ?? 0 }), 'prediction pose finite');
}

console.log('physics-fuzz-tests: 5000 deterministic randomized states passed');
