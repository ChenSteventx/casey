// lib/assertion-draft.mjs —— P4 相2 断言草拟器（纯函数、零 LLM）。
// D1（人签）：确定性为主、LLM 只补缝——本模块只做确定性合成与合规校验；LLM 补缝在 CLI 外产出、
// 其草稿必经 validateDraft 零 LLM 闸（fail-closed，护栏 #14）。决策档案 docs/plans/p4-drafter/proposed/GRILL.md。
// D2（人签）：kind 不在 replay-assert 已实现集 → 标 soft:true（进报告不进裁定树，不假红），
// 补实现后走重签提 hard；已实现集唯一供源 = lib/replay-assert.mjs 的 IMPLEMENTED_KINDS。
// 词表唯一事实源 = bin/check.mjs（护栏 #17）：校验走 --validate-only 子进程复核，绝不建副本表。
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PROJECT_ROOT } from './paths.mjs';
import { IMPLEMENTED_KINDS } from './replay-assert.mjs';

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

  const entries = [];
  for (const it of intents) {
    if (!it || typeof it.intentId !== 'string' || !it.intentId) { problems.push('intent 缺 intentId'); continue; }
    // R1-F1：expected 缺席/非数组 = 形状违例，fail-closed 拒（不许"空当没有"混过）。
    if (!Array.isArray(it.expected)) { problems.push(`${it.intentId}: expected 须为数组（缺席/非数组拒）`); continue; }
    for (const a of it.expected) entries.push({ where: it.intentId, a });
  }
  for (const a of globals) entries.push({ where: 'global', a });

  for (const { where, a } of entries) {
    if (!a || typeof a.kind !== 'string' || typeof a.op !== 'string') { problems.push(`${where}: 断言缺 kind/op`); continue; }
    if (!checkKindOp(a.kind, a.op)) { problems.push(`${where}: kind/op 不过词表硬闸 (kind=${a.kind}, op=${a.op})`); continue; }
    // R3-F1：D2 soft 语义两向钉死——已实现 kind 标 soft = 绕硬裁定（fail-open 向）；
    // 未实现 kind 漏 soft = 回放 evaluateAssertions 必 ok:false 假红。LLM 草稿无权做这两种降格/漏标。
    const implemented = IMPLEMENTED_KINDS.has(a.kind);
    if (implemented && a.soft === true) problems.push(`${where}: 已实现 kind ${a.kind} 不得标 soft（绕硬裁定，D2）`);
    if (!implemented && a.soft !== true) problems.push(`${where}: 未实现 kind ${a.kind} 须标 soft:true（否则回放必假红，D2）`);
    // R1-F2：易变字面量纪律盖全部字符串值、不分 op——contains/matches 冻会话 ID 同样是假红温床。
    if (typeof a.value === 'string') {
      // atl_ 后必须紧跟 {{uniqueName}} 模板（前缀字面合法）；裸 atl_ 名 = 冻易变字面量。
      if (/atl_(?!\{\{uniqueName\}\})/.test(a.value)) problems.push(`${where}: 值含未模板化 atl_ 字面量（须 atl_{{uniqueName}} 形态）：${a.value}`);
      if (/\d{9,}/.test(a.value)) problems.push(`${where}: 值含 9+ 位数字长串（时间戳/实体 ID 字面量禁冻）：${a.value}`);
    }
  }
  return { ok: problems.length === 0, problems };
}
