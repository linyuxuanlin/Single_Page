import {buildReplayTrajectory,extractTrainingEvents} from './session.mjs';

const EVENT_PRIORITY=Object.freeze({'line-touch':100,'max-lateral':90,'max-heading':80,'max-speed':70,'completion':60,'gear-change':50,'steering-change':40});
const LABELS=Object.freeze({'line-touch':'首次触线','max-lateral':'最大横向偏差','max-heading':'最大航向偏差','max-speed':'最高速度','completion':'完成入库','gear-change':'换挡','steering-change':'反向修方向'});
const clamp01=v=>Math.max(0,Math.min(1,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const lerpAngle=(a,b,t)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<=-Math.PI)d+=Math.PI*2;return a+d*t};

export function buildReplayMarkers(session,{maxMarkers=10}={}){
  const events=extractTrainingEvents(session);
  const all=[events.firstLineTouch,events.maxLateral,events.maxHeading,events.maxSpeed,events.completion,...events.gearChanges,...events.steeringChanges].filter(Boolean);
  const bySample=new Map();
  for(const event of all){const existing=bySample.get(event.index);if(!existing||(EVENT_PRIORITY[event.type]??0)>(EVENT_PRIORITY[existing.type]??0))bySample.set(event.index,event)}
  return [...bySample.values()].sort((a,b)=>(EVENT_PRIORITY[b.type]??0)-(EVENT_PRIORITY[a.type]??0)||a.index-b.index).slice(0,Math.max(0,Math.floor(maxMarkers))).sort((a,b)=>a.index-b.index).map(event=>({...event,label:LABELS[event.type]??event.type}));
}

export function buildReplayModel(session,{maxPoints=180,maxMarkers=10}={}){
  const trajectory=buildReplayTrajectory(session,{maxPoints}),markers=buildReplayMarkers(session,{maxMarkers}),trajectoryIndices=new Set(trajectory.map(p=>p.index)),samples=session?.samples??[];
  for(const {index} of markers)if(!trajectoryIndices.has(index)&&samples[index])trajectory.push({...samples[index],index});
  trajectory.sort((a,b)=>a.index-b.index);
  return {trajectory,markers,durationSec:samples.length?Math.max(0,samples.at(-1).t-samples[0].t):0};
}

export function nearestReplayPoint(model,rearX,rearZ){const points=model?.trajectory??[];if(!points.length)return null;let best=points[0],bestD2=Infinity;for(const p of points){const dx=p.rearX-rearX,dz=p.rearZ-rearZ,d2=dx*dx+dz*dz;if(d2<bestD2){best=p;bestD2=d2}}return {...best,distance:Math.sqrt(bestD2)}}
export function replayProgress(model,index){const points=model?.trajectory??[];if(!points.length)return 0;const first=points[0].index,last=points.at(-1).index;if(last<=first)return 0;return clamp01((index-first)/(last-first))}

// Returns a smooth vehicle pose for a 0..1 replay scrubber. Time is used rather than
// sample index so playback remains correct if browser sampling cadence was uneven.
export function replayPoseAtProgress(model,progress){
  const points=model?.trajectory??[];if(!points.length)return null;if(points.length===1)return {...points[0],progress:0};
  const p=clamp01(Number.isFinite(progress)?progress:0),start=points[0].t??0,end=points.at(-1).t??start,target=start+(end-start)*p;
  let hi=points.findIndex(x=>(x.t??0)>=target);if(hi<0)hi=points.length-1;if(hi===0)return {...points[0],progress:p};
  const a=points[hi-1],b=points[hi],dt=(b.t??0)-(a.t??0),u=dt>1e-9?clamp01((target-(a.t??0))/dt):0;
  return {rearX:lerp(a.rearX,b.rearX,u),rearZ:lerp(a.rearZ,b.rearZ,u),yaw:lerpAngle(a.yaw,b.yaw,u),speed:lerp(a.speed,b.speed,u),steer:lerp(a.steer,b.steer,u),t:target,gear:u<.5?a.gear:b.gear,index:lerp(a.index,b.index,u),progress:p};
}

export function replayMarkerProgress(model,marker){
  const points=model?.trajectory??[];if(!points.length||!marker)return 0;const start=points[0].t??0,end=points.at(-1).t??start;if(end<=start)return 0;return clamp01(((marker.t??start)-start)/(end-start));
}
