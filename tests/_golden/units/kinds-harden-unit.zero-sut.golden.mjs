#!/usr/bin/env node
// kinds-harden U1-U3 的纯存活覆盖；I1/I2 浏览器证据仍留原金牌隔离。
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

// sourceObligationId:hg-kinds-harden-u1 unitCheckId:kinds-harden-unit-u1
// lifecycle-successor: {"sourceObligationId":"hg-kinds-harden-u1","unitCheckId":"kinds-harden-unit-u1"}
check('kinds-harden-unit-u1', '已实现 kind 集守本轮两项且 switchState 仍未实现', () => {
  for (const kind of ['textVisible', 'noErrorToast']) {
    if (!IMPLEMENTED_KINDS.has(kind)) throw new Error(`已实现集缺 ${kind}`);
  }
  if (IMPLEMENTED_KINDS.has('switchState')) throw new Error('switchState 不应在已实现集');
  if (IMPLEMENTED_KINDS.size < 7) throw new Error(`已实现集不应缩水（≥7），实际 ${IMPLEMENTED_KINDS.size}`);
});

// sourceObligationId:hg-kinds-harden-u2 unitCheckId:kinds-harden-unit-u2
// lifecycle-successor: {"sourceObligationId":"hg-kinds-harden-u2","unitCheckId":"kinds-harden-unit-u2"}
check('kinds-harden-unit-u2', 'textVisible 命中/未命中/缺采集三向', () => {
  const hit = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], { textHits: { '保存成功': 2 } })[0];
  if (hit.ok !== true || hit.actual !== 2) throw new Error(`命中应 true/2，实际 ${hit.ok}/${hit.actual}`);
  const miss = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], { textHits: { '保存成功': 0 } })[0];
  if (miss.ok !== false || miss.actual !== 0) throw new Error(`未命中应 false/0，实际 ${miss.ok}/${miss.actual}`);
  const unavailable = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], {})[0];
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
});

// sourceObligationId:hg-kinds-harden-u3 unitCheckId:kinds-harden-unit-u3
// lifecycle-successor: {"sourceObligationId":"hg-kinds-harden-u3","unitCheckId":"kinds-harden-unit-u3"}
check('kinds-harden-unit-u3', 'noErrorToast 词表正反/零弹窗/缺采集', () => {
  const clean = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: ['保存成功'] })[0];
  if (clean.ok !== true || String(clean.actual) !== '保存成功') {
    throw new Error(`非错误弹窗应 true 且 actual 携文本，实际 ${clean.ok}/${JSON.stringify(clean.actual)}`);
  }
  const bad = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: ['操作失败：无权限'] })[0];
  if (bad.ok !== false || !String(bad.actual).includes('操作失败')) throw new Error('错误词表命中应 false 且 actual 携命中文本');
  const none = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: [] })[0];
  if (none.ok !== true) throw new Error(`零弹窗应 true，实际 ${none.ok}`);
  const unavailable = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], {})[0];
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`kinds-harden unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`kinds-harden unit: ${passed}/${passed} passed`);
