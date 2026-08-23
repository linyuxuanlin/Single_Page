import {
  bodyPolygon,
  lineCollisionDetails,
  predictStates,
  predictPathSegments,
  predictionDirection,
  referenceTrajectory,
  normalizeAngle,
} from './physics.mjs';
import { sweptLineCollision } from './swept-collision.mjs';
import { publishRiskOverlay } from './risk-overlay.mjs';

/** Teaching/analysis helpers layered on top of the stable vehicle physics. */
export function innerRearWheelKey(steer, epsilon = 1e-4) {
  if (steer > epsilon) return 'rl';
  if (steer < -epsilon) return 'rr';
  return null;
}

const DEFAULT_PREDICTION_SAMPLES = 32;
export const LIVE_COACH_MAX_SAMPLES = DEFAULT_PREDICTION_SAMPLES;

function predictionOptions({ distance = 4.6, samples = DEFAULT_PREDICTION_SAMPLES } = {}) {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 4.6;
  const safeSamples = Number.isFinite(samples) ? Math.min(2000, Math.max(1, Math.floor(samples))) : DEFAULT_PREDICTION_SAMPLES;
  return { distance: safeDistance, samples: safeSamples };
}

function liveCoachPredictionOptions(options = {}) {
  const normalized = predictionOptions(options);
  return { ...normalized, samples: Math.min(normalized.samples, LIVE_COACH_MAX_SAMPLES) };
}

export function predictedSweepSamples(state, options = {}) {
  const { distance, samples } = predictionOptions(options);
  // Sweep visualization must follow the same residual-motion -> braking -> new
  // gear path as collision coaching. predictStates() intentionally collapses
  // the path to one direction and can therefore draw the sweep on the wrong
  // side immediately after a D/R change while the vehicle is still moving.
  const poses = predictPathSegments(state, { distance, samples }).map(segment => segment.state);
  return poses.map((pose, index) => ({ index, pose, polygon: bodyPolygon(pose) }));
}

function collisionNames(state) {
  return lineCollisionDetails(state).hits.map(hit => hit.name);
}

function selectedGearDirection(state) {
  return state?.gear === 'D' ? 1 : -1;
}

export function predictLineRisk(state, options = {}) {
  const { distance, samples } = predictionOptions(options);
  const direction = predictionDirection(state);
  const currentHits = collisionNames(state);
  const alreadyTouching = currentHits.length > 0;

  // A one-sample visual budget is allowed to collapse a reversal path to its
  // dominant phase. Collision coaching cannot do that safely: a very short
  // residual-motion braking phase may be the only phase that touches a line.
  const reversalSafetyFloorApplied = samples === 1 && direction !== selectedGearDirection(state);
  const collisionSamples = reversalSafetyFloorApplied ? 2 : samples;
  const segments = predictPathSegments(state, { distance, samples: collisionSamples });
  const firstDirection = segments[0]?.direction ?? direction;
  const reversalIndex = segments.findIndex(segment => segment.direction !== firstDirection);
  const reversing = reversalIndex > 0;
  const stopDistanceAhead = reversing
    ? segments.slice(0, reversalIndex).reduce((sum, segment) => sum + Math.abs(segment.distance), 0)
    : 0;
  let predictedTouchIndex = -1;
  let predictedHits = [];
  let firstTouchState = null;
  let distanceAhead = null;
  let resolutionLimited = false;

  if (alreadyTouching) {
    firstTouchState = state;
    distanceAhead = 0;
  } else {
    let segmentStart = state;
    let travelled = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const swept = sweptLineCollision(segmentStart, segment.distance, { assumeStartClear: true });
      resolutionLimited ||= swept.resolutionLimited;
      if (swept.touching) {
        predictedTouchIndex = i;
        firstTouchState = swept.state;
        predictedHits = swept.hits.map(hit => hit.name);
        distanceAhead = travelled + swept.distance;
        break;
      }
      travelled += Math.abs(segment.distance);
      segmentStart = segment.state;
    }
  }

  const willTouch = alreadyTouching || predictedTouchIndex !== -1;
  return {
    willTouch,
    alreadyTouching,
    direction,
    reversing,
    stopDistanceAhead,
    firstTouchIndex: alreadyTouching ? -1 : predictedTouchIndex,
    firstTouchState,
    distanceAhead,
    hitLines: alreadyTouching ? currentHits : predictedHits,
    innerRearWheel: innerRearWheelKey(state.steer),
    samples: segments.length,
    requestedSamples: samples,
    reversalSafetyFloorApplied,
    resolutionLimited,
    predictionReliable: !resolutionLimited,
  };
}

const REFERENCE = referenceTrajectory();

