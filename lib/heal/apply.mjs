// lib/heal/apply.mjs —— S4 候选式应用（IO 层，零 LLM、零浏览器、非就地）。
//
// GRILL D5「非就地」：`--apply` 只产**候选 events 旁文件**，原 events 一字不动；候选的精确
// sha256 输出给人签绑定，晋升（S5）才可能换字节。**本模块不存在就地改写路径**。
//
// 三道闸（顺序即安全性顺序）：
//   ① 人签闸——补丁必须过现役纯函数 `lib/drift-patch.mjs::canApply`（status==='signed' ∧
//      humanSignoff 三件齐全 ∧ decision==='apply'）。未签喂进来 = 契约畸形输入，拒
//      `HEAL_PATCH_UNSIGNED`（D7 补钉：exit 65）；已驳回的补丁另具名 `HEAL_PATCH_REJECTED`。
//   ② 底座闸——补丁的 specTarget 必须指向本 case 的 events（`lib/paths.mjs::casePaths` 单一
//      事实源），且底座指纹（recordedAt|length）与签时一致；变了说明签后底座已动，须重生补丁。
//   ③ 锚位闸——目标事件的现役定位必须仍等于补丁的 locatorBefore；对不上说明补丁不是给这份
//      字节的，拒改（fail-closed，绝不「差不多就写」）。
//
// 候选字节纪律（D5「目标步换锚、其余字节保序」）：逐键搬运原文档与原事件，只在目标事件上
// 落 locatorAfter；未涉及的键连同出现次序原样复制，JSON 缩进与末换行沿用现役 events 落盘形。
// 重锚落点照抄已冻 locator 词表（tests/_golden/schemas/drift-patch.schema.json $defs/locator）：
// role/accessibleName 落 semantic 的 role/name，作用域限定落同名 `within` 键（取值形
// `row:has-text("<targetName>")` 与补丁逐字同源），不另造词、不退化 css/coord。
//
// `within` 的定性（GRILL D13 ①，代码评审轮定案）：它是**前向兼容注记**——生产回放
// （lib/replay-actions.mjs::semanticLocator）不读它，S6 复核（lib/heal/reverify.mjs）也一个字
// 不读它。留在候选里只为两件事：① 与人签绑定的那份字节差保持不变；② 等 replay 面后继契约
// 落地行内收窄后可直接生效。**任何消费方都不得据它做「复核比生产强」的绿。**

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canApply } from '../drift-patch.mjs';
import { casePaths } from '../paths.mjs';
import { driftDirOf } from './drift-patch.mjs';

export const APPLY_REJECT = {
  PATCH_UNSIGNED: 'HEAL_PATCH_UNSIGNED',
  PATCH_REJECTED: 'HEAL_PATCH_REJECTED',
  PATCH_INVALID: 'HEAL_PATCH_INVALID',
  SPEC_TARGET_MISMATCH: 'HEAL_SPEC_TARGET_MISMATCH',
  SPEC_BASE_DRIFTED: 'HEAL_SPEC_BASE_DRIFTED',
  EVENTS_MUTATED: 'HEAL_EVENTS_MUTATED',
  REANCHOR_NOOP: 'HEAL_REANCHOR_NOOP',
};

/** 带具名拒因的应用异常；kind 决定调用方落哪个退出码（malformed=65 / noop=4）。 */
export class HealApplyError extends Error {
  constructor(reason, detail, kind = 'malformed') {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
    this.kind = kind;
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

export const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');
export const sha256File = (p) => sha256Of(readFileSync(p));

export const candidatePathOf = (driftDir, caseId, ts) =>
  join(driftDir, `${caseId}.${ts}.events.candidate.json`);

/** events 底座指纹（与 lib/heal/reanchor.mjs 的 fingerprintOf 同形，单一形状不另造）。 */
export function fingerprintOf(eventsDoc) {
  const recordedAt = typeof eventsDoc.recordedAt === 'string' ? eventsDoc.recordedAt : '';
  const length = Array.isArray(eventsDoc.events) ? eventsDoc.events.length : -1;
  return `recordedAt=${recordedAt}|length=${length}`;
}

/** 现役 events 落盘形（两空格缩进 + 末换行），与夹具/生产产物逐字节同形。 */
export const eventsText = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

/** 补丁形态自检：缺任何承重字段一律畸形，绝不「有啥用啥」。 */
function validatePatchShape(patch, caseId) {
  if (!isObj(patch)) throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '补丁不是对象');
  if (patch.caseId !== caseId) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID,
      `补丁 caseId 与实参不一致（原值不回显）`);
  }
  if (patch.patchKind !== 'relocate') {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID,
      `patchKind=${JSON.stringify(patch.patchKind)}（本波只应用 relocate）`);
  }
  if (!nonEmptyStr(patch.stepId)) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '补丁缺 stepId');
  }
  const st = patch.specTarget;
  if (!isObj(st) || !nonEmptyStr(st.eventsPath) || !Number.isInteger(st.eventIndex) || st.eventIndex < 0) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '补丁 specTarget 缺 eventsPath/eventIndex');
  }
  const after = patch.locatorAfter;
  if (!isObj(after) || !nonEmptyStr(after.strategy)) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '补丁缺 locatorAfter.strategy');
  }
  if (after.strategy === 'coord') {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '重锚不得退化为 coord 坐标兜底');
  }
  if (!isObj(patch.locatorBefore)) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, '补丁缺 locatorBefore');
  }
}

