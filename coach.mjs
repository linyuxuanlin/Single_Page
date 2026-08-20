import {
  bodyPolygon,
  lineViolation,
  predictStates,
  predictionDirection,
  referenceTrajectory,
  normalizeAngle,
} from './physics.mjs';

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

const REFERENCE = referenceTrajectory();

export function nearestReferencePose(state, reference = REFERENCE) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < reference.length; i++) {
    const pose = reference[i];
    const d = Math.hypot(state.rearX - pose.rearX, state.rearZ - pose.rearZ);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return {
    index: bestIndex,
    pose: bestIndex >= 0 ? reference[bestIndex] : null,
    distance: bestDistance,
    progress: bestIndex >= 0 && reference.length > 1 ? bestIndex / (reference.length - 1) : 0,
  };
}

export function referenceDeviation(state, reference = REFERENCE) {
  const nearest = nearestReferencePose(state, reference);
  if (!nearest.pose) {
    return {
      nearest,
      lateral: 0,
      longitudinal: 0,
      headingErrorRad: 0,
      headingErrorDeg: 0,
    };
  }

  const pose = nearest.pose;
  const dx = state.rearX - pose.rearX;
  const dz = state.rearZ - pose.rearZ;
  // Local frame of the reference pose: +X = vehicle right, -Z = vehicle forward.
  const c = Math.cos(pose.yaw);
  const si = Math.sin(pose.yaw);
  const lateral = dx * c - dz * si;
  const longitudinal = dx * si + dz * c;
  const headingErrorRad = normalizeAngle(state.yaw - pose.yaw);

  return {
    nearest,
    lateral,
    longitudinal,
    headingErrorRad,
    headingErrorDeg: headingErrorRad * 180 / Math.PI,
  };
}

export function coachHint(state, options) {
  const risk = predictLineRisk(state, options);
  const deviation = referenceDeviation(state);

  if (risk.willTouch) {
    const meters = risk.distanceAhead.toFixed(1);
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : risk.innerRearWheel === 'rr' ? '右后轮' : '车身';
    return {
      level: risk.distanceAhead <= 0.8 ? 'danger' : 'warn',
      code: 'predicted-line-touch',
      text: `保持当前方向约 ${meters} m 后可能触线，重点观察${wheel}`,
      risk,
      deviation,
    };
  }

  if (deviation.nearest.distance <= 1.5 && Math.abs(deviation.lateral) >= 0.35) {
    const side = deviation.lateral > 0 ? '右' : '左';
    return {
      level: Math.abs(deviation.lateral) >= 0.7 ? 'warn' : 'info',
      code: 'reference-lateral-deviation',
      text: `后轴相对参考轨迹偏${side} ${Math.abs(deviation.lateral).toFixed(1)} m，注意修正入库位置`,
      risk,
      deviation,
    };
  }

  if (deviation.nearest.distance <= 1.5 && Math.abs(deviation.headingErrorDeg) >= 7) {
    const side = deviation.headingErrorDeg > 0 ? '左' : '右';
    return {
      level: Math.abs(deviation.headingErrorDeg) >= 14 ? 'warn' : 'info',
      code: 'reference-heading-deviation',
      text: `车身方向相对参考姿态向${side}偏 ${Math.abs(deviation.headingErrorDeg).toFixed(0)}°，注意回正时机`,
      risk,
      deviation,
    };
  }

  if (Math.abs(state.steer) > 0.08) {
    const wheel = risk.innerRearWheel === 'rl' ? '左后轮' : '右后轮';
    return {
      level: 'info',
      code: 'watch-inner-rear-wheel',
      text: `当前转弯内侧为${wheel}，注意内轮差`,
      risk,
      deviation,
    };
  }

  return {
    level: 'ok',
    code: 'path-clear',
    text: '当前预测范围内未发现触线风险',
    risk,
    deviation,
  };
}
