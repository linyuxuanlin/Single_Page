const LABELS=Object.freeze({left:'左侧库线',right:'右侧库线',back:'后侧库线'});

export function replayHighlightState(detail,{pulseHz=1.8}={}){
  if(!detail)return {active:false,lines:[],lineLabels:[],danger:false,pulse:0,label:''};
  const lines=[...new Set((detail.collision?.lines||[]).filter(name=>LABELS[name]))];
  const markerDanger=detail.marker?.type==='line-touch';
  const active=lines.length>0||markerDanger;
  const t=Number.isFinite(detail.t)?detail.t:0;
  const pulse=active?.5+.5*Math.sin(t*Math.PI*2*pulseHz):0;
  const lineLabels=lines.map(name=>LABELS[name]);
  const label=lines.length?`触线：${lineLabels.join('、')}`:(markerDanger?'首次触线':'');
  return {active,lines,lineLabels,danger:active,pulse,label};
}

export function replayHighlightStyle(highlight){
  const h=highlight||{};
  const pulse=Number.isFinite(h.pulse)?Math.max(0,Math.min(1,h.pulse)):0;
  return {
    lineEmissive:h.active?.35+.65*pulse:0,
    bodyOpacity:h.active?.18+.18*pulse:0,
    bodyScale:h.active?1.002+.004*pulse:1,
  };
}
