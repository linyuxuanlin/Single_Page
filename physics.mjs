export const VEHICLE = Object.freeze({
  length: 4.46,
  width: 1.78,
  wheelbase: 2.62,
  trackWidth: 1.52,
  frontOverhang: 0.93,
  rearOverhang: 0.91,
  wheelRadius: 0.31,
  wheelWidth: 0.19,
  maxRoadWheelAngle: 0.56,
  steeringWheelMaxDeg: 540,
  roadWheelRate: 0.82,
  forwardSpeed: 1.20,
  reverseSpeed: 1.05,
  acceleration: 1.65,
  coastBrake: 2.20,
  directionChangeBrake: 3.00,
});

export const COURSE = Object.freeze({
  bayWidth: 2.50,
  bayDepth: 5.20,
  openingZ: -0.20,
  backZ: -5.40,
  lineWidth: 0.08,
  centerX: 0,
  centerZ: -2.80,
});

export const INITIAL_STATE = Object.freeze({
  rearX: 4.80,
  rearZ: 3.20,
  yaw: -Math.PI / 2,
  speed: 0,
  steer: 0,
  gear: 'R',
});

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

export function cloneState(s = INITIAL_STATE) { return { ...s }; }

// Local frame: +X = vehicle right, -X = vehicle left, -Z = forward, +Z = rearward.
// State position is ALWAYS the rear-axle center.
export function localToWorld(lx, lz, s) {
  const c = Math.cos(s.yaw), si = Math.sin(s.yaw);
  return { x: s.rearX + lx * c + lz * si, z: s.rearZ - lx * si + lz * c };
}

export function frontDirection(s) { return { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) }; }

export function integratePose(s, distance, steer = s.steer) {
  if (Math.abs(distance) < 1e-12) return { ...s };
  const k = Math.tan(steer) / VEHICLE.wheelbase;
  if (Math.abs(k) < 1e-10) {
    return { ...s, rearX: s.rearX - Math.sin(s.yaw) * distance, rearZ: s.rearZ - Math.cos(s.yaw) * distance };
  }
  const yaw2 = s.yaw + k * distance;
  return {
    ...s,
    rearX: s.rearX + (Math.cos(yaw2) - Math.cos(s.yaw)) / k,
    rearZ: s.rearZ + (Math.sin(s.yaw) - Math.sin(yaw2)) / k,
    yaw: normalizeAngle(yaw2),
  };
}

export function stepVehicle(s, dt, controls = {}) {
  const next = { ...s };
  const left = Boolean(controls.left), right = Boolean(controls.right);
  const reverse = Boolean(controls.reverse), forward = Boolean(controls.forward); // W=reverse, S=forward

  if (left !== right) {
    const sign = left ? 1 : -1;
    next.steer = clamp(next.steer + sign * VEHICLE.roadWheelRate * dt, -VEHICLE.maxRoadWheelAngle, VEHICLE.maxRoadWheelAngle);
  }
  if (controls.centerSteering) next.steer = 0;
  // No artificial self-centering: releasing A/D holds the current steering angle.

  let targetSpeed = 0;
  if (reverse !== forward) {
    if (reverse) { targetSpeed = -VEHICLE.reverseSpeed; next.gear = 'R'; }
    else { targetSpeed = VEHICLE.forwardSpeed; next.gear = 'D'; }
  }

  const oldSpeed = next.speed;
  let rate;
  if (targetSpeed === 0) rate = VEHICLE.coastBrake;
  else if (oldSpeed !== 0 && Math.sign(targetSpeed) !== Math.sign(oldSpeed)) rate = VEHICLE.directionChangeBrake;
  else rate = VEHICLE.acceleration;
  next.speed += clamp(targetSpeed - next.speed, -rate * dt, rate * dt);
  if (Math.abs(next.speed) < 1e-4 && targetSpeed === 0) next.speed = 0;

  const ds = 0.5 * (oldSpeed + next.speed) * dt;
  const posed = integratePose(next, ds, next.steer);
  next.rearX = posed.rearX; next.rearZ = posed.rearZ; next.yaw = posed.yaw;
  return next;
}

export function steeringWheelDegrees(roadWheelAngle) {
  return roadWheelAngle / VEHICLE.maxRoadWheelAngle * VEHICLE.steeringWheelMaxDeg;
}

