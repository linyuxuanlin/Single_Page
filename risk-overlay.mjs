const VALID_LINES = new Set(['left', 'right', 'back']);
const LINE_LABELS = Object.freeze({ left: '左侧库线', right: '右侧库线', back: '后侧库线' });

export function normalizeRiskLines(lines = []) {
  const seen = new Set();
  const result = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!VALID_LINES.has(line) || seen.has(line)) continue;
    seen.add(line);
    result.push(line);
  }
  return result;
}

function sameLines(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((line, index) => line === b[index]);
}

function baseRiskVisualState(risk = {}) {
  const lines = normalizeRiskLines(risk.hitLines);
  const distance = Number.isFinite(risk.distanceAhead) ? Math.max(0, risk.distanceAhead) : null;
  const touching = Boolean(risk.alreadyTouching);
  const predicted = Boolean(risk.willTouch) && !touching;
  if (!lines.length || (!touching && !predicted)) {
    return { active: false, level: 'clear', lines: [], distanceAhead: distance, pulseSec: 0, opacity: 0 };
  }
  if (touching) {
    return { active: true, level: 'touch', lines, distanceAhead: 0, pulseSec: 0.72, opacity: 0.95 };
  }
  if (distance !== null && distance <= 0.8) {
    return { active: true, level: 'danger', lines, distanceAhead: distance, pulseSec: 0.88, opacity: 0.88 };
  }
  if (distance !== null && distance <= 2.0) {
    return { active: true, level: 'warn', lines, distanceAhead: distance, pulseSec: 1.15, opacity: 0.72 };
  }
  return { active: true, level: 'caution', lines, distanceAhead: distance, pulseSec: 1.45, opacity: 0.5 };
}

/**
 * Keep severity stable around the 0.8 m / 2.0 m boundaries.
 * Escalation is immediate; downgrade needs a little extra clearance.
 */
export function riskVisualState(risk = {}, previous = null) {
  const next = baseRiskVisualState(risk);
  if (!previous?.active || !next.active || !sameLines(previous.lines, next.lines)) return next;
  if (!Number.isFinite(next.distanceAhead)) return next;

  if (previous.level === 'danger' && next.level === 'warn' && next.distanceAhead <= 0.95) {
    return { ...next, level: 'danger', pulseSec: 0.88, opacity: 0.88 };
  }
  if (previous.level === 'warn' && next.level === 'caution' && next.distanceAhead <= 2.2) {
    return { ...next, level: 'warn', pulseSec: 1.15, opacity: 0.72 };
  }
  return next;
}

export function riskLineText(line, visual = {}) {
  const label = LINE_LABELS[line] || line;
  if (!visual.active) return label;
  if (visual.level === 'touch') return `${label} · 已触线`;
  if (Number.isFinite(visual.distanceAhead)) return `${label} · ${visual.distanceAhead.toFixed(1)} m`;
  return `${label} · 注意`;
}

export function riskSummaryText(visual = {}) {
  const lines = normalizeRiskLines(visual.lines);
  if (!visual.active || !lines.length) return '';
  const names = lines.map(line => LINE_LABELS[line]).join('、');
  if (visual.level === 'touch') return `已触碰${names}`;
  if (Number.isFinite(visual.distanceAhead)) return `${visual.distanceAhead.toFixed(1)} m 后可能触碰${names}`;
  return `当前轨迹可能触碰${names}`;
}

let installed = false;
let previousPublishedVisual = null;
function ensureOverlay() {
  if (typeof document === 'undefined') return null;
  let root = document.querySelector('#line-risk-overlay');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'line-risk-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<i data-line="left"><span></span></i><i data-line="right"><span></span></i><i data-line="back"><span></span></i>';
  document.body.append(root);
  if (!installed) {
    const style = document.createElement('style');
    style.textContent = `
#line-risk-overlay{position:fixed;inset:0;z-index:7;pointer-events:none;--risk-color:255,187,79;--risk-opacity:.7;--risk-pulse:1.1s}
#line-risk-overlay i{position:absolute;display:block;opacity:0;transition:opacity .16s ease,box-shadow .16s ease;background:rgba(var(--risk-color),var(--risk-opacity));box-shadow:0 0 18px rgba(var(--risk-color),.55)}
#line-risk-overlay i.active{opacity:1;animation:driving-risk-pulse var(--risk-pulse) ease-in-out infinite}
#line-risk-overlay i span{position:absolute;display:block;white-space:nowrap;padding:3px 7px;border-radius:999px;background:rgba(10,12,15,.84);border:1px solid rgba(var(--risk-color),.58);box-shadow:0 4px 14px rgba(0,0,0,.28);color:#fff;font:700 10px/1.2 Inter,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.01em}
#line-risk-overlay i[data-line="left"]{left:0;top:18%;bottom:18%;width:5px;border-radius:0 5px 5px 0}
#line-risk-overlay i[data-line="left"] span{left:10px;top:50%;transform:translateY(-50%)}
#line-risk-overlay i[data-line="right"]{right:0;top:18%;bottom:18%;width:5px;border-radius:5px 0 0 5px}
#line-risk-overlay i[data-line="right"] span{right:10px;top:50%;transform:translateY(-50%)}
#line-risk-overlay i[data-line="back"]{left:28%;right:28%;bottom:max(116px,calc(104px + env(safe-area-inset-bottom)));height:5px;border-radius:5px 5px 0 0}
#line-risk-overlay i[data-line="back"] span{left:50%;bottom:10px;transform:translateX(-50%)}
#line-risk-overlay[data-level="touch"]{--risk-color:255,73,83}
#line-risk-overlay[data-level="danger"]{--risk-color:255,100,82}
#line-risk-overlay[data-level="warn"]{--risk-color:255,185,73}
#line-risk-overlay[data-level="caution"]{--risk-color:255,214,102}
@keyframes driving-risk-pulse{0%,100%{filter:brightness(.8)}50%{filter:brightness(1.45)}}
@media(prefers-reduced-motion:reduce){#line-risk-overlay i.active{animation:none;filter:none}}
@media(max-width:430px){#line-risk-overlay i[data-line="left"],#line-risk-overlay i[data-line="right"]{top:14%;bottom:20%}#line-risk-overlay i[data-line="back"]{left:22%;right:22%}#line-risk-overlay i span{font-size:9px;padding:3px 6px}}
`;
    document.head.append(style);
    installed = true;
  }
  return root;
}

export function resetRiskOverlayState() {
  previousPublishedVisual = null;
}

export function publishRiskOverlay(risk) {
  const visual = riskVisualState(risk, previousPublishedVisual);
  previousPublishedVisual = visual;
  const root = ensureOverlay();
  if (!root) return visual;
  root.dataset.level = visual.level;
  root.style.setProperty('--risk-opacity', `${visual.opacity}`);
  root.style.setProperty('--risk-pulse', `${visual.pulseSec || 1.2}s`);
  for (const el of root.querySelectorAll('[data-line]')) {
    const line = el.dataset.line;
    const active = visual.active && visual.lines.includes(line);
    el.classList.toggle('active', active);
    const label = el.querySelector('span');
    if (label) label.textContent = active ? riskLineText(line, visual) : '';
  }
  return visual;
}
