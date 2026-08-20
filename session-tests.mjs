import assert from 'node:assert/strict';
import {createTrainingSession, recordTrainingSample, summarizeTrainingSession} from './session.mjs';

let s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,{t:0,state:{rearX:0,rearZ:0,speed:-.4,steer:.2,gear:'R'},deviation:{lateral:.1,headingErrorDeg:2}});
recordTrainingSample(s,{t:1,state:{rearX:0,rearZ:-.4,speed:-.4,steer:.2,gear:'R'},deviation:{lateral:.12,headingErrorDeg:3},parkingSuccess:true});
let r=summarizeTrainingSession(s);
assert.equal(r.completed,true); assert.equal(r.lineTouchEvents,0); assert.ok(r.score>=90); assert.ok(r.distanceM>.39&&r.distanceM<.41);

s=createTrainingSession({gear:'R'},0);
const base=(t,x,touch=false,steer=.2)=>({t,state:{rearX:x,rearZ:0,speed:-1.8,steer,gear:'R'},deviation:{lateral:.8,headingErrorDeg:18},lineTouch:touch});
recordTrainingSample(s,base(0,0,false,.2));
recordTrainingSample(s,base(1,.3,true,.2));
recordTrainingSample(s,base(2,.6,true,-.2));
recordTrainingSample(s,base(3,.9,false,-.2));
recordTrainingSample(s,base(4,1.2,true,.2));
r=summarizeTrainingSession(s);
assert.equal(r.lineTouchEvents,2,'continuous contact must count as one event');
assert.equal(r.steeringDirectionChanges,2);
assert.equal(r.completed,false); assert.ok(r.score<60); assert.ok(r.advice.length>=3);

s=createTrainingSession({gear:'R'},0);
recordTrainingSample(s,{t:0,state:{gear:'R'}});
recordTrainingSample(s,{t:1,state:{gear:'D'}});
recordTrainingSample(s,{t:2,state:{gear:'R'}});
r=summarizeTrainingSession(s); assert.equal(r.gearChanges,2);

r=summarizeTrainingSession(createTrainingSession()); assert.equal(r.score,0); assert.equal(r.grade,'未开始');
console.log('session-tests: all assertions passed');
