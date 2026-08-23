import assert from 'node:assert/strict';
import {appendHistory,upsertHistory,serializeHistory,parseHistory,trainingTrend} from './history.mjs';

const incomplete={score:72,grade:'合格',completed:false,durationSec:18,distanceM:8.2,maxLateralM:.42,maxHeadingErrorDeg:11,maxSpeedKmh:2.8,lineTouchEvents:1,steeringDirectionChanges:4,gearChanges:1};
const completed={score:88,grade:'良好',completed:true,durationSec:27,distanceM:10.4,maxLateralM:.31,maxHeadingErrorDeg:7,maxSpeedKmh:2.6,lineTouchEvents:1,steeringDirectionChanges:4,gearChanges:1};

let history=upsertHistory([],incomplete,{attemptId:'attempt-a',at:1000});
assert.equal(history.length,1,'first review should create one history entry');
assert.equal(history[0].completed,false);
assert.equal(history[0].at,1000);

history=upsertHistory(history,completed,{attemptId:'attempt-a',at:2000});
assert.equal(history.length,1,'final result of the same attempt must replace the early review, not append');
assert.equal(history[0].completed,true);
assert.equal(history[0].score,88);
assert.equal(history[0].durationSec,27);
assert.equal(history[0].at,1000,'upsert should preserve the original attempt timestamp');
assert.equal(history[0].attemptId,'attempt-a');

history=upsertHistory(history,{...completed,score:91},{attemptId:'attempt-b',at:3000});
assert.equal(history.length,2,'a different attempt must append normally');
assert.equal(trainingTrend(history).completionRate,1,'replacing an early incomplete review must repair completion-rate statistics');

const roundTrip=parseHistory(serializeHistory(history));
assert.deepEqual(roundTrip.map(x=>x.attemptId),['attempt-a','attempt-b'],'attempt ids must survive localStorage serialization');
assert.equal(roundTrip[0].completed,true);

const legacy=appendHistory([{at:1,score:60,completed:false}],completed,{attemptId:null,at:2});
assert.equal(legacy.length,2,'legacy records without attempt ids must retain append semantics');

console.log('history-upsert-tests: all assertions passed');
