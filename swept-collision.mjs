import { COURSE, bodyPolygon, integratePose, lineCollisionDetails } from './physics.mjs';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/**
 * Check a travelled pose interval for parking-line contact instead of checking
 * only its endpoint. This prevents low-frequency analysis/replay code from
 * tunnelling completely across an 8 cm course line between samples.
 *
 * The subdivision length defaults to half a line width. The hard cap keeps
 * malformed/very large distances from turning one check into unbounded work.
 */
export function sweptLineCollision(fromState, signedDistance, {
  maxStep = COURSE.lineWidth / 2,
  maxSubsteps = 256,
} = {}) {
  const distance = finite(signedDistance);
  const safeMaxStep = Math.max(0.005, finite(maxStep, COURSE.lineWidth / 2));
  const safeCap = Math.max(1, Math.min(2048, Math.floor(finite(maxSubsteps, 256))));
  const steps = Math.max(1, Math.min(safeCap, Math.ceil(Math.abs(distance) / safeMaxStep)));

  const startCollision = lineCollisionDetails(fromState);
  if (startCollision.touching) {
    return { touching: true, distance: 0, fraction: 0, state: { ...fromState }, hits: startCollision.hits, stepsChecked: 0 };
  }

  for (let i = 1; i <= steps; i++) {
    const travelled = distance * i / steps;
    const state = integratePose(fromState, travelled, fromState?.steer);
    const collision = lineCollisionDetails(state);
    if (collision.touching) {
      // Refine the first contact inside the detected micro-step. The interval
      // starts clear by construction, so ordinary bisection is monotonic here.
      let clear = distance * (i - 1) / steps;
      let hit = travelled;
      let hitState = state;
      let hitDetails = collision;
      for (let j = 0; j < 10; j++) {
        const mid = (clear + hit) / 2;
        const midState = integratePose(fromState, mid, fromState?.steer);
        const midDetails = lineCollisionDetails(midState);
        if (midDetails.touching) {
          hit = mid;
          hitState = midState;
          hitDetails = midDetails;
        } else clear = mid;
      }
      const absoluteDistance = Math.abs(hit);
      return {
        touching: true,
        distance: absoluteDistance,
        fraction: Math.abs(distance) > 1e-12 ? absoluteDistance / Math.abs(distance) : 0,
        state: hitState,
        hits: hitDetails.hits,
        stepsChecked: i,
      };
    }
  }

  const endState = integratePose(fromState, distance, fromState?.steer);
  return { touching: false, distance: null, fraction: null, state: endState, hits: [], stepsChecked: steps };
}

/** Convenience helper for callers that only need stable line names. */
export function sweptLineNames(fromState, signedDistance, options) {
  return sweptLineCollision(fromState, signedDistance, options).hits.map(hit => hit.name);
}

/** Expose sampled swept body geometry for future debug/teaching overlays. */
export function sweptBodySamples(fromState, signedDistance, { samples = 12 } = {}) {
  const count = Math.max(1, Math.min(200, Math.floor(finite(samples, 12))));
  const distance = finite(signedDistance);
  const result = [];
  for (let i = 0; i <= count; i++) {
    const state = integratePose(fromState, distance * i / count, fromState?.steer);
    result.push({ fraction: i / count, state, polygon: bodyPolygon(state) });
  }
  return result;
}
