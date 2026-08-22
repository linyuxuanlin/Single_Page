import { bodyPolygon, wheelPoints, lineCollisionDetails } from './physics.mjs';
import { replayPoseAtProgress, replayMarkerAtProgress } from './replay.mjs';
import { replayHighlightState, replayHighlightStyle } from './replay-highlight.mjs';

const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const copyPoint=p=>({x:finite(p?.x),z:finite(p?.z)});

/** Convert a replay position into the same geometry the live Three.js scene uses. */
export function replaySceneSnapshot(model,progress,{markerTolerance=.018}={}){
  const pose=replayPoseAtProgress(model,progress);
  if(!pose)return null;
  const state={rearX:finite(pose.rearX),rearZ:finite(pose.rearZ),yaw:finite(pose.yaw),speed:finite(pose.speed),steer:finite(pose.steer),gear:pose.gear==='D'?'D':'R'};
  const marker=replayMarkerAtProgress(model,progress,{tolerance:markerTolerance});
  const collision=lineCollisionDetails(state);
  return {progress:Math.max(0,Math.min(1,finite(progress))),pose:state,body:bodyPolygon(state),wheels:wheelPoints(state),marker,collision,sourceIndex:finite(pose.index),t:finite(pose.t)};
}

/** Create a compact browser event payload, including exact geometry needed by replay visualizations. */
export function replaySceneEventDetail(model,progress,options){
  const snapshot=replaySceneSnapshot(model,progress,options);
  if(!snapshot)return null;
  const collisionHits=snapshot.collision.hits.map(h=>({name:h.name,polygon:h.polygon.map(copyPoint)}));
  const base={
    progress:snapshot.progress,
    pose:{...snapshot.pose},
    body:snapshot.body.map(copyPoint),
    marker:snapshot.marker?{type:snapshot.marker.type,label:snapshot.marker.label,index:snapshot.marker.index,progress:snapshot.marker.progress}:null,
    collision:{touching:snapshot.collision.touching,lines:collisionHits.map(h=>h.name),hits:collisionHits},
    t:snapshot.t,
  };
  const highlight=replayHighlightState(base);
  return {...base,highlight:{...highlight,style:replayHighlightStyle(highlight)}};
}

/** Lightweight browser feedback until the main Three.js materials consume detail.highlight directly. */
export function installReplayCollisionBadge(){
  if(typeof window==='undefined'||typeof document==='undefined'||window.__drivingReplayCollisionBadgeInstalled)return;
  window.__drivingReplayCollisionBadgeInstalled=true;
  const id='replay-collision-badge';
  const ensure=()=>{
    let el=document.getElementById(id);
    if(el)return el;
    el=document.createElement('div');el.id=id;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    Object.assign(el.style,{position:'fixed',zIndex:'45',left:'50%',top:'max(12px, env(safe-area-inset-top))',transform:'translateX(-50%)',display:'none',padding:'8px 12px',borderRadius:'999px',background:'rgba(118,18,24,.92)',border:'1px solid rgba(255,118,118,.55)',boxShadow:'0 8px 28px rgba(0,0,0,.35)',color:'#fff',font:'700 12px/1.2 system-ui,-apple-system,"PingFang SC",sans-serif',pointerEvents:'none',whiteSpace:'nowrap'});
    document.body.appendChild(el);return el;
  };
  window.addEventListener('driving-lab:replay-pose',e=>{
    const h=e.detail?.highlight,el=ensure();
    if(!h?.active){el.style.display='none';el.textContent='';return;}
    el.textContent=h.label||'触线';el.style.display='block';
    const pulse=Number.isFinite(h.pulse)?Math.max(0,Math.min(1,h.pulse)):0;
    el.style.opacity=String(.78+.22*pulse);el.style.transform=`translateX(-50%) scale(${(1+.025*pulse).toFixed(3)})`;
  });
  window.addEventListener('driving-lab:replay-exit',()=>{const el=document.getElementById(id);if(el){el.style.display='none';el.textContent=''}});
}

installReplayCollisionBadge();