/** 人签闸：现役 canApply 是唯一判据，本模块不复刻它的状态机。 */
function requireSignedPatch(patch) {
  if (canApply(patch)) return;
  const decision = isObj(patch.humanSignoff) ? patch.humanSignoff.decision : null;
  if (decision === 'reject') {
    throw new HealApplyError(APPLY_REJECT.PATCH_REJECTED,
      '补丁已被人签驳回（decision=reject），绝不应用');
  }
  throw new HealApplyError(APPLY_REJECT.PATCH_UNSIGNED,
    `补丁未过人签闸（status=${JSON.stringify(patch.status)}，humanSignoff 需 signedAt/signerId/decision=apply 三件齐全）`);
}

/** 现役定位对（供锚位闸比对）：只取 run-history 可投影面，不认未投影字段。 */
function currentLocatorOf(event) {
  const s = isObj(event.semantic) ? event.semantic : null;
  if (s && s.kind === 'role') return { role: s.role ?? null, accessibleName: s.name ?? null };
  if (nonEmptyStr(event.role) && nonEmptyStr(event.accessibleName)) {
    return { role: event.role, accessibleName: event.accessibleName };
  }
  return { role: null, accessibleName: null };
}

/**
 * 把 locatorAfter 落到单个事件上（逐键搬运保序；只动定位面，动作/值/意图一概不碰）。
 * within 为空时删除该键（重锚回无作用域形），非空时就地覆盖或追加在末位。
 */
export function applyLocatorToEvent(event, locatorAfter) {
  const withinValue = nonEmptyStr(locatorAfter.within) ? locatorAfter.within : null;
  const nextRole = nonEmptyStr(locatorAfter.role) ? locatorAfter.role : null;
  const nextName = nonEmptyStr(locatorAfter.accessibleName) ? locatorAfter.accessibleName : null;
  const out = {};
  for (const key of Object.keys(event)) {
    if (key === 'semantic' && isObj(event.semantic) && event.semantic.kind === 'role') {
      const s = {};
      for (const k of Object.keys(event.semantic)) {
        if (k === 'role' && nextRole !== null) s.role = nextRole;
        else if (k === 'name' && nextName !== null) s.name = nextName;
        else s[k] = event.semantic[k];
      }
      out.semantic = s;
      continue;
    }
    if (key === 'role' && nextRole !== null) { out.role = nextRole; continue; }
    if (key === 'accessibleName' && nextName !== null) { out.accessibleName = nextName; continue; }
    if (key === 'within') {
      if (withinValue !== null) out.within = withinValue;
      continue;
    }
    out[key] = event[key];
  }
  if (withinValue !== null && !Object.prototype.hasOwnProperty.call(out, 'within')) {
    out.within = withinValue;
  }
  return out;
}

/** 候选文档：逐键搬运原文档，只替换 events[eventIndex]（其余字节与次序一字不动）。 */
export function buildCandidateDoc(eventsDoc, eventIndex, locatorAfter) {
  const out = {};
  for (const key of Object.keys(eventsDoc)) {
    if (key !== 'events') { out[key] = eventsDoc[key]; continue; }
    out.events = eventsDoc.events.map((ev, i) => (
      i === eventIndex ? applyLocatorToEvent(ev, locatorAfter) : ev
    ));
  }
  return out;
}

