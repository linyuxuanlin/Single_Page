const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const DEFAULT_HISTORY_STORAGE_KEY='driving-lab:reverse-parking:history-v1';

const browserAttemptIds=new WeakMap();
let attemptSequence=0;
function currentBrowserAttemptId(){
  if(typeof window==='undefined')return null;
  const session=window.__drivingLabSession;
  if(!session||typeof session!=='object')return null;
  let id=browserAttemptIds.get(session);
  if(!id){
    const random=globalThis.crypto?.randomUUID?.();
    id=random||`attempt-${Date.now().toString(36)}-${(++attemptSequence).toString(36)}`;
    browserAttemptIds.set(session,id);
  }
  return id;
}

export function historyEntry(summary,{at=Date.now(),attemptId=null}={}){
  return {at:finite(at,Date.now()),attemptId:typeof attemptId==='string'&&attemptId?attemptId:null,score:clamp(Math.round(finite(summary?.score,0)),0,100),grade:summary?.grade??'',completed:Boolean(summary?.completed),durationSec:Math.max(0,finite(summary?.durationSec,0)),distanceM:Math.max(0,finite(summary?.distanceM,0)),maxLateralM:Math.max(0,finite(summary?.maxLateralM,0)),maxHeadingErrorDeg:Math.max(0,finite(summary?.maxHeadingErrorDeg,0)),maxSpeedKmh:Math.max(0,finite(summary?.maxSpeedKmh,0)),lineTouchEvents:Math.max(0,Math.floor(finite(summary?.lineTouchEvents,0))),steeringDirectionChanges:Math.max(0,Math.floor(finite(summary?.steeringDirectionChanges,0))),gearChanges:Math.max(0,Math.floor(finite(summary?.gearChanges,0)))};
}

const cleanHistory=history=>Array.isArray(history)?history.filter(Boolean).map(x=>historyEntry(x,{at:x.at,attemptId:x.attemptId})):[];

/** Upsert one logical attempt. This lets an early/manual review be replaced by the final completed result instead of polluting long-term trends with two records. */
export function upsertHistory(history,summary,{at=Date.now(),attemptId=null,limit=30}={}){
  const clean=cleanHistory(history),safeLimit=Math.max(1,Math.floor(finite(limit,30))),id=typeof attemptId==='string'&&attemptId?attemptId:null;
  if(id){
    const index=clean.findIndex(entry=>entry.attemptId===id);
    if(index>=0){
      const originalAt=clean[index].at;
      clean[index]=historyEntry(summary,{at:originalAt,attemptId:id});
      return clean.slice(-safeLimit);
    }
  }
  clean.push(historyEntry(summary,{at,attemptId:id}));
  return clean.slice(-safeLimit);
}

export function appendHistory(history,summary,{at=Date.now(),limit=30,attemptId=currentBrowserAttemptId()}={}){
  return upsertHistory(history,summary,{at,limit,attemptId});
}

const avg=(items,key)=>items.length?items.reduce((s,x)=>s+x[key],0)/items.length:0;
export function trainingTrend(history,{window=5}={}){
  // Public callers may pass raw/localStorage-derived data. Normalize here as well as
  // in parseHistory so one corrupt record cannot create impossible trend/advice values.
  const h=cleanHistory(history),n=Math.max(1,Math.floor(finite(window,5))),recent=h.slice(-n),previous=h.slice(-2*n,-n);
  const best=h.length?Math.max(...h.map(x=>x.score)):0;
  const completionRate=recent.length?recent.filter(x=>x.completed).length/recent.length:0;
  const recentScore=avg(recent,'score'),previousScore=avg(previous,'score');
  // A trend arrow should compare like-for-like windows. With six attempts and a
  // five-attempt window, comparing the latest five against one old attempt is far
  // too noisy and can falsely tell a learner that their strategy is improving or
  // deteriorating. Wait until both windows are complete before publishing delta.
  const hasComparableWindows=recent.length===n&&previous.length===n;
  return {attempts:h.length,bestScore:best,recentAttempts:recent.length,comparisonAttempts:hasComparableWindows?n:0,recentScore,scoreDelta:hasComparableWindows?recentScore-previousScore:0,completionRate,recentLineTouches:avg(recent,'lineTouchEvents'),recentLateralM:avg(recent,'maxLateralM'),recentHeadingDeg:avg(recent,'maxHeadingErrorDeg')};
}

