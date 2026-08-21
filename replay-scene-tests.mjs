import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample} from './session.mjs';
import {buildReplayModel} from './replay.mjs';
import {replaySceneSnapshot,replaySceneEventDetail} from './replay-scene.mjs';

const session=createTrainingSession({gear:'R'},0);
const add=(t,x,z,{yaw=0,steer=0,speed=-.4,touch=false}={})=>recordTrainingSample(session,{t,state:{rearX:x,rearZ:z,yaw,steer,speed,gear:'R'},deviation:{lateral:0,headingErrorDeg:0},lineTouch:touch,parkingSuccess:false});
add(0,0,0);add(1,1,-1,{yaw:.2,steer:.25,touch:true});add(2,2,-2,{yaw:.4,steer:.1});
const model=buildReplayModel(session,{maxPoints:20,maxMarkers:10});
const snap=replaySceneSnapshot(model,.5,{markerTolerance:.01});
assert.ok(snap);assert.equal(snap.body.length,4);assert.deepEqual(Object.keys(snap.wheels).sort(),['fl','fr','rl','rr']);
assert.ok(Math.abs(snap.pose.rearX-1)<1e-8);assert.ok(Math.abs(snap.pose.rearZ+1)<1e-8);assert.equal(snap.marker?.type,'line-touch');
for(const p of [...snap.body,...Object.values(snap.wheels)])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
const detail=replaySceneEventDetail(model,.5,{markerTolerance:.01});assert.equal(detail.marker?.label,'首次触线');assert.equal(detail.pose.gear,'R');
assert.equal(replaySceneSnapshot({trajectory:[]},.5),null);assert.equal(replaySceneEventDetail({trajectory:[]},.5),null);
console.log('replay-scene-tests: all assertions passed');
