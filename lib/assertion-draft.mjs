// lib/assertion-draft.mjs —— P4 相2 断言草拟器（纯函数、零 LLM）。
// D1（人签）：确定性为主、LLM 只补缝——本模块只做确定性合成与合规校验；LLM 补缝在 CLI 外产出、
// 其草稿必经 validateDraft 零 LLM 闸（fail-closed，护栏 #14）。决策档案 docs/plans/p4-drafter/proposed/GRILL.md。
// D2（人签）：kind 不在 replay-assert 已实现集 → 标 soft:true（进报告不进裁定树，不假红），
// 补实现后走重签提 hard；已实现集唯一供源 = lib/replay-assert.mjs 的 IMPLEMENTED_KINDS。
// 词表唯一事实源 = bin/check.mjs（护栏 #17）：校验走 --validate-only 子进程复核，绝不建副本表。
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PROJECT_ROOT } from './paths.mjs';
import { IMPLEMENTED_KINDS, decodeInputReadback, encodeInputReadback } from './replay-assert.mjs';

const CHECK = join(PROJECT_ROOT, 'bin', 'check.mjs');

// 确定性剥尾段实体 ID：末路径段为 4+ 位纯十六进制/纯数字即剥（/edit/8f3a21 → /edit）；
// 规则收窄防误伤真路径段（如 /list、/detail 不动）。
function stripTrailingId(pathname) {
  const segs = String(pathname).split('/');
  const last = segs[segs.length - 1];
  if (/^[0-9a-f]{4,}$/i.test(last) || /^\d{4,}$/.test(last)) return segs.slice(0, -1).join('/') || '/';
  return pathname;
}

// 该 intent 的观测末步（地面真值锚）；无观测步回 null（不硬凑）。
function lastStepOfIntent(observed, intentId) {
  const steps = (observed.steps || []).filter((s) => s.intentId === intentId);
  return steps.length ? steps[steps.length - 1] : null;
}

const softIfPending = (a) => (IMPLEMENTED_KINDS.has(a.kind) ? a : { ...a, soft: true });

// D1 查表映射：assert.* 原子 → typed 断言（确定性；证不出/未知一律不发明，落 pending 记 route:human）。
// 返回 null 表示该原子映射不出可靠断言（缺信号），由调用方落 pending。
function mapAtom(atom, observed) {
  const p = atom.params || {};
  switch (atom.atom) {
    case 'assert.onPage': {
      const st = lastStepOfIntent(observed, atom.intentId);
      // R3-F2：fallback 分支同剥实体 ID——urlIncludes 也可能带 ID 尾段（如 /edit/8f3a21），冻字面量同罪。
      const base = st && typeof st.urlPathnameAfter === 'string' ? stripTrailingId(st.urlPathnameAfter)
        : (typeof p.urlIncludes === 'string' && p.urlIncludes.startsWith('/') ? stripTrailingId(p.urlIncludes) : null);
      if (!base) return null;
      return { kind: 'urlPathname', op: 'startsWith', value: base };
    }
    case 'assert.textVisible':
      if (typeof p.text !== 'string' || !p.text) return null;
      return { kind: 'textVisible', op: 'appears', value: p.text };
    case 'assert.noErrorToast':
      return { kind: 'noErrorToast', op: 'absent' };
    case 'assert.buttonState':
      // btn-enable-ops（2026-07-07 翻转）：四 op 全实现全硬映射（enabled/disabled 挂账收口，
      // 判据与采集见 replay，词表见 check.mjs）；枚举外 state 仍回 null → pending[] 留痕。
      if (!['present', 'absent', 'enabled', 'disabled'].includes(p.state)) return null;
      return { kind: 'buttonState', op: p.state, value: typeof p.name === 'string' ? p.name : undefined };
    case 'assert.switchState':
      if (p.state !== 'on' && p.state !== 'off') return null;
      return { kind: 'switchState', op: p.state, value: typeof p.name === 'string' ? p.name : undefined };
    case 'workflow.assertNodeFieldValue':
      // regress wf_node_script 遗产只迁业务语义：前一步 setNodeField 已按节点抽屉标题 + placeholder
      // 锚定同一物理字段并精确回读。本命名断言把该回读升为冻结 inputReadback 期望，不另造 DOM 定位。
      // legacy 的“含子串”收紧为 equals：同一 flow 已知完整写入值，精确相等才能防半填/尾缀假绿。
      {
        const value = encodeInputReadback({ nodeName: p.nodeName, placeholder: p.placeholder, exact: p.exact === true, value: p.value });
        return value ? { kind: 'inputReadback', op: 'equals', value } : null;
      }
    default:
      return null; // 未知 assert.* 原子：禁发明（越界由 check 词表硬闸兜底）
  }
}

