import assert from 'node:assert/strict';
import { shouldAnnounceRisk, riskAnnouncementText } from './risk-overlay.mjs';

const visual=(level,distanceAhead,lines=['left'])=>({active:level!=='clear',level,distanceAhead,lines});

assert.equal(shouldAnnounceRisk(null,visual('warn',1.8)),true,'first risk must announce');
assert.equal(shouldAnnounceRisk(visual('warn',1.8),visual('warn',1.7),{elapsedMs:100}),false,'0.1 m jitter must not spam screen readers');
assert.equal(shouldAnnounceRisk(visual('warn',1.8),visual('warn',1.31),{elapsedMs:100}),false,'sub-threshold cumulative change stays quiet');
assert.equal(shouldAnnounceRisk(visual('warn',1.8),visual('warn',1.3),{elapsedMs:100}),true,'0.5 m change is meaningful');
assert.equal(shouldAnnounceRisk(visual('warn',1.0),visual('danger',0.8),{elapsedMs:20}),true,'severity escalation announces immediately');
assert.equal(shouldAnnounceRisk(visual('danger',0.5,['left']),visual('danger',0.5,['right']),{elapsedMs:20}),true,'target line change announces immediately');
assert.equal(shouldAnnounceRisk(visual('danger',0.4),visual('touch',0),{elapsedMs:20}),true,'actual contact announces immediately');
assert.equal(shouldAnnounceRisk(visual('warn',1.5),visual('clear',null,[]),{elapsedMs:20}),true,'risk clearing is observable state change');
assert.equal(riskAnnouncementText(visual('danger',0.4,['right'])),'危险。0.4 m 后可能触碰右侧库线');
assert.equal(riskAnnouncementText(visual('touch',0,['back'])),'已触线。已触碰后侧库线');
console.log('risk-announcement-tests: all assertions passed');
