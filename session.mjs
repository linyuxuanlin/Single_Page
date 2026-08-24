import { isReplayModeActive, getReplayPausedMs } from './replay-runtime.mjs';
import { bayClearances } from './physics.mjs';

const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const exposeSession=session=>{if(typeof window!=='undefined')window.__drivingLabSession=session;return session};
const TIME_EPSILON_SEC=1e-9;
export const PARKING_COMPLETION_DWELL_SEC=.35;
export const PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC=.2;
export const LINE_TOUCH_REARM_CLEAR_SEC=.25;
export const SPEED_FREE_KMH=2.4;
export const SPEED_ADVICE_KMH=3.2;
export function createTrainingSession(startState = {}, startedAt = 0) {
  const initialPose={rearX:finite(startState.rearX),rearZ:finite(startState.rearZ),yaw:finite(startState.yaw),speed:finite(startState.speed),steer:finite(startState.steer),gear:startState.gear??null};
  return exposeSession({startedAt,samples:[],initialPose,lastLineTouch:false,lineTouchArmed:true,lineClearSince:null,lineTouchEvents:0,steeringDirectionChanges:0,lastSteerSign:0,gearChanges:0,lastGear:startState.gear??null,completed:false,completionCandidateSince:null,replayPauseBaselineMs:getReplayPausedMs(),elapsedSec:0});
}
const signWithDeadzone=(v,d=.04)=>v>d?1:v<-d?-1:0;
export function recordTrainingSample(session,sample){
  if(isReplayModeActive()||session?.completed)return exposeSession(session);
  const s=session,state=sample.state??{},deviation=sample.deviation??{},lineTouch=Boolean(sample.lineTouch),steer=finite(state.steer),steerSign=signWithDeadzone(steer);
  const rawT=finite(sample.t,0),pausedSec=Math.max(0,getReplayPausedMs()-(s.replayPauseBaselineMs??0))/1000,previousT=s.samples.at(-1)?.t??0,t=Math.max(previousT,rawT-pausedSec),parkingSuccess=Boolean(sample.parkingSuccess),sampleGap=s.samples.length?Math.max(0,t-previousT):0;
  if(lineTouch){
    // Re-arm only after a clear state has actually been observed for the full window.
    // A long sampling gap is unknown time, not evidence that the car stayed off the line.
    if(!s.lastLineTouch&&s.lineTouchArmed)s.lineTouchEvents++;
    s.lineTouchArmed=false;s.lineClearSince=null;
  }else{
    if(s.lastLineTouch||s.lineClearSince===null||!Number.isFinite(s.lineClearSince))s.lineClearSince=t;
    if(!s.lineTouchArmed&&t-s.lineClearSince>=LINE_TOUCH_REARM_CLEAR_SEC-TIME_EPSILON_SEC)s.lineTouchArmed=true;
  }
  s.lastLineTouch=lineTouch;
  if(steerSign&&s.lastSteerSign&&steerSign!==s.lastSteerSign)s.steeringDirectionChanges++;
  if(steerSign)s.lastSteerSign=steerSign;
  if(state.gear&&s.lastGear&&state.gear!==s.lastGear)s.gearChanges++;
  if(state.gear)s.lastGear=state.gear;
  if(parkingSuccess){
    if(s.completionCandidateSince===null||!Number.isFinite(s.completionCandidateSince)||sampleGap>PARKING_COMPLETION_MAX_SAMPLE_GAP_SEC+TIME_EPSILON_SEC)s.completionCandidateSince=t;
    if(t-s.completionCandidateSince>=PARKING_COMPLETION_DWELL_SEC-TIME_EPSILON_SEC)s.completed=true;
  }else s.completionCandidateSince=null;
  s.elapsedSec=t;
  s.samples.push({t,rearX:finite(state.rearX),rearZ:finite(state.rearZ),yaw:finite(state.yaw),speed:finite(state.speed),steer,gear:state.gear??null,lateral:finite(deviation.lateral),headingErrorDeg:finite(deviation.headingErrorDeg),lineTouch,parkingSuccess,coachCode:sample.coachCode??null});
  return exposeSession(s);
}

