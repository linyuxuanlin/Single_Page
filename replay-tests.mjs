import assert from 'node:assert/strict';
import {createTrainingSession,recordTrainingSample} from './session.mjs';
import {buildReplayMarkers,buildReplayModel,nearestReplayPoint,replayProgress} from './replay.mjs';

const s=createTrainingSession({gear:'R'},0);
const sample=(t,x,{touch=false,steer=.2,gear='R',lat=0,heading=0,speed=-.4,success=false}={})=>({t,state:{rearX:x,rearZ:-x*.5,yaw:0,speed,steer,gear},deviation:{lateral:lat,headingErrorDeg:heading},lineTouch:touch,parkingSuccess:success});
for(let i=0;i<14;i++)recordTrainingSample(s,sample(i,i*.2,{touch:i===7,steer:i<5?.25:i<10?-.25:.25,gear:i>=11?'D':'R',lat:i===6?-.9:i*.02,heading:i===8?19:i,speed:i===9?-2:-.4,success:i===13}));
const markers=buildReplayMarkers(s,{maxMarkers:10});
assert.ok(markers.some(m=>m.type==='line-touch'&&m.index===7));
assert.ok(markers.some(m=>m.type==='max-lateral'&&m.index===6));
assert.ok(markers.some(m=>m.type==='max-heading'&&m.index===8));
assert.ok(markers.some(m=>m.type==='max-speed'&&m.index===9));
assert.ok(markers.some(m=>m.type==='completion'&&m.index===13));
assert.ok(markers.every(m=>typeof m.label==='string'&&m.label.length));

const tiny=buildReplayModel(s,{maxPoints:3,maxMarkers:8});
for(const marker of tiny.markers)assert.ok(tiny.trajectory.some(p=>p.index===marker.index),`marker ${marker.type} pose must survive`);
assert.deepEqual(tiny.trajectory.map(p=>p.index),[...tiny.trajectory.map(p=>p.index)].sort((a,b)=>a-b));
const nearest=nearestReplayPoint(tiny,1.2,-.6);assert.ok(nearest);assert.ok(nearest.distance<.01);assert.equal(nearest.index,6);
assert.equal(replayProgress(tiny,0),0);assert.equal(replayProgress(tiny,13),1);assert.equal(replayProgress({trajectory:[]},4),0);
assert.deepEqual(buildReplayMarkers(createTrainingSession(),{}),[]);
console.log('replay-tests: all assertions passed');
