let active=false;
let replayPose=null;
let frozenLiveState=null;

const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const cloneState=s=>s&&typeof s==='object'?{...s}:{};

export function enterReplayMode(){
  active=true;
  replayPose=null;
}

export function setReplayPose(pose){
  if(!active)active=true;
  if(!pose){replayPose=null;return;}
  replayPose={
    rearX:finite(pose.rearX),
    rearZ:finite(pose.rearZ),
    yaw:finite(pose.yaw),
    steer:finite(pose.steer),
    gear:pose.gear==='D'?'D':'R',
  };
}

export function exitReplayMode({restore=true}={}){
  active=false;
  replayPose=null;
  if(!restore)frozenLiveState=null;
}

export function isReplayModeActive(){return active;}

/**
 * Called at the start of the live physics step.
 * While replay is active, capture the live state once and return a frozen/replay pose.
 * After replay exits, restore the exact captured live state on the next physics tick.
 */
export function resolveReplayStep(state){
  if(active){
    if(!frozenLiveState)frozenLiveState=cloneState(state);
    const base=cloneState(state);
    if(replayPose)Object.assign(base,replayPose);
    // The renderer rotates wheels from state.speed every frame. Zeroing visual speed
    // prevents wheels spinning while a paused replay pose is being inspected.
    base.speed=0;
    return{handled:true,state:base,mode:'replay'};
  }
  if(frozenLiveState){
    const restored=cloneState(frozenLiveState);
    frozenLiveState=null;
    return{handled:true,state:restored,mode:'restore'};
  }
  return{handled:false,state,mode:'live'};
}

export function resetReplayRuntime(){
  active=false;
  replayPose=null;
  frozenLiveState=null;
}