// 确定性合成骨架：assert.* 原子留痕 + 观测现状 → expectedDraft（{ caseId, intents, globalAssertions, pending }）。
// 全局取证默认加 noPageError + noErrorEnvelope（已实现，硬断言）；映射不出的原子落 pending[]（route:human 留痕，不静默丢）。
export function synthesizeSkeleton(observed, assertionAtoms) {
  if (!observed || typeof observed !== 'object' || !observed.caseId) throw new Error('synthesizeSkeleton: observed 缺 caseId（观测现状为地面真值锚，缺即拒）');
  const byIntent = new Map();
  const pending = [];
  for (const atom of assertionAtoms || []) {
    const mapped = mapAtom(atom, observed);
    if (!mapped) { pending.push({ intentId: atom.intentId ?? null, atom: atom.atom, reason: '映射不出可靠断言（未知原子或缺干净信号）→ route:human' }); continue; }
    if (!byIntent.has(atom.intentId)) byIntent.set(atom.intentId, []);
    byIntent.get(atom.intentId).push(softIfPending(mapped));
  }
  return {
    caseId: observed.caseId,
    intents: [...byIntent.entries()].map(([intentId, expected]) => ({ intentId, expected })),
    globalAssertions: [
      { kind: 'noPageError', op: 'absent' },
      { kind: 'noErrorEnvelope', op: 'envelopeOk' },
    ].map(softIfPending),
    pending,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function appendStructurallyUnique(target, additions) {
  const seen = new Set(target.map(canonicalJson));
  for (const addition of additions) {
    const key = canonicalJson(addition);
    if (seen.has(key)) continue;
    target.push(cloneJson(addition));
    seen.add(key);
  }
}

function authoredPending({ intentId = null, atom, assertionIndex }) {
  return {
    intentId,
    atom,
    assertionIndex,
    reason: 'AUTHORED_ASSERTION_INCOMPLETE',
  };
}

// TestCase authored expected/globalAssertions 是相2的第一事实源：完整项逐字投影，不完整项只留 pending，
// 绝不猜 kind/op。intent 顺序跟随 TestCase steps，assertion 顺序跟随 authored 数组。
export function projectTestCaseAssertions(testcase) {
  if (!testcase || typeof testcase !== 'object' || typeof testcase.caseId !== 'string' || !testcase.caseId) {
    throw new Error('projectTestCaseAssertions: testcase 缺 caseId');
  }
  if (!Array.isArray(testcase.steps) || testcase.steps.length === 0) {
    throw new Error('projectTestCaseAssertions: testcase.steps 须为非空数组');
  }
  if (testcase.globalAssertions !== undefined && !Array.isArray(testcase.globalAssertions)) {
    throw new Error('projectTestCaseAssertions: testcase.globalAssertions 须为数组');
  }

  const byIntent = new Map();
  const pending = [];
  const seenIntents = new Set();
  for (const step of testcase.steps) {
    if (!step || typeof step !== 'object' || typeof step.intentId !== 'string' || !step.intentId) {
      throw new Error('projectTestCaseAssertions: testcase.steps 含无效 intentId');
    }
    if (seenIntents.has(step.intentId)) {
      throw new Error('projectTestCaseAssertions: testcase.steps intentId 重复');
    }
    seenIntents.add(step.intentId);
    if (step.expected === undefined) continue;
    if (!Array.isArray(step.expected)) {
      throw new Error('projectTestCaseAssertions: testcase.steps[].expected 须为数组');
    }
    if (step.expected.length && !byIntent.has(step.intentId)) byIntent.set(step.intentId, []);
    step.expected.forEach((assertion, assertionIndex) => {
      if (!assertion || typeof assertion.kind !== 'string' || !assertion.kind
        || typeof assertion.op !== 'string' || !assertion.op) {
        pending.push(authoredPending({
          intentId: step.intentId,
          atom: 'authored.expected',
          assertionIndex,
        }));
        return;
      }
      byIntent.get(step.intentId).push(cloneJson(assertion));
    });
  }

  const globalAssertions = [];
  (testcase.globalAssertions || []).forEach((assertion, assertionIndex) => {
    if (!assertion || typeof assertion.kind !== 'string' || !assertion.kind
      || typeof assertion.op !== 'string' || !assertion.op) {
      pending.push(authoredPending({
        atom: 'authored.globalAssertions',
        assertionIndex,
      }));
      return;
    }
    globalAssertions.push(cloneJson(assertion));
  });

  return {
    caseId: testcase.caseId,
    intents: [...byIntent.entries()].map(([intentId, expected]) => ({ intentId, expected })),
    globalAssertions,
    pending,
  };
}

// 单调合并事实源：authored 在前，compiler 只追加精确结构上尚不存在的断言；默认全局取证同样保留。
export function mergeAssertionSources({ testcase, observed, assertionAtoms }) {
  const authored = projectTestCaseAssertions(testcase);
  if (!observed || typeof observed !== 'object' || authored.caseId !== observed.caseId) {
    throw new Error('mergeAssertionSources: testcase/observed caseId 不一致或缺席');
  }
  const compiler = synthesizeSkeleton(observed, assertionAtoms);
  const intents = authored.intents.map((intent) => ({
    intentId: intent.intentId,
    expected: intent.expected.map(cloneJson),
  }));
  const byIntent = new Map(intents.map((intent) => [intent.intentId, intent]));

  for (const compilerIntent of compiler.intents) {
    let target = byIntent.get(compilerIntent.intentId);
    if (!target) {
      target = { intentId: compilerIntent.intentId, expected: [] };
      intents.push(target);
      byIntent.set(target.intentId, target);
    }
    appendStructurallyUnique(target.expected, compilerIntent.expected);
  }

  const globalAssertions = authored.globalAssertions.map(cloneJson);
  appendStructurallyUnique(globalAssertions, compiler.globalAssertions);
  return {
    caseId: authored.caseId,
    intents,
    globalAssertions,
    pending: [...authored.pending.map(cloneJson), ...compiler.pending.map(cloneJson)],
  };
}

// 模型补缝仍是加法，但“加法”必须幂等：与 authored/compiler 已有项或同一 patch 内前项结构相同
// 时视为 no-op，不能靠重复条目放大断言数量。该函数不删除、不替换任何既有断言。
export function mergeAssertionPatches(draft, patches) {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.intents)) {
    throw new TypeError('mergeAssertionPatches: draft.intents 须为数组');
  }
  if (!Array.isArray(patches)) throw new TypeError('mergeAssertionPatches: patches 须为数组');
  for (const patch of patches) {
    if (!patch || typeof patch.intentId !== 'string' || !patch.intentId) {
      throw new TypeError('补缝条目缺 intentId');
    }
    let intent = draft.intents.find((item) => item.intentId === patch.intentId);
    if (!intent) {
      intent = { intentId: patch.intentId, expected: [] };
      draft.intents.push(intent);
    }
    if (!Array.isArray(intent.expected)) throw new TypeError('补缝目标 expected 须为数组');
    appendStructurallyUnique(intent.expected, [{
      kind: patch.kind,
      op: patch.op,
      ...(patch.value !== undefined ? { value: patch.value } : {}),
      ...(patch.soft === true ? { soft: true } : {}),
    }]);
  }
  draft.intents.sort((a, b) => a.intentId.localeCompare(b.intentId));
  return draft;
}

