#!/usr/bin/env node
// 纯函数后继：只经 performAction 的输入门，桩 page 任意访问即抛；不启动/连接 SUT 或浏览器。
import { performAction } from '../../../lib/replay-actions.mjs';

// sourceObligationId:hg-drawer-lock-hardening-g7a-input-gate
// sourceObligationId:hg-drawer-lock-hardening-g7b-input-gate
// sourceObligationId:hg-drawer-lock-hardening-g7c-1-input-gate
// sourceObligationId:hg-drawer-lock-hardening-g7c-2-input-gate
// sourceObligationId:hg-drawer-lock-hardening-g7d-input-gate
// sourceObligationId:hg-drawer-lock-hardening-g20a-input-gate

const cases = [
  { checkId: 'U-G7a', event: { atom: 'workflow.setNodeField', action: 'fill', placeholder: '节点名称', value: 'x' } },
  { checkId: 'U-G7b', event: { atom: 'workflow.selectNodeDropdown', action: 'click', text: 'x' } },
  { checkId: 'U-G7c-1', event: { atom: 'workflow.setNodeField', action: 'fill', nodeName: '', placeholder: '节点名称', value: 'x' } },
  { checkId: 'U-G7c-2', event: { atom: 'workflow.selectNodeDropdown', action: 'click', nodeName: '   ', text: 'x' } },
  { checkId: 'U-G7d', event: { atom: 'workflow.setNodeField', action: 'fill', nodeName: 12345, placeholder: '节点名称', value: 'x' } },
  { checkId: 'U-G20a', event: { atom: 'workflow.openNode', action: 'click', semantic: { kind: 'text', name: '   ', exact: true } } },
];

let pageTouches = 0;
const page = new Proxy({}, {
  get() {
    pageTouches += 1;
    throw new Error('输入门之后不应访问 page');
  },
});

for (const { checkId, event } of cases) {
  const result = await performAction(page, event, {});
  const expected = { resolution: 'action_failed', candidateCount: 0, identityReadback: { ok: false } };
  if (JSON.stringify(result) !== JSON.stringify(expected)) {
    throw new Error(`${checkId} 输入门未 fail-closed：${JSON.stringify(result)}`);
  }
  console.log(`ok   ${checkId} 输入门 fail-closed`);
}

if (pageTouches !== 0) throw new Error(`输入门访问了 page ${pageTouches} 次`);
console.log(`\ndrawer-lock input gates: ${cases.length}/${cases.length} passed; page untouched`);
