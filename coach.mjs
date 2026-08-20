import { bodyPolygon, lineViolation, predictStates, predictionDirection } from './physics.mjs';

/**
 * Teaching/analysis helpers layered on top of the stable vehicle physics.
 * This module never mutates the input state.
 */

export function innerRearWheelKey(steer, epsilon = 1e-4) {
  if (steer > epsilon) return 'rl';
  if (steer < -epsilon) return 'rr';
  return null;
}

export function predictedSweepSamples(state, { distance = 4.6, samples = 85 } = {}) {
  const poses = predictStates(state, { distance, samples });
  return poses.map((pose, index) => ({
    index,
    pose,
    polygon: bodyPolygon(pose),
  }));
}

export function predictLineRisk(state, { distance = 4.6, samples = 85 } = {}) {
  const direction = predictionDirection(state);
  const poses = predictStates(state, { distance, samples });
  const stepDistance = distance / samples;
  const firstTouchIndex = poses.findIndex(lineViolation);
  const willTouch = firstTouchIndex !== -1;
  const firstTouchState = willTouch ? poses[firstTouchIndex] : null;
  const distanceAhead = willTouch ? (firstTouchIndex + 1) * stepDistance : null;

  return {
    willTouch,
    direction,
    firstTouchIndex,
    firstTouchState,
    distanceAhead,
    innerRearWheel: innerRearWheelKey(state.steer),
    samples: poses.length,
  };
}

export function coachHint(state, options) {
  const risk = predictLineRisk(state, options);
  if (risk.willTouch) {
    const meters = risk.distanceAhead < 1 ? risk.distanceAhead.toFixed(1) : risk.distanceAhead.toFixed(1);
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : risk.innerRearWheel === 'rr' ? '右后轮' : '车身';
    return {
      level: risk.distanceAhead <= 0.8 ? 'danger' : 'warn',
      code: 'predicted-line-touch',
      text: `保持当前方向约 ${meters} m 后可能触线，重点观察${wheel}`,
      risk,
    };
  }

  if (Math.abs(state.steer) > 0.08) {
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : '右后轮';
    return {
      level: 'info',
      code: 'watch-inner-rear-wheel',
      text: `当前转弯内侧为${wheel}，注意内轮差`,
      risk,
    };
  }

  return {
    level: 'ok',
    code: 'path-clear',
    text: '当前预测范围内未发现触线风险',
    risk,
  };
}