export function ackermannAngles(steer) {
  if (Math.abs(steer) < 1e-8) return { left: 0, right: 0 };
  const absR = VEHICLE.wheelbase / Math.abs(Math.tan(steer));
  const inner = Math.atan(VEHICLE.wheelbase / Math.max(0.05, absR - VEHICLE.trackWidth / 2));
  const outer = Math.atan(VEHICLE.wheelbase / (absR + VEHICLE.trackWidth / 2));
  if (steer > 0) return { left: inner, right: outer };
  return { left: -outer, right: -inner };
}

export function wheelPoints(s) {
  const h = VEHICLE.trackWidth / 2;
  return {
    rl: localToWorld(-h, 0, s), rr: localToWorld(h, 0, s),
    fl: localToWorld(-h, -VEHICLE.wheelbase, s), fr: localToWorld(h, -VEHICLE.wheelbase, s),
  };
}

export function bodyPolygon(s) {
  const hw = VEHICLE.width / 2, frontZ = -(VEHICLE.wheelbase + VEHICLE.frontOverhang), rearZ = VEHICLE.rearOverhang;
  return [localToWorld(-hw, frontZ, s), localToWorld(hw, frontZ, s), localToWorld(hw, rearZ, s), localToWorld(-hw, rearZ, s)];
}

export function rectPolygon(cx, cz, width, depth) {
  const hw = width / 2, hd = depth / 2;
  return [{x:cx-hw,z:cz-hd},{x:cx+hw,z:cz-hd},{x:cx+hw,z:cz+hd},{x:cx-hw,z:cz+hd}];
}

function axesFor(poly) {
  const axes=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez)||1;axes.push({x:-ez/len,z:ex/len});}
  return axes;
}
function projection(poly,axis){let min=Infinity,max=-Infinity;for(const p of poly){const v=p.x*axis.x+p.z*axis.z;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
export function polygonsOverlapSAT(a,b,epsilon=1e-9){for(const axis of [...axesFor(a),...axesFor(b)]){const pa=projection(a,axis),pb=projection(b,axis);if(pa.max<pb.min-epsilon||pb.max<pa.min-epsilon)return false}return true}

export function courseLinePolygons(){const c=COURSE,sideCenterZ=(c.openingZ+c.backZ)/2,sideDepth=c.openingZ-c.backZ;return[rectPolygon(-c.bayWidth/2,sideCenterZ,c.lineWidth,sideDepth),rectPolygon(c.bayWidth/2,sideCenterZ,c.lineWidth,sideDepth),rectPolygon(0,c.backZ,c.bayWidth+c.lineWidth,c.lineWidth)]}
const LINE_POLYS=courseLinePolygons();
export function lineViolation(s){const car=bodyPolygon(s);return LINE_POLYS.some(line=>polygonsOverlapSAT(car,line))}

export function isFullyInsideBay(s,margin=0){const l=-COURSE.bayWidth/2+COURSE.lineWidth/2+margin,r=COURSE.bayWidth/2-COURSE.lineWidth/2-margin,f=COURSE.openingZ-COURSE.lineWidth/2-margin,b=COURSE.backZ+COURSE.lineWidth/2+margin;return bodyPolygon(s).every(p=>p.x>l&&p.x<r&&p.z<f&&p.z>b)}
export function headingErrorToBay(s){return Math.abs(normalizeAngle(s.yaw-Math.PI))}
export function parkingSuccess(s){return isFullyInsideBay(s,.015)&&headingErrorToBay(s)<5*Math.PI/180&&Math.abs(s.speed)<.08}
export function predictionDirection(s){if(Math.abs(s.speed)>.05)return Math.sign(s.speed);return s.gear==='D'?1:-1}
export function predictStates(s,{distance=4.2,samples=80}={}){const dir=predictionDirection(s),stepDistance=dir*distance/samples,states=[];let sim={...s};for(let i=0;i<samples;i++){sim=integratePose(sim,stepDistance,sim.steer);states.push(sim)}return states}

export function referenceTrajectory(){let s=cloneState(INITIAL_STATE);const states=[{...s}],radius=INITIAL_STATE.rearX-COURSE.centerX,steer=Math.atan(VEHICLE.wheelbase/radius);s.steer=steer;const k=Math.tan(steer)/VEHICLE.wheelbase,arcDistance=(-Math.PI/2)/k,arcSamples=150;for(let i=0;i<arcSamples;i++){s=integratePose(s,arcDistance/arcSamples,steer);s.steer=steer;states.push({...s})}s.steer=0;const targetRearZ=-4.30,straightDistance=targetRearZ-s.rearZ,straightSamples=45;for(let i=0;i<straightSamples;i++){s=integratePose(s,straightDistance/straightSamples,0);s.steer=0;states.push({...s})}return states}