export function extractTrainingEvents(session){
  const samples=session?.samples??[];
  if(!samples.length)return{maxLateral:null,maxHeading:null,maxSpeed:null,firstLineTouch:null,steeringChanges:[],gearChanges:[],completion:null};
  const eventFrom=(sample,index,extra={})=>({index,t:sample.t,rearX:sample.rearX,rearZ:sample.rearZ,yaw:sample.yaw,speed:sample.speed,steer:sample.steer,gear:sample.gear,...extra});
  let lateralIndex=0,headingIndex=0,speedIndex=0,firstLineTouch=null,completion=null;const steeringChanges=[],gearChanges=[];let previousSteerSign=signWithDeadzone(samples[0].steer),previousGear=samples[0].gear,wasTouching=false;
  for(let i=0;i<samples.length;i++){const p=samples[i];if(Math.abs(p.lateral)>Math.abs(samples[lateralIndex].lateral))lateralIndex=i;if(Math.abs(p.headingErrorDeg)>Math.abs(samples[headingIndex].headingErrorDeg))headingIndex=i;if(Math.abs(p.speed)>Math.abs(samples[speedIndex].speed))speedIndex=i;if(p.lineTouch&&!wasTouching&&firstLineTouch===null)firstLineTouch=eventFrom(p,i,{type:'line-touch'});wasTouching=p.lineTouch;const steerSign=signWithDeadzone(p.steer);if(i&&steerSign&&previousSteerSign&&steerSign!==previousSteerSign)steeringChanges.push(eventFrom(p,i,{type:'steering-change',from:previousSteerSign,to:steerSign}));if(steerSign)previousSteerSign=steerSign;if(i&&p.gear&&previousGear&&p.gear!==previousGear)gearChanges.push(eventFrom(p,i,{type:'gear-change',from:previousGear,to:p.gear}));if(p.gear)previousGear=p.gear;if(completion===null&&p.parkingSuccess&&session?.completed&&p.t-(session.completionCandidateSince??p.t)>=PARKING_COMPLETION_DWELL_SEC-TIME_EPSILON_SEC)completion=eventFrom(p,i,{type:'completion'});}
  return{maxLateral:eventFrom(samples[lateralIndex],lateralIndex,{type:'max-lateral',value:samples[lateralIndex].lateral}),maxHeading:eventFrom(samples[headingIndex],headingIndex,{type:'max-heading',value:samples[headingIndex].headingErrorDeg}),maxSpeed:eventFrom(samples[speedIndex],speedIndex,{type:'max-speed',value:Math.abs(samples[speedIndex].speed)*3.6}),firstLineTouch,steeringChanges,gearChanges,completion};
}

export function buildReplayTrajectory(session,{maxPoints=180}={}){const samples=session?.samples??[],limit=Math.max(0,Math.floor(maxPoints));if(!samples.length||limit===0)return[];if(samples.length<=limit)return samples.map((p,index)=>({...p,index}));const critical=new Set([0,samples.length-1]),events=extractTrainingEvents(session);for(const event of [events.maxLateral,events.maxHeading,events.maxSpeed,events.firstLineTouch,events.completion])if(event)critical.add(event.index);for(const event of [...events.steeringChanges,...events.gearChanges])critical.add(event.index);const sortedCritical=[...critical].sort((a,b)=>a-b);if(sortedCritical.length>=limit){if(limit===1)return[{...samples[0],index:0}];const chosen=new Set([0,samples.length-1]),pool=sortedCritical.filter(i=>i!==0&&i!==samples.length-1);for(let n=0;n<limit-2&&pool.length;n++)chosen.add(pool[Math.round(n*(pool.length-1)/Math.max(1,limit-3))]);return[...chosen].sort((a,b)=>a-b).map(index=>({...samples[index],index}))}const chosen=new Set(sortedCritical),slots=limit-chosen.size,span=samples.length-1;for(let i=1;i<=slots;i++)chosen.add(Math.round(i*span/(slots+1)));if(chosen.size<limit){for(let i=1;i<samples.length-1&&chosen.size<limit;i++)chosen.add(i)}return[...chosen].sort((a,b)=>a-b).slice(0,limit).map(index=>({...samples[index],index}))}

/** Defensive scoring: corrupted counters can never turn penalties into bonuses or produce scores above 100. */
export function scoreTrainingMetrics(metrics={}){const nonNegative=v=>Math.max(0,finite(v));const penalties={lineTouch:Math.min(50,nonNegative(metrics.lineTouchEvents)*25),lateral:Math.min(22,Math.max(0,nonNegative(metrics.maxLateralM)-.18)*22),heading:Math.min(16,Math.max(0,nonNegative(metrics.maxHeadingErrorDeg)-5)*.8),speed:Math.min(8,Math.max(0,nonNegative(metrics.maxSpeedKmh)-SPEED_FREE_KMH)*4),steering:Math.min(10,Math.max(0,nonNegative(metrics.steeringDirectionChanges)-5)*1.5),incomplete:metrics.completed?0:12};const totalPenalty=Math.max(0,Object.values(penalties).reduce((a,b)=>a+b,0));return{score:Math.max(0,Math.min(100,Math.round(100-totalPenalty))),penalties,totalPenalty};}
export function completedParkingSample(session){const samples=session?.samples??[];if(!samples.length)return null;if(session?.completed){const completion=extractTrainingEvents(session).completion;if(completion)return samples[completion.index];for(let i=samples.length-1;i>=0;i--)if(samples[i].parkingSuccess)return samples[i]}return samples.at(-1)}
function linearSpeedDistance(v0,v1,dt){dt=Math.max(0,finite(dt));v0=finite(v0);v1=finite(v1);if(!dt)return 0;if(v0===0||v1===0||Math.sign(v0)===Math.sign(v1))return .5*(Math.abs(v0)+Math.abs(v1))*dt;const a=Math.abs(v0),b=Math.abs(v1),sum=a+b;return sum>0?dt*(a*a+b*b)/(2*sum):0}
/** Arc-aware travel estimate: speed integration avoids systematically under-counting curved paths; chord length is a defensive lower bound. */
export function trainingTravelDistance(session){const samples=session?.samples??[];if(!samples.length)return 0;const initial=session?.initialPose??{},first=samples[0];let distance=0,prevT=0,prevSpeed=finite(initial.speed),prevX=finite(initial.rearX,finite(first.rearX)),prevZ=finite(initial.rearZ,finite(first.rearZ));for(const p of samples){const t=Math.max(prevT,finite(p.t,prevT)),x=finite(p.rearX,prevX),z=finite(p.rearZ,prevZ),speed=finite(p.speed);const dt=t-prevT,integrated=linearSpeedDistance(prevSpeed,speed,dt),chord=Math.hypot(x-prevX,z-prevZ);distance+=Math.max(integrated,chord);prevT=t;prevSpeed=speed;prevX=x;prevZ=z}return distance}

