export function createTrainingSession(startState = {}, startedAt = 0) {
  return {startedAt,samples:[],lastLineTouch:false,lineTouchEvents:0,steeringDirectionChanges:0,lastSteerSign:0,gearChanges:0,lastGear:startState.gear??null,completed:false};
}
const signWithDeadzone=(v,d=.04)=>v>d?1:v<-d?-1:0;
export function recordTrainingSample(session,sample){const s=session,state=sample.state??{},deviation=sample.deviation??{},lineTouch=Boolean(sample.lineTouch),steerSign=signWithDeadzone(state.steer??0);if(lineTouch&&!s.lastLineTouch)s.lineTouchEvents++;s.lastLineTouch=lineTouch;if(steerSign&&s.lastSteerSign&&steerSign!==s.lastSteerSign)s.steeringDirectionChanges++;if(steerSign)s.lastSteerSign=steerSign;if(state.gear&&s.lastGear&&state.gear!==s.lastGear)s.gearChanges++;if(state.gear)s.lastGear=state.gear;if(sample.parkingSuccess)s.completed=true;s.samples.push({t:Number.isFinite(sample.t)?sample.t:0,rearX:state.rearX??0,rearZ:state.rearZ??0,yaw:state.yaw??0,speed:state.speed??0,steer:state.steer??0,gear:state.gear??null,lateral:deviation.lateral??0,headingErrorDeg:deviation.headingErrorDeg??0,lineTouch,parkingSuccess:Boolean(sample.parkingSuccess),coachCode:sample.coachCode??null});return s;}

export function extractTrainingEvents(session){
  const samples=session?.samples??[];
  if(!samples.length)return{maxLateral:null,maxHeading:null,maxSpeed:null,firstLineTouch:null,steeringChanges:[],gearChanges:[],completion:null};
  const eventFrom=(sample,index,extra={})=>({index,t:sample.t,rearX:sample.rearX,rearZ:sample.rearZ,yaw:sample.yaw,speed:sample.speed,steer:sample.steer,gear:sample.gear,...extra});
  let lateralIndex=0,headingIndex=0,speedIndex=0,firstLineTouch=null,completion=null;
  const steeringChanges=[],gearChanges=[];
  let previousSteerSign=signWithDeadzone(samples[0].steer),previousGear=samples[0].gear,wasTouching=false;
  for(let i=0;i<samples.length;i++){
    const p=samples[i];
    if(Math.abs(p.lateral)>Math.abs(samples[lateralIndex].lateral))lateralIndex=i;
    if(Math.abs(p.headingErrorDeg)>Math.abs(samples[headingIndex].headingErrorDeg))headingIndex=i;
    if(Math.abs(p.speed)>Math.abs(samples[speedIndex].speed))speedIndex=i;
    if(p.lineTouch&&!wasTouching&&firstLineTouch===null)firstLineTouch=eventFrom(p,i,{type:'line-touch'});
    wasTouching=p.lineTouch;
    const steerSign=signWithDeadzone(p.steer);
    if(i&&steerSign&&previousSteerSign&&steerSign!==previousSteerSign)steeringChanges.push(eventFrom(p,i,{type:'steering-change',from:previousSteerSign,to:steerSign}));
    if(steerSign)previousSteerSign=steerSign;
    if(i&&p.gear&&previousGear&&p.gear!==previousGear)gearChanges.push(eventFrom(p,i,{type:'gear-change',from:previousGear,to:p.gear}));
    if(p.gear)previousGear=p.gear;
    if(completion===null&&p.parkingSuccess)completion=eventFrom(p,i,{type:'completion'});
  }
  return{
    maxLateral:eventFrom(samples[lateralIndex],lateralIndex,{type:'max-lateral',value:samples[lateralIndex].lateral}),
    maxHeading:eventFrom(samples[headingIndex],headingIndex,{type:'max-heading',value:samples[headingIndex].headingErrorDeg}),
    maxSpeed:eventFrom(samples[speedIndex],speedIndex,{type:'max-speed',value:Math.abs(samples[speedIndex].speed)*3.6}),
    firstLineTouch,steeringChanges,gearChanges,completion
  };
}

