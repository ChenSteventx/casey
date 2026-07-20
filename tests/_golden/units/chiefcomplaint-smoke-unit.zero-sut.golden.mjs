#!/usr/bin/env node
// chiefcomplaint-smoke U1-U5 的纯存活覆盖；I/W/C 段仍留原金牌隔离。
import { evaluateAssertions, IMPLEMENTED_KINDS } from '../../../lib/replay-assert.mjs';

const failures = [];
let passed = 0;

function check(unitCheckId, name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId} ${name}`);
  } catch (error) {
    failures.push(`${unitCheckId} ${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

// sourceObligationId:hg-chiefcomplaint-smoke-u1 unitCheckId:chiefcomplaint-smoke-unit-u1
// lifecycle-successor: {"sourceObligationId":"hg-chiefcomplaint-smoke-u1","unitCheckId":"chiefcomplaint-smoke-unit-u1"}
check('chiefcomplaint-smoke-unit-u1', '已实现 kind 集守本轮三项且 switchState 仍未实现', () => {
  for (const kind of ['replyContains', 'replyMatches', 'textHidden']) {
    if (!IMPLEMENTED_KINDS.has(kind)) throw new Error(`已实现集缺 ${kind}`);
  }
  if (IMPLEMENTED_KINDS.has('switchState')) throw new Error('switchState 不应在已实现集');
  if (IMPLEMENTED_KINDS.size < 10) throw new Error(`已实现集不应缩水（≥10），实际 ${IMPLEMENTED_KINDS.size}`);
});

// sourceObligationId:hg-chiefcomplaint-smoke-u2 unitCheckId:chiefcomplaint-smoke-unit-u2
// lifecycle-successor: {"sourceObligationId":"hg-chiefcomplaint-smoke-u2","unitCheckId":"chiefcomplaint-smoke-unit-u2"}
check('chiefcomplaint-smoke-unit-u2', 'replyContains 命中/未命中/缺采集三向', () => {
  const hit = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '建议' }], { replyText: '您好，建议多休息。' })[0];
  if (hit.ok !== true || !String(hit.actual).includes('建议')) throw new Error(`命中应 true 且 actual 携回复，实际 ${hit.ok}/${hit.actual}`);
  const miss = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '不存在词九三七' }], { replyText: '您好。' })[0];
  if (miss.ok !== false) throw new Error(`未命中应 false，实际 ${miss.ok}`);
  const unavailable = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '建议' }], {})[0];
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
});

// sourceObligationId:hg-chiefcomplaint-smoke-u3 unitCheckId:chiefcomplaint-smoke-unit-u3
// lifecycle-successor: {"sourceObligationId":"hg-chiefcomplaint-smoke-u3","unitCheckId":"chiefcomplaint-smoke-unit-u3"}
check('chiefcomplaint-smoke-unit-u3', 'replyMatches 匹配/不匹配/缺采集三向', () => {
  const hit = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '休息' }], { replyText: '建议多休息。' })[0];
  if (hit.ok !== true) throw new Error(`匹配应 true，实际 ${hit.ok}`);
  const negativeLookahead = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '^(?!(.|\\n)*操作失败)' }], { replyText: '建议多休息。' })[0];
  if (negativeLookahead.ok !== true) throw new Error(`负向环视无命中应 true，实际 ${negativeLookahead.ok}`);
  const miss = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '^绝不匹配$' }], { replyText: '建议多休息。' })[0];
  if (miss.ok !== false) throw new Error(`不匹配应 false，实际 ${miss.ok}`);
  const unavailable = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '休息' }], {})[0];
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
  const missingValue = evaluateAssertions([{ kind: 'replyMatches', op: 'matches' }], { replyText: '建议多休息。' })[0];
  if (missingValue.ok !== false) throw new Error(`缺 value 应 false（fail-safe），实际 ${missingValue.ok}`);
});

// sourceObligationId:hg-chiefcomplaint-smoke-u4 unitCheckId:chiefcomplaint-smoke-unit-u4
// lifecycle-successor: {"sourceObligationId":"hg-chiefcomplaint-smoke-u4","unitCheckId":"chiefcomplaint-smoke-unit-u4"}
check('chiefcomplaint-smoke-unit-u4', 'textHidden 缺席/在场/缺采集三向', () => {
  const clean = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], { textHits: { '操作失败': 0 } })[0];
  if (clean.ok !== true || clean.actual !== 0) throw new Error(`缺席应 true/0，实际 ${clean.ok}/${clean.actual}`);
  const bad = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], { textHits: { '操作失败': 2 } })[0];
  if (bad.ok !== false || bad.actual !== 2) throw new Error(`在场应 false/2，实际 ${bad.ok}/${bad.actual}`);
  const unavailable = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], {})[0];
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
});

// sourceObligationId:hg-chiefcomplaint-smoke-u5 unitCheckId:chiefcomplaint-smoke-unit-u5
// lifecycle-successor: {"sourceObligationId":"hg-chiefcomplaint-smoke-u5","unitCheckId":"chiefcomplaint-smoke-unit-u5"}
check('chiefcomplaint-smoke-unit-u5', 'streamReplyReceived profile/legacy 命中及双不命中', () => {
  const records = (url) => [{ url, status: 200, streamFinished: true, streamStatus: 200, attributedStepId: 'atstep_0' }];
  const viaProfile = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }], {
    netRecords: records('http://x/ai-api/tester/agent/stream'),
    streamUrlPattern: '/ai-api/tester/agent/stream',
  })[0];
  if (viaProfile.ok !== true) throw new Error(`profile 模式命中应 true，实际 ${viaProfile.ok}`);
  const legacy = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }], {
    netRecords: records('http://x/api/llm/streamReply'),
  })[0];
  if (legacy.ok !== true) throw new Error(`legacy /streamReply/ 兼容应 true，实际 ${legacy.ok}`);
  const neither = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }], {
    netRecords: records('http://x/api/other'),
    streamUrlPattern: '/ai-api/tester/agent/stream',
  })[0];
  if (neither.ok !== false) throw new Error(`双不命中应 false，实际 ${neither.ok}`);
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`chiefcomplaint-smoke unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`chiefcomplaint-smoke unit: ${passed}/${passed} passed`);
