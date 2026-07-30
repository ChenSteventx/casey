// lib/heal/admission.mjs —— S1 自愈准入门（纯函数、零 IO、零浏览器、零 LLM）。
//
// 自愈是裁判（bin/verdict.mjs）的下游消费者：只读裁定、绝不反向进入裁判进程（护栏 #15）。
// fail-safe 不 fail-open：只对**正向确证**的 HARNESS_ERROR 开闸，证不出的一律具名拒（护栏 #13/#14）。
//
// 放行条件（plan S1 逐条 + GRILL D12 v4.1 收窄）：
//   ① 该步 verdict === 'HARNESS_ERROR'
//   ② 该步 atom 在只读漂移探针词表内（单一事实源 = lib/drift-probe.mjs）
//   ③ 该步动作轴 resolution === 'none' ∧ driftProbe.sameSignatureUniquePresent === true
//      ∧ driftProbe.matchedSignature 非空
//   ④ 该步 events 定位是**纯语义定位**（role/accessibleName + targetName），不含 run-history
//      投影面外的字段（fallbackCss/selector/nth/…）——含则血缘不可互证，拒；
//      `semantic` 对象内任何白名单外的嵌套键同样拒（GRILL D13 的 D12 增补）
//   ⑤ 内容级互证：verdict↔axes 全步集与 caseId 精确一致；axes 目标步探针三元组与 events
//      重算一致；run-history 目标步逐字段对账；`semantic.exact` 与删除域消费的 `value`
//      一并纳入互证面（D13 的 D12 增补）
//
// 为什么词表与正向证据必须查在**证据校验层**（plan §3.5 补钉 ⑥）：这两条的真实职责是
// 防伪造三轴——自然流程下词表外原子跑不出正向探针证据（会落 NEEDS_HUMAN 侧），只有被手造/
// 篡改的 axes 才会同时自报「词表外原子 + 正向漂移」。所以判据不能只写在正常分支里。
//
// 本模块零 IO：调用方（bin/heal.mjs）负责读盘/解析/退出码，本模块只吃已解析对象出结论。

import { canonicalSignature } from '../drift-probe.mjs';

// ── 具名拒因（确定性枚举；plan S1 五条 + GRILL D12 血缘条 + D7 干净案条）────────
export const HEAL_REJECT = {
  VERDICT_NOT_HARNESS_ERROR: 'HEAL_VERDICT_NOT_HARNESS_ERROR',
  NO_POSITIVE_DRIFT_EVIDENCE: 'HEAL_NO_POSITIVE_DRIFT_EVIDENCE',
  INPUT_PAIR_MISMATCH: 'HEAL_INPUT_PAIR_MISMATCH',
  VOCABULARY_UNSUPPORTED: 'DRIFT_VOCABULARY_UNSUPPORTED',
  LINEAGE_UNVERIFIABLE: 'HEAL_LINEAGE_UNVERIFIABLE',
  INPUT_INVALID: 'HEAL_INPUT_INVALID',
  NO_HARNESS_ERROR_STEPS: 'NO_HARNESS_ERROR_STEPS',
};

// run-history 投影面（lib/replay/history.mjs::replayHistoryLine）只吐 role + accessibleName。
// 下列定位字段落不进投影，「仅这些字段不同」的混件内容互证分辨不了 → D12 把它们划进拒付面。
const UNPROJECTED_LOCATOR_KEYS = [
  'fallbackCss', 'selector', 'css', 'cssSelector', 'xpath', 'testId', 'nth',
  'coord', 'coords', 'position', 'boundingBox', 'frame', 'iframe', 'shadowPath',
  'dropdownUnit',
];

