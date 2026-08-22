const VALID_LINES = new Set(['left', 'right', 'back']);

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

export function riskVisualState(risk = {}) {
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

let installed = false;
function ensureOverlay() {
  if (typeof document === 'undefined') return null;
  let root = document.querySelector('#line-risk-overlay');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'line-risk-overlay';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<i data-line="left"></i><i data-line="right"></i><i data-line="back"></i>';
  document.body.append(root);
  if (!installed) {
    const style = document.createElement('style');
    style.textContent = `
#line-risk-overlay{position:fixed;inset:0;z-index:7;pointer-events:none;--risk-color:255,187,79;--risk-opacity:.7;--risk-pulse:1.1s}
#line-risk-overlay i{position:absolute;display:block;opacity:0;transition:opacity .16s ease,box-shadow .16s ease;background:rgba(var(--risk-color),var(--risk-opacity));box-shadow:0 0 18px rgba(var(--risk-color),.55)}
#line-risk-overlay i.active{opacity:1;animation:driving-risk-pulse var(--risk-pulse) ease-in-out infinite}
#line-risk-overlay i[data-line="left"]{left:0;top:18%;bottom:18%;width:5px;border-radius:0 5px 5px 0}
#line-risk-overlay i[data-line="right"]{right:0;top:18%;bottom:18%;width:5px;border-radius:5px 0 0 5px}
#line-risk-overlay i[data-line="back"]{left:28%;right:28%;bottom:max(116px,calc(104px + env(safe-area-inset-bottom)));height:5px;border-radius:5px 5px 0 0}
#line-risk-overlay[data-level="touch"]{--risk-color:255,73,83}
#line-risk-overlay[data-level="danger"]{--risk-color:255,100,82}
#line-risk-overlay[data-level="warn"]{--risk-color:255,185,73}
#line-risk-overlay[data-level="caution"]{--risk-color:255,214,102}
@keyframes driving-risk-pulse{0%,100%{filter:brightness(.8)}50%{filter:brightness(1.45)}}
@media(max-width:430px){#line-risk-overlay i[data-line="left"],#line-risk-overlay i[data-line="right"]{top:14%;bottom:20%}#line-risk-overlay i[data-line="back"]{left:22%;right:22%}}
`;
    document.head.append(style);
    installed = true;
  }
  return root;
}

export function publishRiskOverlay(risk) {
  const visual = riskVisualState(risk);
  const root = ensureOverlay();
  if (!root) return visual;
  root.dataset.level = visual.level;
  root.style.setProperty('--risk-opacity', `${visual.opacity}`);
  root.style.setProperty('--risk-pulse', `${visual.pulseSec || 1.2}s`);
  for (const el of root.querySelectorAll('[data-line]')) {
    el.classList.toggle('active', visual.active && visual.lines.includes(el.dataset.line));
  }
  return visual;
}
