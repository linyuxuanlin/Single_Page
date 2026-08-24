import assert from 'node:assert/strict';
import {historyEntry,appendHistory,trainingTrend,progressAdvice,serializeHistory,parseHistory} from './history.mjs';
const s=(score,completed=true,extra={})=>({score,grade:'测试',completed,durationSec:20,distanceM:8,maxLateralM:.2,maxHeadingErrorDeg:5,maxSpeedKmh:4,lineTouchEvents:0,steeringDirectionChanges:2,gearChanges:0,...extra});
let e=historyEntry(s(91),{at:123});assert.equal(e.score,91);assert.equal(e.at,123);assert.equal(e.completed,true);
let h=[];for(let i=0;i<35;i++)h=appendHistory(h,s(60+i),{at:i,limit:30});assert.equal(h.length,30);assert.equal(h[0].at,5);assert.equal(h.at(-1).score,94);
h=[s(60),s(62),s(64),s(80),s(82),s(84)].map((x,i)=>historyEntry(x,{at:i}));let t=trainingTrend(h,{window:3});assert.equal(t.attempts,6);assert.equal(t.bestScore,84);assert.equal(t.recentScore,82);assert.equal(t.scoreDelta,20);assert.equal(t.comparisonAttempts,3);assert.equal(t.completionRate,1);
// With only one or two attempts, do not claim the learner is already "stable".
h=[historyEntry(s(88),{at:0})];assert.match(progressAdvice(h)[0],/再完成 2 次练习/);assert.doesNotMatch(progressAdvice(h).join(' '),/稳定/);
h=[historyEntry(s(88),{at:0}),historyEntry(s(90),{at:1})];assert.match(progressAdvice(h)[0],/再完成 1 次练习/);assert.doesNotMatch(progressAdvice(h).join(' '),/稳定/);
// Do not claim a trend until both comparison windows are complete. Six attempts
// with a five-attempt window must not compare the latest five against just one old run.
h=[s(20),s(80),s(82),s(84),s(86),s(88)].map((x,i)=>historyEntry(x,{at:i}));t=trainingTrend(h,{window:5});assert.equal(t.recentAttempts,5);assert.equal(t.comparisonAttempts,0);assert.equal(t.scoreDelta,0);assert.doesNotMatch(progressAdvice(h).join(' '),/平均分提升|平均分下降/);
// Once ten attempts exist, compare five against five and allow a trend statement.
h=[10,20,30,40,50,70,80,90,90,90].map((score,i)=>historyEntry(s(score),{at:i}));t=trainingTrend(h,{window:5});assert.equal(t.comparisonAttempts,5);assert.equal(t.recentScore,84);assert.equal(t.scoreDelta,54);assert.match(progressAdvice(h).join(' '),/平均分提升/);
h=[s(80,false,{lineTouchEvents:1,maxLateralM:.6,maxHeadingErrorDeg:15}),s(82,false,{lineTouchEvents:1,maxLateralM:.5,maxHeadingErrorDeg:14}),s(84,true,{lineTouchEvents:0,maxLateralM:.5,maxHeadingErrorDeg:13})].map((x,i)=>historyEntry(x,{at:i}));const advice=progressAdvice(h).join(' ');assert.match(advice,/完成率/);assert.match(advice,/触线/);assert.match(advice,/横向偏差/);assert.match(advice,/角度误差/);
const raw=serializeHistory(h),round=parseHistory(raw);assert.equal(round.length,3);assert.equal(round[1].score,82);assert.deepEqual(parseHistory('broken'),[]);
// trainingTrend is a public API and must be safe even if a caller bypasses parseHistory.
const corrupt=[{score:Infinity,completed:false,lineTouchEvents:-9,maxLateralM:-2,maxHeadingErrorDeg:NaN},{score:999,completed:true,lineTouchEvents:Infinity,maxLateralM:Infinity,maxHeadingErrorDeg:-8}];
t=trainingTrend(corrupt,{window:2});assert.equal(t.bestScore,100);assert.equal(t.recentScore,50);assert.equal(t.completionRate,.5);assert.equal(t.recentLineTouches,0);assert.equal(t.recentLateralM,0);assert.equal(t.recentHeadingDeg,0);for(const value of Object.values(t))assert.ok(Number.isFinite(value),`trend field must be finite: ${value}`);
const serializedCorrupt=JSON.parse(serializeHistory(corrupt));assert.equal(serializedCorrupt[0].score,0);assert.equal(serializedCorrupt[1].score,100);assert.equal(serializedCorrupt[0].lineTouchEvents,0);
console.log('history-tests: all assertions passed');
