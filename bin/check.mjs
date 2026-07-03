#!/usr/bin/env node
// bin/check.mjs —— 单条断言确定性检查器。
//
//   node bin/check.mjs --kind <k> --op <op> [--value <v>] --validate-only
//     --validate-only：只查词表/op 合法性（hermetic，零 page）。exit 0 = 合法；exit≠0 = 非法。
//
// 护栏 #17：断言种类(kind)的枚举只活在此一处 —— verdict.mjs 对 kind 不可知，新增维度只在这里加 kind。
// LLM 不准发明自由断言：词表外 kind / 越界 op 一律拒（exit≠0）。
// equals 含易变值（实体 ID/uniqueName）会假红，故 urlPathname/textVisible 自动道禁 equals、仅人工批准。

const VOCAB = {
  urlPathname: ['startsWith', 'matches'], // equals 仅人工批准、自动道非法
  textVisible: ['appears'], // 取消 equals
  textHidden: ['absent'],
  countChange: ['up', 'down', 'equals'], // equals = 绝对归 0（删后计数归零）
  inputReadback: ['equals'], // 值含 uniqueName 必模板化（check 期实例化再比）
  dropdownReadback: ['equals'],
  requiredFilled: ['filled'],
  streamReplyReceived: ['finished'], // 只判匹配响应回 expectedStatus 且 finished()
  replyContains: ['contains'],
  replyMatches: ['matches'],
  noPageError: ['absent'],
  noErrorToast: ['absent'], // 新增：DOM 错误弹窗缺席（取证类）
  noErrorEnvelope: ['envelopeOk'],
  // wf-publish-states（D1，2026-07-03）：收窄为已实现双 op——词表=可草拟=已实现（IMPLEMENTED_KINDS 是
  // kind 级，词表留未实现 op 会让硬断言必假红）；enabled/disabled 随 publish_blocked 契约带实现回归（挂账）。
  buttonState: ['present', 'absent'],
  switchState: ['on', 'off'],
};

function parseArgs(argv) {
  const o = { validateOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--kind') o.kind = argv[++i];
    else if (a === '--op') o.op = argv[++i];
    else if (a === '--value') o.value = argv[++i];
    else if (a === '--case') o.case = argv[++i];
    else if (a === '--intent') o.intent = argv[++i];
    else if (a === '--validate-only') o.validateOnly = true;
  }
  return o;
}

function validateVocab(kind, op) {
  const ops = VOCAB[kind];
  if (!ops) return { ok: false, msg: `词表外 kind: ${kind}（LLM 不准发明自由断言）` };
  if (!ops.includes(op)) return { ok: false, msg: `kind ${kind} 不允许 op: ${op}（允许 ${ops.join('/')}）` };
  return { ok: true };
}

const args = parseArgs(process.argv.slice(2));
const v = validateVocab(args.kind, args.op);
if (!v.ok) {
  console.error(`check: ${v.msg}`);
  process.exit(2);
}

if (args.validateOnly) {
  process.exit(0); // 词表/op 合法
}

// 非 --validate-only：实际断言执行需回放期 page 上下文（相 3/4，P5），S1 hermetic 不覆盖。
console.error('check: 实际断言执行需回放上下文（P5），当前仅实现 --validate-only');
process.exit(3);
