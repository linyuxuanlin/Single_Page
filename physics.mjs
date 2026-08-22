import { resolveReplayStep } from './replay-runtime.mjs';

export const VEHICLE = Object.freeze({length:4.46,width:1.78,wheelbase:2.62,trackWidth:1.52,frontOverhang:.93,rearOverhang:.91,wheelRadius:.31,wheelWidth:.19,maxRoadWheelAngle:.56,steeringWheelMaxDeg:540,roadWheelRate:.82,forwardSpeed:1.20,reverseSpeed:1.05,acceleration:1.65,coastBrake:2.20,directionChangeBrake:3.00});
export const CONTROL_BINDINGS=Object.freeze({KeyW:'forward',ArrowUp:'forward',KeyS:'reverse',ArrowDown:'reverse',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'});
export const COURSE=Object.freeze({bayWidth:2.50,bayDepth:5.20,openingZ:-.20,backZ:-5.40,lineWidth:.08,centerX:0,centerZ:-2.80});
export const INITIAL_STATE=Object.freeze({rearX:4.80,rearZ:3.20,yaw:-Math.PI/2,speed:0,steer:0,gear:'R'});
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<=-Math.PI)a+=Math.PI*2;return a}
export function cloneState(s=INITIAL_STATE){return {...s}}
export function localToWorld(lx,lz,s){const c=Math.cos(s.yaw),si=Math.sin(s.yaw);return{x:s.rearX+lx*c+lz*si,z:s.rearZ-lx*si+lz*c}}
export function frontDirection(s){return{x:-Math.sin(s.yaw),z:-Math.cos(s.yaw)}}
export function integratePose(s,distance,steer=s.steer){if(Math.abs(distance)<1e-12)return{...s};const k=Math.tan(steer)/VEHICLE.wheelbase;if(Math.abs(k)<1e-10)return{...s,rearX:s.rearX-Math.sin(s.yaw)*distance,rearZ:s.rearZ-Math.cos(s.yaw)*distance};const yaw2=s.yaw+k*distance;return{...s,rearX:s.rearX+(Math.cos(yaw2)-Math.cos(s.yaw))/k,rearZ:s.rearZ+(Math.sin(s.yaw)-Math.sin(yaw2))/k,yaw:normalizeAngle(yaw2)}}
export function stepVehicle(s,dt,controls={}){const replay=resolveReplayStep(s);if(replay.handled)return replay.state;const next={...s},left=!!controls.left,right=!!controls.right,reverse=!!controls.reverse,forward=!!controls.forward;if(left!==right)next.steer=clamp(next.steer+(left?1:-1)*VEHICLE.roadWheelRate*dt,-VEHICLE.maxRoadWheelAngle,VEHICLE.maxRoadWheelAngle);if(controls.centerSteering)next.steer=0;let targetSpeed=0;if(reverse!==forward){if(reverse){targetSpeed=-VEHICLE.reverseSpeed;next.gear='R'}else{targetSpeed=VEHICLE.forwardSpeed;next.gear='D'}}const oldSpeed=next.speed;let rate;if(targetSpeed===0)rate=VEHICLE.coastBrake;else if(oldSpeed!==0&&Math.sign(targetSpeed)!==Math.sign(oldSpeed))rate=VEHICLE.directionChangeBrake;else rate=VEHICLE.acceleration;next.speed+=clamp(targetSpeed-next.speed,-rate*dt,rate*dt);if(Math.abs(next.speed)<1e-4&&targetSpeed===0)next.speed=0;const posed=integratePose(next,.5*(oldSpeed+next.speed)*dt,next.steer);next.rearX=posed.rearX;next.rearZ=posed.rearZ;next.yaw=posed.yaw;return next}
export function steeringWheelDegrees(a){return a/VEHICLE.maxRoadWheelAngle*VEHICLE.steeringWheelMaxDeg}
export function ackermannAngles(steer){if(Math.abs(steer)<1e-8)return{left:0,right:0};const absR=VEHICLE.wheelbase/Math.abs(Math.tan(steer)),inner=Math.atan(VEHICLE.wheelbase/Math.max(.05,absR-VEHICLE.trackWidth/2)),outer=Math.atan(VEHICLE.wheelbase/(absR+VEHICLE.trackWidth/2));return steer>0?{left:inner,right:outer}:{left:-outer,right:-inner}}
export function wheelPoints(s){const h=VEHICLE.trackWidth/2;return{rl:localToWorld(-h,0,s),rr:localToWorld(h,0,s),fl:localToWorld(-h,-VEHICLE.wheelbase,s),fr:localToWorld(h,-VEHICLE.wheelbase,s)}}
export function bodyPolygon(s){const hw=VEHICLE.width/2,fz=-(VEHICLE.wheelbase+VEHICLE.frontOverhang),rz=VEHICLE.rearOverhang;return[localToWorld(-hw,fz,s),localToWorld(hw,fz,s),localToWorld(hw,rz,s),localToWorld(-hw,rz,s)]}
export function rectPolygon(cx,cz,width,depth){const hw=width/2,hd=depth/2;return[{x:cx-hw,z:cz-hd},{x:cx+hw,z:cz-hd},{x:cx+hw,z:cz+hd},{x:cx-hw,z:cz+hd}]}
function axesFor(poly){const axes=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez)||1;axes.push({x:-ez/len,z:ex/len})}return axes}
function projection(poly,axis){let min=Infinity,max=-Infinity;for(const p of poly){const v=p.x*axis.x+p.z*axis.z;min=Math.min(min,v);max=Math.max(max,v)}return{min,max}}
export function polygonsOverlapSAT(a,b,epsilon=1e-9){for(const axis of[...axesFor(a),...axesFor(b)]){const pa=projection(a,axis),pb=projection(b,axis);if(pa.max<pb.min-epsilon||pb.max<pa.min-epsilon)return false}return true}
export function courseLinePolygons(){const c=COURSE,sideCenterZ=(c.openingZ+c.backZ)/2,sideDepth=c.openingZ-c.backZ;return[rectPolygon(-c.bayWidth/2,sideCenterZ,c.lineWidth,sideDepth),rectPolygon(c.bayWidth/2,sideCenterZ,c.lineWidth,sideDepth),rectPolygon(0,c.backZ,c.bayWidth+c.lineWidth,c.lineWidth)]}
const LINE_POLYS=courseLinePolygons();
export const COURSE_LINE_NAMES=Object.freeze(['left','right','back']);
/** Detailed collision result for coaching/replay highlighting. */
export function lineCollisionDetails(s){const car=bodyPolygon(s),hits=[];for(let i=0;i<LINE_POLYS.length;i++)if(polygonsOverlapSAT(car,LINE_POLYS[i]))hits.push({index:i,name:COURSE_LINE_NAMES[i],polygon:LINE_POLYS[i].map(p=>({...p}))});return{touching:hits.length>0,hits}}
export function lineViolation(s){return lineCollisionDetails(s).touching}
export function isFullyInsideBay(s,margin=0){const l=-COURSE.bayWidth/2+COURSE.lineWidth/2+margin,r=COURSE.bayWidth/2-COURSE.lineWidth/2-margin,f=COURSE.openingZ-COURSE.lineWidth/2-margin,b=COURSE.backZ+COURSE.lineWidth/2+margin;return bodyPolygon(s).every(p=>p.x>l&&p.x<r&&p.z<f&&p.z>b)}
export function headingErrorToBay(s){return Math.abs(normalizeAngle(s.yaw-Math.PI))}
export function parkingSuccess(s){return isFullyInsideBay(s,.015)&&headingErrorToBay(s)<5*Math.PI/180&&Math.abs(s.speed)<.08}
export function predictionDirection(s){if(Math.abs(s.speed)>.05)return Math.sign(s.speed);return s.gear==='D'?1:-1}
/** Deterministic trajectory prediction with bounded, finite inputs. */
export function predictStates(s,{distance=4.2,samples=80}={}){const safeDistance=Number.isFinite(distance)?Math.max(0,distance):0;const safeSamples=Number.isFinite(samples)?Math.max(1,Math.min(2000,Math.floor(samples))):80;const dir=predictionDirection(s),stepDistance=dir*safeDistance/safeSamples,states=[];let sim={...s};for(let i=0;i<safeSamples;i++){sim=integratePose(sim,stepDistance,sim.steer);states.push(sim)}return states}
export function referenceTrajectory(){let s=cloneState(INITIAL_STATE);const states=[{...s}],radius=INITIAL_STATE.rearX-COURSE.centerX,steer=Math.atan(VEHICLE.wheelbase/radius);s.steer=steer;const k=Math.tan(steer)/VEHICLE.wheelbase,arcDistance=(-Math.PI/2)/k;for(let i=0;i<150;i++){s=integratePose(s,arcDistance/150,steer);s.steer=steer;states.push({...s})}s.steer=0;const straightDistance=-4.30-s.rearZ;for(let i=0;i<45;i++){s=integratePose(s,straightDistance/45,0);s.steer=0;states.push({...s})}return states}
