export function createTrainingSession(startState = {}, startedAt = 0) {
  return {
    startedAt,
    samples: [],
    lastLineTouch: false,
    lineTouchEvents: 0,
    steeringDirectionChanges: 0,
    lastSteerSign: 0,
    gearChanges: 0,
    lastGear: startState.gear ?? null,
    completed: false,
  };
}

const signWithDeadzone = (v, deadzone = 0.04) => v > deadzone ? 1 : v < -deadzone ? -1 : 0;

export function recordTrainingSample(session, sample) {
  const s = session;
  const state = sample.state ?? {};
  const deviation = sample.deviation ?? {};
  const lineTouch = Boolean(sample.lineTouch);
  const steerSign = signWithDeadzone(state.steer ?? 0);

  if (lineTouch && !s.lastLineTouch) s.lineTouchEvents += 1;
  s.lastLineTouch = lineTouch;

  if (steerSign && s.lastSteerSign && steerSign !== s.lastSteerSign) s.steeringDirectionChanges += 1;
  if (steerSign) s.lastSteerSign = steerSign;

  if (state.gear && s.lastGear && state.gear !== s.lastGear) s.gearChanges += 1;
  if (state.gear) s.lastGear = state.gear;
  if (sample.parkingSuccess) s.completed = true;

  s.samples.push({
    t: Number.isFinite(sample.t) ? sample.t : 0,
    rearX: state.rearX ?? 0,
    rearZ: state.rearZ ?? 0,
    yaw: state.yaw ?? 0,
    speed: state.speed ?? 0,
    steer: state.steer ?? 0,
    gear: state.gear ?? null,
    lateral: deviation.lateral ?? 0,
    headingErrorDeg: deviation.headingErrorDeg ?? 0,
    lineTouch,
    parkingSuccess: Boolean(sample.parkingSuccess),
    coachCode: sample.coachCode ?? null,
  });
  return s;
}

export function summarizeTrainingSession(session) {
  const samples = session.samples;
  if (!samples.length) {
    return {
      score: 0, grade: '未开始', durationSec: 0, distanceM: 0,
      maxLateralM: 0, maxHeadingErrorDeg: 0, maxSpeedKmh: 0,
      lineTouchEvents: 0, steeringDirectionChanges: 0, gearChanges: 0,
      completed: false, advice: ['开始移动后会生成训练复盘。'],
    };
  }

  let distanceM = 0, maxLateralM = 0, maxHeadingErrorDeg = 0, maxSpeedKmh = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    maxLateralM = Math.max(maxLateralM, Math.abs(p.lateral));
    maxHeadingErrorDeg = Math.max(maxHeadingErrorDeg, Math.abs(p.headingErrorDeg));
    maxSpeedKmh = Math.max(maxSpeedKmh, Math.abs(p.speed) * 3.6);
    if (i) distanceM += Math.hypot(p.rearX - samples[i - 1].rearX, p.rearZ - samples[i - 1].rearZ);
  }

  const durationSec = Math.max(0, samples.at(-1).t - samples[0].t);
  let score = 100;
  score -= Math.min(50, session.lineTouchEvents * 25);
  score -= Math.min(22, Math.max(0, maxLateralM - 0.18) * 22);
  score -= Math.min(16, Math.max(0, maxHeadingErrorDeg - 5) * 0.8);
  score -= Math.min(8, Math.max(0, maxSpeedKmh - 4.5) * 2.5);
  score -= Math.min(10, Math.max(0, session.steeringDirectionChanges - 5) * 1.5);
  if (!session.completed) score -= 12;
  score = Math.max(0, Math.round(score));

  const advice = [];
  if (session.lineTouchEvents) advice.push(`发生 ${session.lineTouchEvents} 次触线，优先提前观察后轮与车身扫掠范围。`);
  if (maxLateralM >= 0.45) advice.push(`最大横向偏差 ${maxLateralM.toFixed(2)} m，入库切入点或回正时机偏差较大。`);
  if (maxHeadingErrorDeg >= 12) advice.push(`最大航向偏差 ${maxHeadingErrorDeg.toFixed(0)}°，注意车身接近平行时及时回正。`);
  if (maxSpeedKmh > 5.5) advice.push(`最高速度 ${maxSpeedKmh.toFixed(1)} km/h，训练时建议更低速以留出观察和修正时间。`);
  if (session.steeringDirectionChanges > 8) advice.push(`方向左右反复修正 ${session.steeringDirectionChanges} 次，尝试更早判断并减少碎方向。`);
  if (!session.completed) advice.push('本次未达到完整入库判定，建议结合参考轨迹复盘最后一段姿态。');
  if (!advice.length) advice.push('本次轨迹稳定，下一次可尝试关闭参考轨迹后重复完成。');

  const grade = score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 70 ? '合格' : score >= 60 ? '需改进' : '重点练习';
  return {
    score, grade, durationSec, distanceM, maxLateralM, maxHeadingErrorDeg, maxSpeedKmh,
    lineTouchEvents: session.lineTouchEvents,
    steeringDirectionChanges: session.steeringDirectionChanges,
    gearChanges: session.gearChanges,
    completed: session.completed,
    advice,
  };
}