export function nearestReferencePose(state, reference = REFERENCE) {
  let bestIndex = -1, bestDistance = Infinity;
  for (let i = 0; i < reference.length; i++) {
    const pose = reference[i];
    const d = Math.hypot(state.rearX - pose.rearX, state.rearZ - pose.rearZ);
    if (d < bestDistance) { bestDistance = d; bestIndex = i; }
  }
  return { index: bestIndex, pose: bestIndex >= 0 ? reference[bestIndex] : null, distance: bestDistance, progress: bestIndex >= 0 && reference.length > 1 ? bestIndex / (reference.length - 1) : 0 };
}

export function referenceDeviation(state, reference = REFERENCE) {
  const nearest = nearestReferencePose(state, reference);
  if (!nearest.pose) return { nearest, lateral: 0, longitudinal: 0, headingErrorRad: 0, headingErrorDeg: 0 };
  const pose = nearest.pose, dx = state.rearX - pose.rearX, dz = state.rearZ - pose.rearZ;
  const c = Math.cos(pose.yaw), si = Math.sin(pose.yaw);
  const lateral = dx * c - dz * si;
  const longitudinal = dx * si + dz * c;
  const headingErrorRad = normalizeAngle(state.yaw - pose.yaw);
  return { nearest, lateral, longitudinal, headingErrorRad, headingErrorDeg: headingErrorRad * 180 / Math.PI };
}

function lineLabel(lines = []) {
  const labels = { left: '左侧库线', right: '右侧库线', back: '后侧库线' };
  return lines.map(line => labels[line] || line).join('、');
}

export function coachHint(state, options = {}) {
  const risk = predictLineRisk(state, liveCoachPredictionOptions(options));
  const deviation = referenceDeviation(state);
  publishRiskOverlay(risk);

  if (risk.alreadyTouching) {
    const lines = lineLabel(risk.hitLines);
    return { level: 'danger', code: 'line-touch-now', text: lines ? `当前车身已触碰${lines}，先停车并观察车身与库线位置` : '当前车身已经触线，先停车并观察车身与库线位置', risk, deviation };
  }
  if (risk.willTouch) {
    const meters = risk.distanceAhead.toFixed(1);
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : risk.innerRearWheel === 'rr' ? '右后轮' : '车身';
    const lines = lineLabel(risk.hitLines);
    return { level: risk.distanceAhead <= 0.8 ? 'danger' : 'warn', code: 'predicted-line-touch', text: `保持当前方向约 ${meters} m 后可能触碰${lines || '库线'}，重点观察${wheel}`, risk, deviation };
  }
  // Never turn a deliberately resolution-limited sweep into a false “clear”.
  // This is mainly a guard for diagnostic/very-long-horizon callers; normal
  // 4.6 m live coaching remains comfortably inside the spatial budget.
  if (!risk.predictionReliable) {
    return { level: 'warn', code: 'prediction-resolution-limited', text: '预测范围过大，当前无法可靠排除中途触线，请缩短预测范围后再判断', risk, deviation };
  }
  if (risk.reversing) {
    const cm = Math.max(1, Math.round(risk.stopDistanceAhead * 100));
    return { level: 'info', code: 'direction-change-braking', text: `正在换向制动，约 ${cm} cm 后停稳，再按当前挡位继续行驶`, risk, deviation };
  }
  if (deviation.nearest.distance <= 1.5 && Math.abs(deviation.lateral) >= 0.35) {
    const side = deviation.lateral > 0 ? '右' : '左';
    return { level: Math.abs(deviation.lateral) >= 0.7 ? 'warn' : 'info', code: 'reference-lateral-deviation', text: `后轴相对参考轨迹偏${side} ${Math.abs(deviation.lateral).toFixed(1)} m，注意修正入库位置`, risk, deviation };
  }
  if (deviation.nearest.distance <= 1.5 && Math.abs(deviation.headingErrorDeg) >= 7) {
    const side = deviation.headingErrorDeg > 0 ? '左' : '右';
    return { level: Math.abs(deviation.headingErrorDeg) >= 14 ? 'warn' : 'info', code: 'reference-heading-deviation', text: `车身方向相对参考姿态向${side}偏 ${Math.abs(deviation.headingErrorDeg).toFixed(0)}°，注意回正时机`, risk, deviation };
  }
  if (Math.abs(state.steer) > 0.08) {
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : '右后轮';
    return { level: 'info', code: 'watch-inner-rear-wheel', text: `当前转弯内侧为${wheel}，注意内轮差`, risk, deviation };
  }
  return { level: 'ok', code: 'path-clear', text: '当前预测范围内未发现触线风险', risk, deviation };
}