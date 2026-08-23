import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

assert.match(
  html,
  /if\(session\.completed&&!reviewShownForCompletion\)\{reviewShownForCompletion=true;showReview\(currentSummary\(\)\)\}/,
  'automatic review must wait for the session dwell-based completion state',
);

assert.doesNotMatch(
  html,
  /if\(success&&!reviewShownForCompletion/,
  'raw single-frame parkingSuccess must never trigger automatic review directly',
);

assert.match(
  html,
  /else if\(session\.completed\)\{el\.className='panel status warn';el\.innerHTML='<strong>入库完成<\/strong><small>稳定停车 0\.35 s · 已生成复盘<\/small>'\}/,
  'HUD completion state must use the same dwell-based session completion source',
);

assert.doesNotMatch(
  html,
  /else if\(parkingSuccess\(state\)\)\{el\.className='panel status warn'/,
  'HUD must not announce completion from a transient parkingSuccess frame',
);

console.log('completion-ui-integration-tests: all assertions passed');