/**
 * S4 主入口：校签 → 校底座 → 校锚位 → 产候选旁文件 → 自证原 events 未动。
 *
 * 回 { candidatePath, candidateSha256, eventsPath, eventsSha256, stepId, eventIndex }。
 * 任一闸不过抛 HealApplyError（调用方按 kind 落退出码）。
 */
export function applySignedPatch({ outDir, caseId, patch, tsToken }) {
  validatePatchShape(patch, caseId);
  requireSignedPatch(patch);

  // ② 底座闸：补丁只能改本 case 的 events（路径事实源 = lib/paths.mjs）。
  const eventsPath = resolve(patch.specTarget.eventsPath);
  const canonicalEvents = resolve(casePaths(caseId).events);
  if (eventsPath !== canonicalEvents) {
    throw new HealApplyError(APPLY_REJECT.SPEC_TARGET_MISMATCH,
      '补丁 specTarget.eventsPath 不是本 case 的 events（路径不回显），拒改');
  }
  if (!existsSync(eventsPath)) {
    throw new HealApplyError(APPLY_REJECT.SPEC_TARGET_MISMATCH, 'events 底座不在场');
  }
  const eventsSha256Before = sha256File(eventsPath);
  let eventsDoc;
  try {
    eventsDoc = JSON.parse(readFileSync(eventsPath, 'utf8'));
  } catch {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, 'events 不是合法 JSON（内容不回显）');
  }
  if (!isObj(eventsDoc) || !Array.isArray(eventsDoc.events) || eventsDoc.events.length === 0) {
    throw new HealApplyError(APPLY_REJECT.PATCH_INVALID, 'events 须为 { caseId, events:[非空] }');
  }
  if (nonEmptyStr(patch.specTarget.fingerprintBefore)
    && patch.specTarget.fingerprintBefore !== fingerprintOf(eventsDoc)) {
    throw new HealApplyError(APPLY_REJECT.SPEC_BASE_DRIFTED,
      '签后 events 底座指纹已变（recordedAt/length 不符），须重生补丁');
  }

  // ③ 锚位闸：目标事件必须在原位、且现役定位仍等于 locatorBefore。
  const idx = patch.specTarget.eventIndex;
  const target = eventsDoc.events[idx];
  if (!isObj(target) || target.stepId !== patch.stepId) {
    throw new HealApplyError(APPLY_REJECT.SPEC_TARGET_MISMATCH,
      `events[${idx}] 不是补丁的目标步 ${patch.stepId}`);
  }
  const before = currentLocatorOf(target);
  const wantRole = nonEmptyStr(patch.locatorBefore.role) ? patch.locatorBefore.role : null;
  const wantName = nonEmptyStr(patch.locatorBefore.accessibleName)
    ? patch.locatorBefore.accessibleName : null;
  if ((wantRole !== null && before.role !== wantRole)
    || (wantName !== null && before.accessibleName !== wantName)) {
    throw new HealApplyError(APPLY_REJECT.SPEC_TARGET_MISMATCH,
      '目标步现役定位与补丁 locatorBefore 不符（补丁不是给这份字节的）');
  }

  const candidateDoc = buildCandidateDoc(eventsDoc, idx, patch.locatorAfter);
  const candidateText = eventsText(candidateDoc);
  if (candidateText === eventsText(eventsDoc)) {
    // 与现役字节等价 = 无可自愈之处（D7 归「无一步可自愈」语义，绝不产 no-op 候选）。
    throw new HealApplyError(APPLY_REJECT.REANCHOR_NOOP,
      '重锚后候选与现役 events 字节等价，无可应用的定位漂移', 'noop');
  }

  const driftDir = driftDirOf(outDir);
  mkdirSync(driftDir, { recursive: true });
  const candidatePath = candidatePathOf(driftDir, caseId, tsToken);
  writeFileSync(candidatePath, candidateText, 'utf8');

  // 非就地自证：应用全程原 events 一个字节都不许动（护栏 #5）。
  if (sha256File(eventsPath) !== eventsSha256Before) {
    throw new HealApplyError(APPLY_REJECT.EVENTS_MUTATED,
      '应用过程中原 events 字节发生变化（非就地纪律被破坏），fail-closed');
  }

  return {
    candidatePath,
    candidateSha256: sha256Of(Buffer.from(candidateText, 'utf8')),
    eventsPath,
    eventsSha256: eventsSha256Before,
    stepId: patch.stepId,
    eventIndex: idx,
  };
}
