const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export function historyEntry(summary,{at=Date.now()}={}){
  return {at:finite(at,Date.now()),score:clamp(Math.round(finite(summary?.score,0)),0,100),grade:summary?.grade??'',completed:Boolean(summary?.completed),durationSec:Math.max(0,finite(summary?.durationSec,0)),distanceM:Math.max(0,finite(summary?.distanceM,0)),maxLateralM:Math.max(0,finite(summary?.maxLateralM,0)),maxHeadingErrorDeg:Math.max(0,finite(summary?.maxHeadingErrorDeg,0)),maxSpeedKmh:Math.max(0,finite(summary?.maxSpeedKmh,0)),lineTouchEvents:Math.max(0,Math.floor(finite(summary?.lineTouchEvents,0))),steeringDirectionChanges:Math.max(0,Math.floor(finite(summary?.steeringDirectionChanges,0))),gearChanges:Math.max(0,Math.floor(finite(summary?.gearChanges,0)))};
}

export function appendHistory(history,summary,{at=Date.now(),limit=30}={}){
  const clean=Array.isArray(history)?history.filter(Boolean).map(x=>historyEntry(x,{at:x.at})):[];
  clean.push(historyEntry(summary,{at}));
  return clean.slice(-Math.max(1,Math.floor(finite(limit,30))));
}

const avg=(items,key)=>items.length?items.reduce((s,x)=>s+finite(x[key],0),0)/items.length:0;
export function trainingTrend(history,{window=5}={}){
  const h=Array.isArray(history)?history.filter(Boolean):[],n=Math.max(1,Math.floor(finite(window,5))),recent=h.slice(-n),previous=h.slice(-2*n,-n);
  const best=h.length?Math.max(...h.map(x=>finite(x.score,0))):0;
  const completionRate=recent.length?recent.filter(x=>x.completed).length/recent.length:0;
  const recentScore=avg(recent,'score'),previousScore=avg(previous,'score');
  return {attempts:h.length,bestScore:best,recentAttempts:recent.length,recentScore,scoreDelta:previous.length?recentScore-previousScore:0,completionRate,recentLineTouches:avg(recent,'lineTouchEvents'),recentLateralM:avg(recent,'maxLateralM'),recentHeadingDeg:avg(recent,'maxHeadingErrorDeg')};
}

export function progressAdvice(history){
  const t=trainingTrend(history);if(!t.attempts)return['完成一次练习后，这里会开始跟踪长期进步。'];
  const out=[];
  if(t.recentAttempts>=3&&t.completionRate<.6)out.push('最近完成率偏低：先以稳定完整入库为目标，再追求高分。');
  if(t.recentLineTouches>=.5)out.push('最近仍较常触线：优先观察内侧后轮和预测扫掠区。');
  if(t.recentLateralM>.45)out.push('最近横向偏差偏大：重点复盘切入点与第一次回正时机。');
  if(t.recentHeadingDeg>12)out.push('最近车身角度误差偏大：接近平行时减少碎方向并更早回正。');
  if(t.recentAttempts>=5&&t.scoreDelta>=5)out.push(`最近平均分提升 ${t.scoreDelta.toFixed(0)} 分，当前练习策略有效。`);
  if(t.recentAttempts>=5&&t.scoreDelta<=-5)out.push(`最近平均分下降 ${Math.abs(t.scoreDelta).toFixed(0)} 分，建议降低速度并复盘关键事件。`);
  if(!out.length)out.push('最近表现较稳定，可尝试关闭参考轨迹后重复完成。');
  return out;
}

export function serializeHistory(history,{limit=30}={}){return JSON.stringify((Array.isArray(history)?history:[]).slice(-Math.max(1,Math.floor(finite(limit,30)))))}
export function parseHistory(raw){try{const v=JSON.parse(raw);return Array.isArray(v)?v.filter(Boolean).map(x=>historyEntry(x,{at:x.at})):[]}catch{return[]}}
