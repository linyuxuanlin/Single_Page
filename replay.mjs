import {buildReplayTrajectory,extractTrainingEvents} from './session.mjs';

const EVENT_PRIORITY=Object.freeze({
  'line-touch':100,
  'max-lateral':90,
  'max-heading':80,
  'max-speed':70,
  'completion':60,
  'gear-change':50,
  'steering-change':40,
});

const LABELS=Object.freeze({
  'line-touch':'首次触线',
  'max-lateral':'最大横向偏差',
  'max-heading':'最大航向偏差',
  'max-speed':'最高速度',
  'completion':'完成入库',
  'gear-change':'换挡',
  'steering-change':'反向修方向',
});

export function buildReplayMarkers(session,{maxMarkers=10}={}){
  const events=extractTrainingEvents(session);
  const all=[events.firstLineTouch,events.maxLateral,events.maxHeading,events.maxSpeed,events.completion,...events.gearChanges,...events.steeringChanges].filter(Boolean);
  const bySample=new Map();
  for(const event of all){
    const existing=bySample.get(event.index);
    if(!existing||(EVENT_PRIORITY[event.type]??0)>(EVENT_PRIORITY[existing.type]??0))bySample.set(event.index,event);
  }
  return [...bySample.values()]
    .sort((a,b)=>(EVENT_PRIORITY[b.type]??0)-(EVENT_PRIORITY[a.type]??0)||a.index-b.index)
    .slice(0,Math.max(0,Math.floor(maxMarkers)))
    .sort((a,b)=>a.index-b.index)
    .map(event=>({...event,label:LABELS[event.type]??event.type}));
}

export function buildReplayModel(session,{maxPoints=180,maxMarkers=10}={}){
  const trajectory=buildReplayTrajectory(session,{maxPoints});
  const markers=buildReplayMarkers(session,{maxMarkers});
  const markerIndices=new Set(markers.map(m=>m.index));
  const trajectoryIndices=new Set(trajectory.map(p=>p.index));
  // Critical marker poses must always be drawable even when maxPoints is very small.
  const samples=session?.samples??[];
  for(const index of markerIndices){
    if(!trajectoryIndices.has(index)&&samples[index])trajectory.push({...samples[index],index});
  }
  trajectory.sort((a,b)=>a.index-b.index);
  return {trajectory,markers};
}

export function nearestReplayPoint(model,rearX,rearZ){
  const points=model?.trajectory??[];
  if(!points.length)return null;
  let best=points[0],bestD2=Infinity;
  for(const p of points){const dx=p.rearX-rearX,dz=p.rearZ-rearZ,d2=dx*dx+dz*dz;if(d2<bestD2){best=p;bestD2=d2}}
  return {...best,distance:Math.sqrt(bestD2)};
}

export function replayProgress(model,index){
  const points=model?.trajectory??[];
  if(!points.length)return 0;
  const last=Math.max(1,points.at(-1).index);
  return Math.max(0,Math.min(1,index/last));
}