export function progressAdvice(history){
  const t=trainingTrend(history);if(!t.attempts)return['完成一次练习后，这里会开始跟踪长期进步。'];
  const out=[];
  if(t.recentAttempts>=3&&t.completionRate<.6)out.push('最近完成率偏低：先以稳定完整入库为目标，再追求高分。');
  if(t.recentLineTouches>=.5)out.push('最近仍较常触线：优先观察内侧后轮和预测扫掠区。');
  if(t.recentLateralM>.45)out.push('最近横向偏差偏大：重点复盘切入点与第一次回正时机。');
  if(t.recentHeadingDeg>12)out.push('最近车身角度误差偏大：接近平行时减少碎方向并更早回正。');
  if(t.comparisonAttempts>=5&&t.scoreDelta>=5)out.push(`最近平均分提升 ${t.scoreDelta.toFixed(0)} 分，当前练习策略有效。`);
  if(t.comparisonAttempts>=5&&t.scoreDelta<=-5)out.push(`最近平均分下降 ${Math.abs(t.scoreDelta).toFixed(0)} 分，建议降低速度并复盘关键事件。`);
  if(!out.length)out.push('最近表现较稳定，可尝试关闭参考轨迹后重复完成。');
  return out;
}

export function serializeHistory(history,{limit=30}={}){return JSON.stringify(cleanHistory(history).slice(-Math.max(1,Math.floor(finite(limit,30)))))}
export function parseHistory(raw){try{const v=JSON.parse(raw);return cleanHistory(v)}catch{return[]}}

function refreshVisibleTrendCard(history){
  if(typeof document==='undefined')return;
  const backdrop=document.querySelector('#review-backdrop'),el=document.querySelector('#review-trend');
  if(!el||!backdrop?.classList.contains('show'))return;
  const trend=trainingTrend(history),advice=progressAdvice(history)[0];
  if(!trend.attempts){el.innerHTML='<div class="trend-advice">完成一次有效练习后，这里会开始跟踪长期进步。</div>';return}
  const delta=trend.scoreDelta>=1?`<span class="trend-delta up">↑${trend.scoreDelta.toFixed(0)}</span>`:trend.scoreDelta<=-1?`<span class="trend-delta down">↓${Math.abs(trend.scoreDelta).toFixed(0)}</span>`:'<span>→</span>';
  el.innerHTML=`<div class="trend-top"><div class="trend-stat"><small>最近 ${trend.recentAttempts} 次均分</small><b>${trend.recentScore.toFixed(0)} ${delta}</b></div><div class="trend-stat"><small>完成率</small><b>${Math.round(trend.completionRate*100)}%</b></div><div class="trend-stat"><small>历史最佳</small><b>${trend.bestScore} 分</b></div></div><div class="trend-advice"><b>近期训练重点：</b>${advice}</div>`;
}

// The page intentionally allows opening a review before an attempt is finished. The
// legacy page-level `historySaved` flag then prevents the later completed result from
// being written. Reconcile the completed session here using the same attempt id; the
// normal page save becomes an idempotent upsert, so there is never a duplicate entry.
function installCompletedAttemptSync(){
  if(typeof window==='undefined'||typeof localStorage==='undefined'||window.__drivingHistorySyncInstalled)return;
  window.__drivingHistorySyncInstalled=true;
  const synced=new WeakSet();
  const sync=async()=>{
    const session=window.__drivingLabSession;
    if(!session?.completed||!session?.samples?.length||synced.has(session))return;
    synced.add(session);
    try{
      const {summarizeTrainingSession}=await import('./session.mjs');
      const summary=summarizeTrainingSession(session),attemptId=currentBrowserAttemptId(),history=parseHistory(localStorage.getItem(DEFAULT_HISTORY_STORAGE_KEY)||'[]'),next=upsertHistory(history,summary,{attemptId});
      localStorage.setItem(DEFAULT_HISTORY_STORAGE_KEY,serializeHistory(next));
      refreshVisibleTrendCard(next);
      window.dispatchEvent(new CustomEvent('driving-lab:history-finalized',{detail:{attemptId,summary}}));
    }catch(err){
      synced.delete(session);
      console.warn('history completion sync unavailable',err);
    }
  };
  setInterval(sync,250);
}
if(typeof window!=='undefined')queueMicrotask(installCompletedAttemptSync);