// kind/op 合法性：经 check.mjs --validate-only 子进程复核（词表唯一事实源）。exit 0 = 合法。
function checkKindOp(kind, op) {
  try {
    execFileSync(process.execPath, [CHECK, '--kind', String(kind), '--op', String(op), '--validate-only'], { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

// 零 LLM 校验闸（LLM 补缝草稿的准入，fail-closed）：
// 1) 形状：caseId + intents[].intentId/expected[]；2) kind/op 过 check 词表硬闸；
// 3) equals 值纪律：atl_ 裸字面量禁（仅 atl_{{uniqueName}} 模板形态合法）、9+ 位数字长串（时间戳/ID）禁。
export function validateDraft(draft) {
  const problems = [];
  if (!draft || typeof draft !== 'object') return { ok: false, problems: ['草稿非对象'] };
  if (typeof draft.caseId !== 'string' || !draft.caseId) problems.push('缺 caseId');
  // R2-F1/F2：顶层两入口非数组时只记问题、以空数组安全迭代——闸自身绝不抛（fail-closed = 全域返回 {ok,problems}）。
  if (!Array.isArray(draft.intents)) problems.push('intents 须为数组');
  const intents = Array.isArray(draft.intents) ? draft.intents : [];
  if (draft.globalAssertions != null && !Array.isArray(draft.globalAssertions)) problems.push('globalAssertions 须为数组');
  const globals = Array.isArray(draft.globalAssertions) ? draft.globalAssertions : [];

  // output-seal（codex R1-F3 提硬）：定位串 where 用结构性数组下标，不用 intentId——intentId 是文件侧
  // 输入（--patch 无预扫），可携种子；下标是结构位置泄不了。value 已在 :126-127 遮值，这里堵定位字段同型缝。
  const entries = [];
  intents.forEach((it, ii) => {
    if (!it || typeof it.intentId !== 'string' || !it.intentId) { problems.push(`intents[${ii}]: 缺 intentId`); return; }
    if (!Array.isArray(it.expected)) { problems.push(`intents[${ii}]: expected 须为数组（缺席/非数组拒）`); return; }
    it.expected.forEach((a, ai) => entries.push({ where: `intents[${ii}].expected[${ai}]`, a }));
  });
  globals.forEach((a, gi) => entries.push({ where: `globalAssertions[${gi}]`, a }));

  for (const { where, a } of entries) {
    if (!a || typeof a.kind !== 'string' || typeof a.op !== 'string') { problems.push(`${where}: 断言缺 kind/op`); continue; }
    // output-seal（codex R2-F4）：checkKindOp 之前 kind/op 是 --patch 任意文件侧输入，可携种子——原值不回显；
    // 结构性 where 下标已足够定位。（:121+ 的 a.kind 在 checkKindOp 之后、已是词表枚举，安全可留。）
    if (!checkKindOp(a.kind, a.op)) { problems.push(`${where}: kind/op 不过词表硬闸（原值不回显）`); continue; }
    // R3-F1：D2 soft 语义两向钉死——已实现 kind 标 soft = 绕硬裁定（fail-open 向）；
    // 未实现 kind 漏 soft = 回放 evaluateAssertions 必 ok:false 假红。LLM 草稿无权做这两种降格/漏标。
    // P4 冻结范例曾用非规范 inputReadback 字符串承载“尚未实现”的 soft 占位。该旧字节保持兼容：
    // 只有本契约定义的规范载荷才算已实现并必须走硬裁定；旧非规范值只允许继续作 soft，不得硬入场。
    const inputReadbackPayload = a.kind === 'inputReadback' ? decodeInputReadback(a.value) : null;
    const implemented = IMPLEMENTED_KINDS.has(a.kind)
      && (a.kind !== 'inputReadback' || inputReadbackPayload !== null);
    if (implemented && a.soft === true) problems.push(`${where}: 已实现 kind ${a.kind} 不得标 soft（绕硬裁定，D2）`);
    if (!implemented && a.soft !== true) problems.push(`${where}: 未实现 kind ${a.kind} 须标 soft:true（否则回放必假红，D2）`);
    if (a.kind === 'inputReadback' && inputReadbackPayload === null && a.soft !== true) {
      problems.push(`${where}: inputReadback 值须由节点名/字段锚/精确开关/完整值组成的规范载荷（原值不回显）`);
    }
    // R1-F2：易变字面量纪律盖全部字符串值、不分 op——contains/matches 冻会话 ID 同样是假红温床。
    if (typeof a.value === 'string') {
      // atl_ 后必须紧跟 {{uniqueName}} 模板（前缀字面合法）；裸 atl_ 名 = 冻易变字面量。
      // output-seal A3：只报「什么不对 + where 定位」，绝不回显断言值全文（--patch 无输入预扫、值可携凭据）。
      if (/atl_(?!\{\{uniqueName\}\})/.test(a.value)) problems.push(`${where}: 值含未模板化 atl_ 字面量（须 atl_{{uniqueName}} 形态；原值不回显）`);
      if (/\d{9,}/.test(a.value)) problems.push(`${where}: 值含 9+ 位数字长串（时间戳/实体 ID 字面量禁冻；原值不回显）`);
    }
  }
  return { ok: problems.length === 0, problems };
}