// `semantic` 对象的可互证键白名单（GRILL D13 的 D12 增补）。
// 依据现役消费面 lib/replay-actions.mjs::semanticLocator（与 lib/compile-atoms-support::locatorFor
// 逐字同形）：只有 kind/role/name/exact 四键参与 role 型定位的构造，其余键回放器根本不读，
// 却能让两份 events 在同一投影下变得不可分辨 —— 白名单外键一律划进拒付面（fail-closed）。
const SEMANTIC_PROJECTABLE_KEYS = ['kind', 'role', 'name', 'exact'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

/**
 * 原子是否在只读漂移探针词表内。
 * 单一事实源纪律：不复刻 lib/drift-probe.mjs 的 ATOM_AFFORDANCE 表，改用它的规范签名函数
 * 做成员判据——词表外原子恒回 null（该函数对未登记原子直接返回 null）。探针库零改。
 */
export function isVocabularyAtom(atom) {
  return nonEmptyStr(atom) && canonicalSignature(atom, '__vocabulary_probe__') !== null;
}

/**
 * 纯语义定位判据（D12 v4.1）：events 该步的定位必须完全由 run-history 可投影面重构。
 * 回 { ok:true, role, accessibleName } 或 { ok:false, detail }。
 */
export function pureSemanticLocator(ev) {
  if (!isObj(ev)) return { ok: false, detail: 'event 非对象' };
  const carried = UNPROJECTED_LOCATOR_KEYS.filter((k) => ev[k] != null);
  if (carried.length) {
    return { ok: false, detail: `定位含 run-history 未投影字段：${carried.join('/')}` };
  }
  const s = isObj(ev.semantic) ? ev.semantic : null;
  let role = null;
  let accessibleName = null;
  if (s) {
    // D13 的 D12 增补：semantic 内的嵌套未投影键与顶层未投影字段同罪 —— 白名单外一律拒。
    const nested = Object.keys(s).filter((k) => !SEMANTIC_PROJECTABLE_KEYS.includes(k));
    if (nested.length) {
      return { ok: false, detail: `semantic 含白名单外嵌套键：${nested.join('/')}` };
    }
    // semantic.kind 只有 'role' 能被投影面完整重构：label/text 两型在投影后丢 kind，
    // 「同名不同型」不可判别 → fail-closed 不猜。
    if (s.kind !== 'role') return { ok: false, detail: `semantic.kind=${JSON.stringify(s.kind)} 非 role，投影面丢型不可重构` };
    if (!nonEmptyStr(s.role) || !nonEmptyStr(s.name)) return { ok: false, detail: 'semantic 缺 role/name' };
    // D13 的 D12 增补：exact 纳入互证面。现役消费面写死 `exact: s.exact !== false`——
    // 缺省与 true 消费语义逐字相同（精确名匹配），故投影出的 accessibleName 字面足以重建定位；
    // 而 exact===false 是子串匹配，run-history 投影里没有任何字段能把它与精确匹配区分开
    // （「仅 exact 不同」的混件不可判别）→ 不可互证，fail-closed 拒。
    if (s.exact === false) {
      return { ok: false, detail: 'semantic.exact===false（子串匹配不可由 run-history 投影面重建）' };
    }
    role = s.role;
    accessibleName = s.name;
  } else if (nonEmptyStr(ev.role) && nonEmptyStr(ev.accessibleName)) {
    role = ev.role;
    accessibleName = ev.accessibleName;
  } else {
    return { ok: false, detail: '既无 semantic(role) 也无 role+accessibleName 语义对' };
  }
  // 冗余定位面：semantic 与顶层 role/accessibleName 并存且互相打架 → 回放器取 semantic、
  // 投影取 semantic，但人读补丁会歧义 → fail-closed 拒。
  if (s && ((nonEmptyStr(ev.role) && ev.role !== role) || (nonEmptyStr(ev.accessibleName) && ev.accessibleName !== accessibleName))) {
    return { ok: false, detail: 'semantic 与顶层 role/accessibleName 冲突' };
  }
  if (!nonEmptyStr(ev.targetName)) {
    return { ok: false, detail: '缺 targetName（规范签名的 withinRow 语境来源）' };
  }
  return { ok: true, role, accessibleName };
}

/** run-history 里属于某步的那一行（JSONL 已解析）。 */
function historyLineOf(historyLines, stepId) {
  if (!Array.isArray(historyLines)) return null;
  return historyLines.find((l) => isObj(l) && l.stepId === stepId) || null;
}

/** 形态自检：四件套结构不合法 → HEAL_INPUT_INVALID（畸形面 fail-closed，调用方落 exit 65）。 */
export function validateShapes({ verdict, axes, events }) {
  if (!isObj(verdict) || !Array.isArray(verdict.steps) || verdict.steps.length === 0) {
    return { ok: false, detail: 'verdict 须为 { caseId, steps:[非空] }' };
  }
  if (!isObj(axes) || !Array.isArray(axes.steps) || axes.steps.length === 0) {
    return { ok: false, detail: 'axes 须为 { caseId, steps:[非空] }' };
  }
  if (!isObj(events) || !Array.isArray(events.events) || events.events.length === 0) {
    return { ok: false, detail: 'events 须为 { caseId, events:[非空] }' };
  }
  for (const s of verdict.steps) if (!isObj(s)) return { ok: false, detail: 'verdict.steps 含非对象步' };
  for (const s of axes.steps) if (!isObj(s)) return { ok: false, detail: 'axes.steps 含非对象步' };
  for (const e of events.events) if (!isObj(e)) return { ok: false, detail: 'events.events 含非对象事件' };
  return { ok: true };
}

/**
 * 案级血缘互证（D12 v4.1）：现役产物无内嵌血缘哈希链（已实测），只能做内容级互证。
 * 回 { ok:true } 或 { ok:false, reason:HEAL_INPUT_PAIR_MISMATCH, detail }。
 */
export function crossCheckCase({ caseId, verdict, axes, events, historyLines }) {
  const bad = (detail) => ({ ok: false, reason: HEAL_REJECT.INPUT_PAIR_MISMATCH, detail });
  // caseId 精确一致：CLI 实参 ↔ verdict ↔ axes ↔ events 四方。
  if (verdict.caseId !== caseId) return bad(`verdict.caseId=${JSON.stringify(verdict.caseId)} 与实参 ${caseId} 不一致`);
  if (axes.caseId !== caseId) return bad(`axes.caseId=${JSON.stringify(axes.caseId)} 与实参 ${caseId} 不一致`);
  if (events.caseId !== caseId) return bad(`events.caseId=${JSON.stringify(events.caseId)} 与实参 ${caseId} 不一致`);
  // verdict↔axes 全步集精确一致（逐位 stepId/intentId/atom 三元）。
  if (verdict.steps.length !== axes.steps.length) {
    return bad(`verdict 步数 ${verdict.steps.length} ≠ axes 步数 ${axes.steps.length}`);
  }
  for (let i = 0; i < axes.steps.length; i++) {
    const v = verdict.steps[i];
    const a = axes.steps[i];
    if (v.stepId !== a.stepId || v.intentId !== a.intentId || v.atom !== a.atom) {
      return bad(`第 ${i} 步 verdict(${v.stepId}/${v.intentId}/${v.atom}) ≠ axes(${a.stepId}/${a.intentId}/${a.atom})`);
    }
  }
  // axes 每一步都须在 events 里找得到同 id 事件（events 可比 axes 步多——多事件折一 intent）。
  const byStep = new Map(events.events.map((e) => [e.stepId, e]));
  for (const a of axes.steps) {
    const e = byStep.get(a.stepId);
    if (!e) return bad(`axes 步 ${a.stepId} 在 events 里无同 id 事件`);
    if (e.intentId !== a.intentId) return bad(`步 ${a.stepId} 的 intentId：axes=${a.intentId} events=${e.intentId}`);
  }
  // run-history 在场时：步序列须与 events 逐位吻合（A/B 混件的廉价探测面）。
  if (Array.isArray(historyLines) && historyLines.length) {
    const hSteps = historyLines.filter(isObj).map((l) => l.stepId);
    const eSteps = events.events.map((e) => e.stepId);
    if (hSteps.length !== eSteps.length || hSteps.some((s, i) => s !== eSteps[i])) {
      return bad(`run-history 步序列 [${hSteps.join(',')}] 与 events [${eSteps.join(',')}] 不吻合`);
    }
  }
  return { ok: true };
}

/**
 * 单步准入判定。verdictStep/axesStep/event 已按 stepId 配好；historyLine 可为 null。
 * 回 { admit:true, canonical, role, accessibleName } 或 { admit:false, reason, detail }。
 */
export function admitStep({ caseId, verdictStep, axesStep, event, historyLine }) {
  const no = (reason, detail) => ({ admit: false, reason, detail });

  // ① 裁定背书：只消费 HARNESS_ERROR（PASS/SUT_DEFECT/NEEDS_HUMAN 一律拒，护栏 #13）。
  if (!isObj(verdictStep) || verdictStep.verdict !== 'HARNESS_ERROR') {
    return no(HEAL_REJECT.VERDICT_NOT_HARNESS_ERROR, `verdict=${JSON.stringify(verdictStep && verdictStep.verdict)}`);
  }
  // ② 词表内原子（GRILL D4 安全策略；证据校验层查，防伪造三轴）。
  const atom = event.atom;
  if (!isVocabularyAtom(atom)) {
    return no(HEAL_REJECT.VOCABULARY_UNSUPPORTED, `原子 ${JSON.stringify(atom)} 不在只读漂移探针词表内`);
  }
  if (axesStep.atom !== atom) {
    return no(HEAL_REJECT.INPUT_PAIR_MISMATCH, `axes.atom=${JSON.stringify(axesStep.atom)} ≠ events.atom=${JSON.stringify(atom)}`);
  }
  // ③ 正向漂移证据三件：录制 locator 未命中 + 同签名唯一元素仍在 + 规范签名非空。
  const action = isObj(axesStep.action) ? axesStep.action : null;
  if (!action || action.resolution !== 'none') {
    return no(HEAL_REJECT.NO_POSITIVE_DRIFT_EVIDENCE, `动作轴 resolution=${JSON.stringify(action && action.resolution)}（须 none 正向 miss 证据）`);
  }
  const probe = isObj(action.driftProbe) ? action.driftProbe : null;
  if (!probe || probe.sameSignatureUniquePresent !== true) {
    return no(HEAL_REJECT.NO_POSITIVE_DRIFT_EVIDENCE, '缺 driftProbe.sameSignatureUniquePresent===true');
  }
  if (!nonEmptyStr(probe.matchedSignature)) {
    return no(HEAL_REJECT.NO_POSITIVE_DRIFT_EVIDENCE, 'driftProbe.matchedSignature 为空（正向证据不完备）');
  }
  // ④ 纯语义定位（D12 收窄面）。
  const loc = pureSemanticLocator(event);
  if (!loc.ok) return no(HEAL_REJECT.LINEAGE_UNVERIFIABLE, loc.detail);
  // 血缘对账要靠 run-history 投影面；件不在场 = 互证做不了 = 不可互证（fail-closed，不猜）。
  if (!isObj(historyLine)) {
    return no(HEAL_REJECT.LINEAGE_UNVERIFIABLE, '缺该步 run-history 投影行，血缘无法逐字段对账');
  }
  // ⑤ 内容级互证：探针三元组与 events 重算一致。
  const canonical = canonicalSignature(atom, event.targetName);
  if (canonical !== probe.matchedSignature) {
    return no(HEAL_REJECT.INPUT_PAIR_MISMATCH, `探针 matchedSignature 与 events 重算规范签名不一致`);
  }
  if (probe.candidateCount != null && probe.candidateCount !== 1) {
    return no(HEAL_REJECT.INPUT_PAIR_MISMATCH, `探针 candidateCount=${probe.candidateCount}（唯一命中须 1）`);
  }
  // 规范签名的 role/name 必须就是 events 的语义定位对——否则补丁会重锚到别的元素。
  if (canonical !== `role=${loc.role}|name=${loc.accessibleName}|withinRow=${event.targetName}`) {
    return no(HEAL_REJECT.INPUT_PAIR_MISMATCH, '规范签名与 events 语义定位对不吻合');
  }
  // D13 的 D12 增补：删除域消费的 `value`（破坏性目标身份，编译面 lib/compile-atoms-workflow-crud
  // 落的 `params.name`）落不进 run-history 投影——click 步的 valueRef 恒 null。唯一能把它拉进
  // 互证面的办法是钉回**已互证**的规范签名 withinRow：value 必须在场且逐字等于 targetName，
  // 否则「仅 value 不同」的混件同样不可判别。当前探针词表整体即删除域（唯一原子
  // workflow.deleteByName，见 lib/drift-probe.mjs），故此条对全部可准入步生效。
  if (event.value !== event.targetName) {
    return no(HEAL_REJECT.LINEAGE_UNVERIFIABLE,
      '删除域消费的 value 与已互证的 targetName 不一致（或缺失），不可由投影面重建');
  }
  // ⑤续：run-history 逐字段对账（D12 的第三道互证）。
  const hp = isObj(historyLine.parameters) ? historyLine.parameters : {};
  const hl = isObj(hp.locator) ? hp.locator : {};
  const facts = [
    ['caseId', historyLine.caseId, caseId],
    ['intentId', historyLine.intentId, event.intentId],
    ['atom', historyLine.atom, atom],
    ['action', historyLine.action, event.action],
    ['locator.role', hl.role, loc.role],
    ['locator.accessibleName', hl.accessibleName, loc.accessibleName],
    ['locatorResolution', historyLine.locatorResolution, action.resolution],
  ];
  for (const [name, got, want] of facts) {
    if (got !== want) {
      return no(HEAL_REJECT.INPUT_PAIR_MISMATCH, `run-history 对账失配：${name} 实得 ${JSON.stringify(got)} 期望 ${JSON.stringify(want)}`);
    }
  }
  return { admit: true, canonical, role: loc.role, accessibleName: loc.accessibleName };
}

/**
 * 案级准入编排（单步处理，D11）。
 *   stepId 显式给 → 只判该步；缺省 → 逐步判、取首个可准入步。
 * 回：
 *   { ok:true, target:{ stepId, intentId, atom, eventIndex, event, axesStep, verdictStep, canonical, ... } }
 *   { ok:false, kind:'malformed', reason:HEAL_INPUT_INVALID, detail }
 *   { ok:false, kind:'usage', detail }                      —— --step 指了不存在的步
 *   { ok:false, kind:'case', reason, detail }               —— 案级互证失配
 *   { ok:false, kind:'steps', reason, rejections:[{stepId,reason,detail}] }
 */
export function admitForProposal({ caseId, verdict, axes, events, historyLines, stepId }) {
  const shape = validateShapes({ verdict, axes, events });
  if (!shape.ok) return { ok: false, kind: 'malformed', reason: HEAL_REJECT.INPUT_INVALID, detail: shape.detail };

  const cross = crossCheckCase({ caseId, verdict, axes, events, historyLines });
  if (!cross.ok) return { ok: false, kind: 'case', reason: cross.reason, detail: cross.detail };

  const eventIndexOf = new Map();
  events.events.forEach((e, i) => { if (!eventIndexOf.has(e.stepId)) eventIndexOf.set(e.stepId, i); });

  const candidates = stepId
    ? axes.steps.filter((a) => a.stepId === stepId)
    : axes.steps;
  if (stepId && candidates.length === 0) {
    return { ok: false, kind: 'usage', detail: `--step ${stepId} 在 axes/verdict 步集内不存在` };
  }

  const rejections = [];
  for (const axesStep of candidates) {
    const verdictStep = verdict.steps.find((v) => v.stepId === axesStep.stepId);
    const idx = eventIndexOf.get(axesStep.stepId);
    const event = events.events[idx];
    const r = admitStep({
      caseId,
      verdictStep,
      axesStep,
      event,
      historyLine: historyLineOf(historyLines, axesStep.stepId),
    });
    if (r.admit) {
      return {
        ok: true,
        target: {
          stepId: axesStep.stepId,
          intentId: axesStep.intentId,
          atom: event.atom,
          eventIndex: idx,
          event,
          axesStep,
          verdictStep,
          canonical: r.canonical,
          role: r.role,
          accessibleName: r.accessibleName,
          targetName: event.targetName,
        },
      };
    }
    rejections.push({ stepId: axesStep.stepId, reason: r.reason, detail: r.detail });
  }

  return { ok: false, kind: 'steps', reason: summarizeReason(verdict, rejections), rejections };
}

/**
 * 逐步全拒时的单值 reason（D7 把 exit 4 切成两种，不得混用）：
 *   干净全 PASS 案 → NO_HARNESS_ERROR_STEPS（唯一字面）；
 *   其余 → 逐步具名拒因清单，reason 取最具体的那条（非「本来就不该自愈」的那条优先）。
 */
function summarizeReason(verdict, rejections) {
  if (verdict.steps.every((s) => s.verdict === 'PASS')) return HEAL_REJECT.NO_HARNESS_ERROR_STEPS;
  const specific = rejections.find((r) => r.reason !== HEAL_REJECT.VERDICT_NOT_HARNESS_ERROR);
  return specific ? specific.reason : HEAL_REJECT.VERDICT_NOT_HARNESS_ERROR;
}
