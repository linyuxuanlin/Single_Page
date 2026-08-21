import {buildReplayTrajectory,extractTrainingEvents} from './session.mjs';

const EVENT_PRIORITY=Object.freeze({'line-touch':100,'max-lateral':90,'max-heading':80,'max-speed':70,'completion':60,'gear-change':50,'steering-change':40});
const LABELS=Object.freeze({'line-touch':'首次触线','max-lateral':'最大横向偏差','max-heading':'最大航向偏差','max-speed':'最高速度','completion':'完成入库','gear-change':'换挡','steering-change':'反向修方向'});
const clamp01=v=>Math.max(0,Math.min(1,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const lerpAngle=(a,b,t)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<=-Math.PI)d+=Math.PI*2;return a+d*t};
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;

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
  const start=samples.length?finite(samples[0].t,0):0,end=samples.length?finite(samples.at(-1).t,start):start;
  return {trajectory,markers,durationSec:Math.max(0,end-start)};
}

export function nearestReplayPoint(model,rearX,rearZ){const points=model?.trajectory??[];if(!points.length)return null;let best=points[0],bestD2=Infinity;for(const p of points){const dx=p.rearX-rearX,dz=p.rearZ-rearZ,d2=dx*dx+dz*dz;if(d2<bestD2){best=p;bestD2=d2}}return {...best,distance:Math.sqrt(bestD2)}}
export function replayProgress(model,index){const points=model?.trajectory??[];if(!points.length)return 0;const first=points[0].index,last=points.at(-1).index;if(last<=first)return 0;return clamp01((index-first)/(last-first))}

export function replayPoseAtProgress(model,progress){
  const points=model?.trajectory??[];if(!points.length)return null;if(points.length===1)return {...points[0],progress:0};
  const p=clamp01(Number.isFinite(progress)?progress:0),start=finite(points[0].t,0),end=finite(points.at(-1).t,start),target=start+(end-start)*p;
  let lo=0,hi=points.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(finite(points[mid].t,start)<target)lo=mid+1;else hi=mid}
  hi=lo;if(hi===0)return {...points[0],progress:p};
  const a=points[hi-1],b=points[hi],ta=finite(a.t,start),tb=finite(b.t,ta),dt=tb-ta,u=dt>1e-9?clamp01((target-ta)/dt):0;
  return {rearX:lerp(a.rearX,b.rearX,u),rearZ:lerp(a.rearZ,b.rearZ,u),yaw:lerpAngle(a.yaw,b.yaw,u),speed:lerp(a.speed,b.speed,u),steer:lerp(a.steer,b.steer,u),t:target,gear:u<.5?a.gear:b.gear,index:lerp(a.index,b.index,u),progress:p};
}

export function replayMarkerProgress(model,marker){
  const points=model?.trajectory??[];if(!points.length||!marker)return 0;const start=finite(points[0].t,0),end=finite(points.at(-1).t,start);if(end<=start)return 0;return clamp01((finite(marker.t,start)-start)/(end-start));
}

export function buildReplayTimeline(model){
  const durationSec=Math.max(0,finite(model?.durationSec,0));
  const markers=(model?.markers??[]).map((marker,index)=>({...marker,markerIndex:index,progress:replayMarkerProgress(model,marker)}));
  return {durationSec,markers};
}

export function replayMarkerAtProgress(model,progress,{tolerance=.025}={}){
  const timeline=buildReplayTimeline(model),p=clamp01(finite(progress,0)),tol=Math.max(0,finite(tolerance,.025));let best=null,bestDistance=Infinity;
  for(const marker of timeline.markers){const distance=Math.abs(marker.progress-p);if(distance<bestDistance){best=marker;bestDistance=distance}}
  return best&&bestDistance<=tol?{...best,distanceFromProgress:bestDistance}:null;
}
export function adjacentReplayMarker(model,progress,direction=1){
  const markers=buildReplayTimeline(model).markers;if(!markers.length)return null;const p=clamp01(finite(progress,0)),dir=direction<0?-1:1,epsilon=1e-6;
  if(dir>0)return markers.find(m=>m.progress>p+epsilon)??markers.at(-1);
  for(let i=markers.length-1;i>=0;i--)if(markers[i].progress<p-epsilon)return markers[i];return markers[0];
}

// Pure playback state machine for UI integration. It deliberately accepts elapsed
// seconds rather than reading performance.now(), making playback deterministic,
// testable and safe when a browser tab resumes after being backgrounded.
export function createReplayPlayback({progress=0,rate=1,playing=false}={}){
  return {progress:clamp01(finite(progress,0)),rate:Math.max(.1,Math.min(4,finite(rate,1))),playing:Boolean(playing)};
}
export function seekReplay(playback,progress){return {...createReplayPlayback(playback),progress:clamp01(finite(progress,0))}}
export function setReplayRate(playback,rate){return {...createReplayPlayback(playback),rate:Math.max(.1,Math.min(4,finite(rate,1)))}}
export function setReplayPlaying(playback,playing){const next=createReplayPlayback(playback);return {...next,playing:Boolean(playing)&&next.progress<1}}
export function advanceReplay(playback,model,elapsedSec){
  const next=createReplayPlayback(playback),duration=Math.max(0,finite(model?.durationSec,0)),dt=Math.max(0,Math.min(.25,finite(elapsedSec,0)));
  if(!next.playing||duration<=1e-9||dt===0)return next;
  next.progress=clamp01(next.progress+dt*next.rate/duration);
  if(next.progress>=1)next.playing=false;
  return next;
}