export function summarizeTrainingSession(session){const samples=session.samples;if(!samples.length)return{score:0,grade:'未开始',durationSec:0,distanceM:0,maxLateralM:0,maxHeadingErrorDeg:0,maxSpeedKmh:0,lineTouchEvents:0,steeringDirectionChanges:0,gearChanges:0,completed:false,finalClearances:null,penalties:{},advice:['开始移动后会生成训练复盘。'],events:extractTrainingEvents(session)};const distanceM=trainingTravelDistance(session);let maxLateralM=0,maxHeadingErrorDeg=0,maxSpeedKmh=0;for(let i=0;i<samples.length;i++){const p=samples[i];maxLateralM=Math.max(maxLateralM,Math.abs(finite(p.lateral)));maxHeadingErrorDeg=Math.max(maxHeadingErrorDeg,Math.abs(finite(p.headingErrorDeg)));maxSpeedKmh=Math.max(maxSpeedKmh,Math.abs(finite(p.speed))*3.6)}const durationSec=Math.max(0,finite(samples.at(-1).t)),metrics={maxLateralM,maxHeadingErrorDeg,maxSpeedKmh,lineTouchEvents:finite(session.lineTouchEvents),steeringDirectionChanges:finite(session.steeringDirectionChanges),completed:Boolean(session.completed)},scoring=scoreTrainingMetrics(metrics),score=scoring.score;const final=completedParkingSample(session),finalClearances=final?bayClearances(final):null;const advice=[];if(session.lineTouchEvents)advice.push(`发生 ${session.lineTouchEvents} 次触线，优先提前观察后轮与车身扫掠范围。`);if(maxLateralM>=.45)advice.push(`最大横向偏差 ${maxLateralM.toFixed(2)} m，入库切入点或回正时机偏差较大。`);if(maxHeadingErrorDeg>=12)advice.push(`最大航向偏差 ${maxHeadingErrorDeg.toFixed(0)}°，注意车身接近平行时及时回正。`);if(maxSpeedKmh>SPEED_ADVICE_KMH)advice.push(`最高速度 ${maxSpeedKmh.toFixed(1)} km/h，倒库训练建议控制在约 ${SPEED_FREE_KMH.toFixed(1)} km/h 以内，以留出观察和修正时间。`);if(session.steeringDirectionChanges>8)advice.push(`方向左右反复修正 ${session.steeringDirectionChanges} 次，尝试更早判断并减少碎方向。`);if(!session.completed)advice.push('本次未达到完整入库判定，建议结合参考轨迹复盘最后一段姿态。');if(session.completed&&finalClearances){const leftCm=Math.round(finalClearances.left*100),rightCm=Math.round(finalClearances.right*100),backCm=Math.round(finalClearances.back*100),imbalanceCm=Math.abs(leftCm-rightCm);if(finalClearances.minSide<.12)advice.push(`最终停车横向净空偏小：左 ${leftCm} cm / 右 ${rightCm} cm，建议在车身平行后留出更均衡的两侧余量。`);else if(imbalanceCm>=20)advice.push(`最终停车左右余量不均：左 ${leftCm} cm / 右 ${rightCm} cm，可在最后直线阶段微调居中。`);if(finalClearances.back<.15)advice.push(`车尾距后侧库线约 ${backCm} cm，停车偏深，建议更早停车。`);else if(finalClearances.back>.65)advice.push(`车尾距后侧库线约 ${backCm} cm，停车偏浅，可在车身完全平行后再缓慢后退。`)}if(!advice.length)advice.push('本次轨迹稳定且最终停车位置均衡，下一次可尝试关闭参考轨迹后重复完成。');const grade=score>=90?'优秀':score>=80?'良好':score>=70?'合格':score>=60?'需改进':'重点练习';return{score,grade,durationSec,distanceM,maxLateralM,maxHeadingErrorDeg,maxSpeedKmh,lineTouchEvents:finite(session.lineTouchEvents),steeringDirectionChanges:finite(session.steeringDirectionChanges),gearChanges:finite(session.gearChanges),completed:Boolean(session.completed),finalClearances,penalties:scoring.penalties,totalPenalty:scoring.totalPenalty,advice,events:extractTrainingEvents(session)}}

if(typeof window!=='undefined')queueMicrotask(()=>import('./replay-ui.mjs').then(m=>m.installReplayUI()).catch(err=>console.warn('replay-ui unavailable',err)));