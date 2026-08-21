import assert from 'node:assert/strict';
import {enterReplayMode,setReplayPose,exitReplayMode,isReplayModeActive,resolveReplayStep,resetReplayRuntime} from './replay-runtime.mjs';

resetReplayRuntime();
const live={rearX:4.8,rearZ:3.2,yaw:-Math.PI/2,speed:-.7,steer:.22,gear:'R'};
assert.equal(resolveReplayStep(live).handled,false);

enterReplayMode();
assert.equal(isReplayModeActive(),true);
let frozen=resolveReplayStep(live);
assert.equal(frozen.handled,true);assert.equal(frozen.mode,'replay');assert.equal(frozen.state.rearX,live.rearX);assert.equal(frozen.state.speed,0);

setReplayPose({rearX:1.2,rearZ:-2.4,yaw:.7,steer:-.31,speed:9,gear:'D'});
const replay=resolveReplayStep({...live,rearX:99});
assert.equal(replay.state.rearX,1.2);assert.equal(replay.state.rearZ,-2.4);assert.equal(replay.state.yaw,.7);assert.equal(replay.state.steer,-.31);assert.equal(replay.state.gear,'D');assert.equal(replay.state.speed,0);

exitReplayMode();
assert.equal(isReplayModeActive(),false);
const restored=resolveReplayStep(replay.state);
assert.equal(restored.mode,'restore');assert.deepEqual(restored.state,live);
assert.equal(resolveReplayStep(restored.state).mode,'live');

// Restarting from the review deliberately discards the captured live state.
enterReplayMode();resolveReplayStep(live);setReplayPose({rearX:0,rearZ:0,yaw:0,steer:0,gear:'R'});exitReplayMode({restore:false});
const resetState={rearX:4.8,rearZ:3.2,yaw:-Math.PI/2,speed:0,steer:0,gear:'R'};
const afterDiscard=resolveReplayStep(resetState);assert.equal(afterDiscard.handled,false);assert.deepEqual(afterDiscard.state,resetState);

resetReplayRuntime();
console.log('replay-runtime-tests: all assertions passed');
