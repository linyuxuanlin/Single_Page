import { bodyPolygon, wheelPoints } from './physics.mjs';
import { replayPoseAtProgress, replayMarkerAtProgress } from './replay.mjs';

const finite=(v,f=0)=>Number.isFinite(v)?v:f;

/**
 * Convert a replay position into the same geometry the live Three.js scene uses.
 * This deliberately stays renderer-agnostic so replay UI can drive the main scene
 * without duplicating vehicle geometry or collision assumptions.
 */
export function replaySceneSnapshot(model,progress,{markerTolerance=.018}={}){
  const pose=replayPoseAtProgress(model,progress);
  if(!pose)return null;
  const state={
    rearX:finite(pose.rearX),rearZ:finite(pose.rearZ),yaw:finite(pose.yaw),
    speed:finite(pose.speed),steer:finite(pose.steer),gear:pose.gear==='D'?'D':'R'
  };
  return {
    progress:Math.max(0,Math.min(1,finite(progress))),
    pose:state,
    body:bodyPolygon(state),
    wheels:wheelPoints(state),
    marker:replayMarkerAtProgress(model,progress,{tolerance:markerTolerance}),
    sourceIndex:finite(pose.index),
    t:finite(pose.t)
  };
}

/** Create a small, stable event payload for a browser CustomEvent. */
export function replaySceneEventDetail(model,progress,options){
  const snapshot=replaySceneSnapshot(model,progress,options);
  if(!snapshot)return null;
  return {
    progress:snapshot.progress,
    pose:{...snapshot.pose},
    marker:snapshot.marker?{type:snapshot.marker.type,label:snapshot.marker.label,index:snapshot.marker.index,progress:snapshot.marker.progress}:null,
    t:snapshot.t
  };
}
