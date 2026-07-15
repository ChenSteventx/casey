// lib/expected-compile.mjs —— 断言冻结编译（零 LLM、纯函数、可 golden）。
//
// 把已冻 expected.frozen 旁车的逐条 typed 断言，确定性编译成可运行 check 命令字符串。
// 形状钉死 design §5/§8：gate 把每条 expected[] 编成一条命令塞进 acceptance[]，gate 主循环原样、prd.acceptance 形状不变。
//
//   compileExpectedToChecks(expectedFrozen) -> string[]
//     node bin/check.mjs --case <caseId> --intent <intentId> --kind <kind> --op <op> --value <value>
//
//   - intents[].expected[]：逐条带 --intent <intentId> 卷回意图（design §2 两层 ID：intentId 语义、stepId 位置式）。
//   - globalAssertions[]：跨 intent 取证类，无 --intent 维度。
//   - soft 断言也编译，但带 --soft 标记——仍进报告不进裁定，由已冻 verdict.mjs 排除（design §4.4/§5，防假绿）。本模块只编译并标记，不做裁定。
//   - 不发明 kind/op：只透传冻结契约里写的 kind/op/value（越界由 bin/check.mjs 词表硬闸拦，护栏 #17）。op/value 缺省则该旗标不出（取证类如 noPageError 可只有 kind）。
//
// 注意：本模块零 LLM、不碰已冻内核（verdict.mjs/check.mjs/compile-gate.mjs/forensics.mjs），也不读写冻结契约本体。

// 一条 frozenAssertion -> 一条 check 命令字符串。intentId 为 null/undefined 时不出 --intent（globalAssertions）。
export function compileAssertionToCheck(caseId, intentId, assertion) {
  const parts = ['node', 'bin/check.mjs', '--case', String(caseId)];
  if (intentId !== null && intentId !== undefined) parts.push('--intent', String(intentId));
  parts.push('--kind', String(assertion.kind));
  if (assertion.op !== null && assertion.op !== undefined) parts.push('--op', String(assertion.op));
  if (assertion.value !== null && assertion.value !== undefined) parts.push('--value', String(assertion.value));
  if (assertion.soft === true) parts.push('--soft'); // 标记软断言：进报告不进裁定（verdict.mjs 据此排除）
  return parts.join(' ');
}

export function compileExpectedToChecks(expectedFrozen) {
  if (!expectedFrozen || typeof expectedFrozen !== 'object') throw new Error('compileExpectedToChecks: 入参须为 expected.frozen 对象');
  const caseId = expectedFrozen.caseId;
  if (!caseId) throw new Error('compileExpectedToChecks: expected.frozen 缺 caseId');
  const cmds = [];
  for (const intent of expectedFrozen.intents ?? []) {
    for (const a of intent.expected ?? []) cmds.push(compileAssertionToCheck(caseId, intent.intentId, a));
  }
  for (const a of expectedFrozen.globalAssertions ?? []) cmds.push(compileAssertionToCheck(caseId, null, a));
  return cmds;
}