export function buildReplayTrajectory(session,{maxPoints=180}={}){
  const samples=session?.samples??[];
  const limit=Math.max(0,Math.floor(maxPoints));
  if(!samples.length||limit===0)return[];
  if(samples.length<=limit)return samples.map((p,index)=>({...p,index}));
  const critical=new Set([0,samples.length-1]);
  const events=extractTrainingEvents(session);
  for(const event of [events.maxLateral,events.maxHeading,events.maxSpeed,events.firstLineTouch,events.completion])if(event)critical.add(event.index);
  for(const event of [...events.steeringChanges,...events.gearChanges])critical.add(event.index);
  const sortedCritical=[...critical].sort((a,b)=>a-b);
  if(sortedCritical.length>=limit){
    if(limit===1)return[{...samples[0],index:0}];
    const chosen=new Set([0,samples.length-1]);
    const pool=sortedCritical.filter(i=>i!==0&&i!==samples.length-1);
    for(let n=0;n<limit-2&&pool.length;n++)chosen.add(pool[Math.round(n*(pool.length-1)/Math.max(1,limit-3))]);
    return[...chosen].sort((a,b)=>a-b).map(index=>({...samples[index],index}));
  }
  const chosen=new Set(sortedCritical),slots=limit-chosen.size,span=samples.length-1;
  for(let i=1;i<=slots;i++)chosen.add(Math.round(i*span/(slots+1)));
  if(chosen.size<limit){for(let i=1;i<samples.length-1&&chosen.size<limit;i++)chosen.add(i)}
  return[...chosen].sort((a,b)=>a-b).slice(0,limit).map(index=>({...samples[index],index}));
}

export function scoreTrainingMetrics(metrics){const penalties={lineTouch:Math.min(50,metrics.lineTouchEvents*25),lateral:Math.min(22,Math.max(0,metrics.maxLateralM-.18)*22),heading:Math.min(16,Math.max(0,metrics.maxHeadingErrorDeg-5)*.8),speed:Math.min(8,Math.max(0,metrics.maxSpeedKmh-4.5)*2.5),steering:Math.min(10,Math.max(0,metrics.steeringDirectionChanges-5)*1.5),incomplete:metrics.completed?0:12};const totalPenalty=Object.values(penalties).reduce((a,b)=>a+b,0);return{score:Math.max(0,Math.round(100-totalPenalty)),penalties,totalPenalty};}
export function summarizeTrainingSession(session){const samples=session.samples;if(!samples.length)return{score:0,grade:'未开始',durationSec:0,distanceM:0,maxLateralM:0,maxHeadingErrorDeg:0,maxSpeedKmh:0,lineTouchEvents:0,steeringDirectionChanges:0,gearChanges:0,completed:false,penalties:{},advice:['开始移动后会生成训练复盘。'],events:extractTrainingEvents(session)};let distanceM=0,maxLateralM=0,maxHeadingErrorDeg=0,maxSpeedKmh=0;for(let i=0;i<samples.length;i++){const p=samples[i];maxLateralM=Math.max(maxLateralM,Math.abs(p.lateral));maxHeadingErrorDeg=Math.max(maxHeadingErrorDeg,Math.abs(p.headingErrorDeg));maxSpeedKmh=Math.max(maxSpeedKmh,Math.abs(p.speed)*3.6);if(i)distanceM+=Math.hypot(p.rearX-samples[i-1].rearX,p.rearZ-samples[i-1].rearZ)}const durationSec=Math.max(0,samples.at(-1).t-samples[0].t),metrics={maxLateralM,maxHeadingErrorDeg,maxSpeedKmh,lineTouchEvents:session.lineTouchEvents,steeringDirectionChanges:session.steeringDirectionChanges,completed:session.completed},scoring=scoreTrainingMetrics(metrics),score=scoring.score;const advice=[];if(session.lineTouchEvents)advice.push(`发生 ${session.lineTouchEvents} 次触线，优先提前观察后轮与车身扫掠范围。`);if(maxLateralM>=.45)advice.push(`最大横向偏差 ${maxLateralM.toFixed(2)} m，入库切入点或回正时机偏差较大。`);if(maxHeadingErrorDeg>=12)advice.push(`最大航向偏差 ${maxHeadingErrorDeg.toFixed(0)}°，注意车身接近平行时及时回正。`);if(maxSpeedKmh>5.5)advice.push(`最高速度 ${maxSpeedKmh.toFixed(1)} km/h，训练时建议更低速以留出观察和修正时间。`);if(session.steeringDirectionChanges>8)advice.push(`方向左右反复修正 ${session.steeringDirectionChanges} 次，尝试更早判断并减少碎方向。`);if(!session.completed)advice.push('本次未达到完整入库判定，建议结合参考轨迹复盘最后一段姿态。');if(!advice.length)advice.push('本次轨迹稳定，下一次可尝试关闭参考轨迹后重复完成。');const grade=score>=90?'优秀':score>=80?'良好':score>=70?'合格':score>=60?'需改进':'重点练习';return{score,grade,durationSec,distanceM,maxLateralM,maxHeadingErrorDeg,maxSpeedKmh,lineTouchEvents:session.lineTouchEvents,steeringDirectionChanges:session.steeringDirectionChanges,gearChanges:session.gearChanges,completed:session.completed,penalties:scoring.penalties,totalPenalty:scoring.totalPenalty,advice,events:extractTrainingEvents(session)};}
