import assert from 'node:assert/strict';
import {enterReplayMode,setReplayPose,exitReplayMode,isReplayModeActive,resolveReplayStep,resetReplayRuntime,getReplayPausedMs} from './replay-runtime.mjs';

resetReplayRuntime();
const live={rearX:4.8,rearZ:3.2,yaw:-Math.PI/2,speed:-.7,steer:.22,gear:'R'};
assert.equal(resolveReplayStep(live).handled,false);
assert.equal(getReplayPausedMs(1000),0);

enterReplayMode(1000);
assert.equal(isReplayModeActive(),true);
assert.equal(getReplayPausedMs(3500),2500,'active replay pause must accumulate before closing');
let frozen=resolveReplayStep(live);
assert.equal(frozen.handled,true);assert.equal(frozen.mode,'replay');assert.equal(frozen.state.rearX,live.rearX);assert.equal(frozen.state.speed,0);

setReplayPose({rearX:1.2,rearZ:-2.4,yaw:.7,steer:-.31,speed:9,gear:'D'});
const replay=resolveReplayStep({...live,rearX:99});
assert.equal(replay.state.rearX,1.2);assert.equal(replay.state.rearZ,-2.4);assert.equal(replay.state.yaw,.7);assert.equal(replay.state.steer,-.31);assert.equal(replay.state.gear,'D');assert.equal(replay.state.speed,0);

exitReplayMode({atMs:6000});
assert.equal(isReplayModeActive(),false);
assert.equal(getReplayPausedMs(9000),5000,'closed replay pause must remain accumulated');
const restored=resolveReplayStep(replay.state);
assert.equal(restored.mode,'restore');assert.deepEqual(restored.state,live);
assert.equal(resolveReplayStep(restored.state).mode,'live');

// A second replay adds to the total without double-counting repeated enter calls.
enterReplayMode(10000);enterReplayMode(12000);assert.equal(getReplayPausedMs(13000),8000);exitReplayMode({atMs:14000});assert.equal(getReplayPausedMs(15000),9000);

// Restarting from the review deliberately discards the captured live state.
enterReplayMode(16000);resolveReplayStep(live);setReplayPose({rearX:0,rearZ:0,yaw:0,steer:0,gear:'R'});exitReplayMode({restore:false,atMs:17000});
const resetState={rearX:4.8,rearZ:3.2,yaw:-Math.PI/2,speed:0,steer:0,gear:'R'};
const afterDiscard=resolveReplayStep(resetState);assert.equal(afterDiscard.handled,false);assert.deepEqual(afterDiscard.state,resetState);
assert.equal(getReplayPausedMs(18000),10000);

resetReplayRuntime();assert.equal(getReplayPausedMs(20000),0);
console.log('replay-runtime-tests: all assertions passed');
