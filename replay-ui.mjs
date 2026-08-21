import {referenceTrajectory} from './physics.mjs';
import {buildReplayModel,buildReplayTimeline,replayPoseAtProgress,createReplayPlayback,setReplayPlaying,advanceReplay,seekReplay,seekAdjacentReplayMarker} from './replay.mjs';

const clamp01=v=>Math.max(0,Math.min(1,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime=s=>`${Math.max(0,s||0).toFixed(1)}s`;

function ensureStyle(){
  if(document.querySelector('#replay-ui-style'))return;
  const style=document.createElement('style');style.id='replay-ui-style';style.textContent=`
  .replay-card{margin:12px 0;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}
  .replay-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.replay-head b{font-size:12px}.replay-head small{color:#8f99a8;font-size:9px}
  .replay-map{display:block;width:100%;height:auto;aspect-ratio:1.7/1;border-radius:11px;background:#171c21;border:1px solid rgba(255,255,255,.07)}
  .replay-legend{display:flex;gap:10px;align-items:center;margin:7px 1px 8px;color:#9ba6b3;font-size:9px}.replay-legend i{display:inline-block;width:13px;height:2px;margin-right:4px;vertical-align:middle}.replay-legend .actual{background:#6fb3ff}.replay-legend .ref{background:#ffd567}.replay-legend .event{width:7px;height:7px;border-radius:50%;background:#ff7f7f}
  .replay-slider{width:100%;accent-color:#7faeff}.replay-time{display:flex;justify-content:space-between;font-size:9px;color:#8f99a8;margin-top:2px}
  .replay-events{display:flex;gap:5px;overflow-x:auto;padding:7px 0 2px;scrollbar-width:none}.replay-events::-webkit-scrollbar{display:none}.replay-events button{flex:0 0 auto;padding:5px 7px!important;border-radius:999px!important;font-size:9px!important;color:#dfe8f2!important;background:rgba(255,255,255,.055)!important}.replay-events button.danger{border-color:rgba(255,110,110,.45)!important;color:#ffb1b1!important}
  .replay-controls{display:grid;grid-template-columns:56px 1fr 56px;gap:6px;margin-top:7px}.replay-controls button{padding:7px 5px!important;font-size:10px!important}.replay-note{margin-top:6px;font-size:9px;color:#8f99a8;line-height:1.4}
  `;document.head.appendChild(style);
}

function buildProjector(actual,ref,w=600,h=350,pad=24){
  const all=[...actual,...ref];if(!all.length)return p=>({x:w/2,y:h/2});
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const p of all){minX=Math.min(minX,p.rearX??p.x);maxX=Math.max(maxX,p.rearX??p.x);minZ=Math.min(minZ,p.rearZ??p.z);maxZ=Math.max(maxZ,p.rearZ??p.z)}
  const dx=Math.max(.5,maxX-minX),dz=Math.max(.5,maxZ-minZ),scale=Math.min((w-pad*2)/dx,(h-pad*2)/dz),ox=(w-dx*scale)/2-minX*scale,oz=(h-dz*scale)/2+maxZ*scale;
  return p=>({x:(p.rearX??p.x)*scale+ox,y:oz-(p.rearZ??p.z)*scale,scale});
}
function pathD(points,project){return points.map((p,i)=>{const q=project(p);return `${i?'L':'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`}).join(' ')}

export function installReplayUI(){
  if(typeof document==='undefined'||window.__drivingReplayUIInstalled)return;window.__drivingReplayUIInstalled=true;ensureStyle();
  const review=document.querySelector('.review'),backdrop=document.querySelector('#review-backdrop');if(!review||!backdrop)return;
  const card=document.createElement('section');card.className='replay-card';card.innerHTML=`<div class="replay-head"><b>轨迹回放 · 实际 vs 标准</b><small id="replay-status">完成练习后可回放</small></div><svg id="replay-map" class="replay-map" viewBox="0 0 600 350" aria-label="训练轨迹回放"></svg><div class="replay-legend"><span><i class="actual"></i>你的轨迹</span><span><i class="ref"></i>标准轨迹</span><span><i class="event"></i>关键事件</span></div><input id="replay-slider" class="replay-slider" type="range" min="0" max="1000" value="0" step="1"><div class="replay-time"><span id="replay-current">0.0s</span><span id="replay-total">0.0s</span></div><div id="replay-events" class="replay-events"></div><div class="replay-controls"><button id="replay-prev">← 事件</button><button id="replay-play" class="primary">播放</button><button id="replay-next">事件 →</button></div><div class="replay-note">拖动时间轴查看车辆姿态；红点为首次触线等关键节点。轨迹使用后轴中心，与物理模型保持一致。</div>`;
  const actions=review.querySelector('.review-actions');review.insertBefore(card,actions||null);
  const map=card.querySelector('#replay-map'),slider=card.querySelector('#replay-slider'),playBtn=card.querySelector('#replay-play'),prevBtn=card.querySelector('#replay-prev'),nextBtn=card.querySelector('#replay-next'),eventsEl=card.querySelector('#replay-events'),statusEl=card.querySelector('#replay-status'),currentEl=card.querySelector('#replay-current'),totalEl=card.querySelector('#replay-total');
  let model=null,playback=createReplayPlayback(),project=null,lastTs=0,raf=0;
  const ref=referenceTrajectory().map(p=>({x:p.rearX,z:p.rearZ,rearX:p.rearX,rearZ:p.rearZ}));

  function draw(){
    if(!model||!model.trajectory.length){map.innerHTML='<text x="300" y="175" text-anchor="middle" fill="#7f8995" font-size="14">开始移动后会生成轨迹回放</text>';return}
    const actual=model.trajectory,pose=replayPoseAtProgress(model,playback.progress);project=buildProjector(actual,ref);const p=project(pose),tip={x:p.x-Math.sin(pose.yaw)*18,y:p.y+Math.cos(pose.yaw)*18};
    const markerSvg=model.markers.map(m=>{const q=project(m);const danger=m.type==='line-touch';return `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${danger?6:4.2}" fill="${danger?'#ff6f6f':'#ffb85c'}" stroke="#20252b" stroke-width="2"><title>${esc(m.label)}</title></circle>`}).join('');
    map.innerHTML=`<path d="${pathD(ref,project)}" fill="none" stroke="#ffd567" stroke-width="3" stroke-dasharray="8 7" opacity=".72"/><path d="${pathD(actual,project)}" fill="none" stroke="#6fb3ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${markerSvg}<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="8" fill="#f3f7fb" stroke="#6fb3ff" stroke-width="3"/><line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="#f3f7fb" stroke-width="3" stroke-linecap="round"/>`;
    slider.value=String(Math.round(playback.progress*1000));currentEl.textContent=fmtTime(pose.t-(model.trajectory[0]?.t||0));totalEl.textContent=fmtTime(model.durationSec);playBtn.textContent=playback.playing?'暂停':'播放';statusEl.textContent=`${Math.round(playback.progress*100)}% · ${pose.gear||'-'} · ${(Math.abs(pose.speed||0)*3.6).toFixed(1)} km/h`;
  }
  function rebuild(){
    const session=window.__drivingLabSession;if(!session?.samples?.length){model=null;draw();return}
    model=buildReplayModel(session,{maxPoints:180,maxMarkers:10});playback=createReplayPlayback();eventsEl.innerHTML='';const timeline=buildReplayTimeline(model);for(const marker of timeline.markers){const b=document.createElement('button');b.textContent=marker.label;b.classList.toggle('danger',marker.type==='line-touch');b.addEventListener('click',()=>{playback=seekReplay(playback,marker.progress);playback={...playback,playing:false};draw()});eventsEl.appendChild(b)}draw();
  }
  function loop(ts){if(!model||!playback.playing){raf=0;return}const dt=lastTs?Math.min(.25,(ts-lastTs)/1000):0;lastTs=ts;playback=advanceReplay(playback,model,dt);draw();if(playback.playing)raf=requestAnimationFrame(loop);else raf=0}
  slider.addEventListener('input',()=>{if(!model)return;playback=seekReplay({...playback,playing:false},Number(slider.value)/1000);draw()});
  playBtn.addEventListener('click',()=>{if(!model)return;playback=setReplayPlaying(playback,!playback.playing);lastTs=0;draw();if(playback.playing&&!raf)raf=requestAnimationFrame(loop)});
  prevBtn.addEventListener('click',()=>{if(!model)return;({playback}=seekAdjacentReplayMarker(playback,model,-1));draw()});
  nextBtn.addEventListener('click',()=>{if(!model)return;({playback}=seekAdjacentReplayMarker(playback,model,1));draw()});
  new MutationObserver(()=>{if(backdrop.classList.contains('show'))rebuild();else if(raf){cancelAnimationFrame(raf);raf=0;playback={...playback,playing:false}}}).observe(backdrop,{attributes:true,attributeFilter:['class']});
  rebuild();
}
