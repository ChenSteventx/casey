#!/usr/bin/env node
// 语义锁判别·单元导出面攻击金牌（unit discrimination face）。
// 纯 node、zero-SUT：无浏览器、无网络、无 fake/fixture SUT。只读 import lib 的判别纯
// 函数与本仓源码字节，直接在纯函数层发起攻击——不做温拷贝、不建 handle、不碰运行时
// 权威铸造，因此不受 ENTITY_LOCK_RUNTIME_UNAUTHORIZED 硬门影响。
//
// 这是 Steven 2026-07-18「单元导出 + 真机双轨」裁决的 hermetic 轨：证明被硬门挡在
// evaluateEntityAction/createRunSuccessorProof 之外、任何注入都测不到的运行时判别
// 逻辑，其可以纯函数形态导出的判别基元在单元层正确。真机轨（前瞻红基线
// teachin-semantic-lock-runtime-discrimination-successor，0/26 保持红）继续承担裁定
// 分派与有状态 successor 的目标态验收。
//
// 覆盖边界（诚实分工，见文末缺口台账）：本单元面只覆盖能以纯函数导出的判别基元
// （parseCandidate 有效性 / identityKey 身份相等与不等 / compareCandidateFacts 剥壳
// 比较事实 / parseReceipt 外锚逐字段重算）。导出面只暴露无放行语义的比较事实
// （status/reason/candidateCount），allowAction 唯一决定权保留在 runtimeAuthorized
// 硬门之后的 evaluateEntityAction，本导出面绝不产出 allowAction——本金牌显式断言剥壳
// 事实无 allowAction 键（消解硬门旁路）。AMBIGUOUS 原始计数分派、MISSING 空候选分派、
// SCAN_INCOMPLETE 分派、successor 有状态判别 均内联于 evaluate/successor，非纯函数，
// 仍归前瞻红基线所有，本面不冒充覆盖。

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 红先行机制：本命名导出在实现落地前不存在，named import 在链接期即失败 → exit 1。
import { ENTITY_DISCRIMINATION_UNIT_FACE as FACE } from '../../lib/entity-semantic-lock-v2.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const FWD_SHA_FROZEN = '4c707ff196472be21d166450d2252962ceb9b77efe83d10579090a29f6baf29a';
const FACE_NAME = 'ENTITY_DISCRIMINATION_UNIT_FACE';

const { parseCandidate, compareCandidateFacts, identityKey, parseReceipt, parsePolicy } = FACE;

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: 期望 ${JSON.stringify(expected)} 实得 ${JSON.stringify(actual)}`);
  }
}
function assertNull(actual, label) {
  if (actual !== null) throw new Error(`${label}: 期望 null 实得 ${JSON.stringify(actual)}`);
}

// ---- 以真实 parsePolicy 驱动一个 workflow 身份策略（platformId 必比、revision 精确）----
const policy = parsePolicy({ kind: 'workflow', platformId: 'required', parent: 'optional', revision: 'exact' });
check('parsePolicy 合法身份策略 → 冻结返回', () => {
  if (!policy || !Object.isFrozen(policy)) throw new Error(`parsePolicy 未返回冻结策略: ${JSON.stringify(policy)}`);
  assertEq(policy.platformId, 'required', 'policy.platformId');
  assertEq(policy.revision, 'exact', 'policy.revision');
});

function candidate(patch = {}) {
  return {
    physicalId: 'row-1', kind: 'workflow', name: '审批工作流', code: 'wf-001',
    platformId: '90071992547409931234', scopeSha256: '1'.repeat(64),
    parentReceiptHash: null, revisionId: 'rev-7', ...patch,
  };
}
const parse = (patch) => parseCandidate(candidate(patch), policy);

// ===== parseCandidate：候选严格闭合校验（畸形拒、无静默 trim、结构必比）=====
check('parseCandidate 合法候选 → 冻结返回、字段保真', () => {
  const pc = parse();
  if (!pc || !Object.isFrozen(pc)) throw new Error(`合法候选未冻结返回: ${JSON.stringify(pc)}`);
  assertEq(pc.physicalId, 'row-1', 'candidate.physicalId');
  assertEq(pc.revisionId, 'rev-7', 'candidate.revisionId');
  assertEq(pc.platformId, '90071992547409931234', 'candidate.platformId');
});
check('parseCandidate 畸形候选 → null（绝不 MISSING/SAME）', () => {
  assertNull(parseCandidate({ physicalId: 'broken' }, policy), '畸形候选');
});
check('parseCandidate 名前导空格 → null（无静默 trim）', () => {
  assertNull(parse({ name: ' 审批工作流' }), '前导空格候选');
});
check('parseCandidate 缺 platformId（policy required）→ null（platformId 结构必比）', () => {
  assertNull(parse({ platformId: null }), '缺 platformId 候选');
});
check('parseCandidate 缺 revisionId（policy exact）→ null（revisionId 结构必比）', () => {
  assertNull(parse({ revisionId: null }), '缺 revisionId 候选');
});
check('parseCandidate name 取值 getter（accessor）→ null 且不触发 getter、不泄漏内文', () => {
  const acc = candidate();
  let getterCalled = false;
  Object.defineProperty(acc, 'name', {
    enumerable: true, configurable: true,
    get() { getterCalled = true; throw new Error('SECRET_GETTER_TEXT'); },
  });
  let result;
  try { result = parseCandidate(acc, policy); }
  catch (error) { throw new Error(`accessor 候选竟触发/抛出: ${error.message}`); }
  if (getterCalled) throw new Error('closedObject 竟触发了候选 getter');
  assertNull(result, 'accessor 候选');
});
check('parseCandidate 多余键 → null（闭合 schema 不容额外键）', () => {
  assertNull(parse({ extra: 'x' }), '多余键候选');
});
check('parseCandidate 非纯对象（数组）→ null', () => {
  assertNull(parseCandidate(['row-1', 'workflow'], policy), '数组候选');
});

// ===== identityKey：身份元组键（冲突/重复判别基元；不含 physicalId）=====
const keyOf = (patch) => identityKey(parse(patch));
check('identityKey 同 physicalId 异 code → 键不等（同 physicalId 异身份 = 冲突基元）', () => {
  if (keyOf() === keyOf({ code: 'wf-conflict' })) throw new Error('异身份候选竟得同 identityKey');
});
check('identityKey 字节同重复候选 → 键相等（重复身份相等基元；原始计数不折叠归 evaluate 内联）', () => {
  if (keyOf() !== keyOf()) throw new Error('字节同候选竟得异 identityKey');
});
check('identityKey 异 physicalId 同身份字段 → 键相等（identityKey 不含 physicalId）', () => {
  if (keyOf() !== keyOf({ physicalId: 'row-2' })) throw new Error('异 physicalId 竟改变 identityKey');
});

// ===== compareCandidateFacts：剥壳比较事实（SAME/CHANGED + platformId/revisionId 值必比）=====
// 导出面只暴露无放行语义的比较事实（status/reason/candidateCount）。allowAction 唯一
// 决定权保留在 runtimeAuthorized 硬门之后的 evaluateEntityAction，本剥壳事实绝不含
// allowAction 键——「无 allowAction 键」是消解 codex High-1 硬门旁路的承重断言。
const refReceipt = parse();
const compareAgainstRef = (patch) => compareCandidateFacts(refReceipt, parse(patch), policy);
const assertNoAllowAction = (r, label) => {
  if (Object.hasOwn(r, 'allowAction')) throw new Error(`${label}: 剥壳比较事实竟泄漏 allowAction 键 ${JSON.stringify(r)}`);
};
check('compareCandidateFacts 全等 → SAME/reason:null/candidateCount:1 且无 allowAction 键（消硬门旁路）', () => {
  const r = compareAgainstRef();
  assertEq(r.status, 'SAME', 'facts.status');
  assertEq(r.reason, null, 'facts.reason');
  assertEq(r.candidateCount, 1, 'facts.candidateCount');
  assertNoAllowAction(r, 'SAME 剥壳事实');
});
const changed = (patch, reason) => {
  const r = compareAgainstRef(patch);
  assertEq(r.status, 'CHANGED', `facts.status(${reason})`);
  assertEq(r.reason, reason, `facts.reason(${reason})`);
  assertNoAllowAction(r, `CHANGED 剥壳事实(${reason})`);
};
check('compareCandidateFacts kind 错配 → CHANGED/OBJECT_KIND_MISMATCH（无 allowAction 键）', () => changed({ kind: 'agent' }, 'OBJECT_KIND_MISMATCH'));
check('compareCandidateFacts scope 错配 → CHANGED/SCOPE_MISMATCH（无 allowAction 键）', () => changed({ scopeSha256: '2'.repeat(64) }, 'SCOPE_MISMATCH'));
check('compareCandidateFacts parent 错配 → CHANGED/PARENT_IDENTITY_MISMATCH（无 allowAction 键）', () => changed({ parentReceiptHash: 'a'.repeat(64) }, 'PARENT_IDENTITY_MISMATCH'));
check('compareCandidateFacts name 错配 → CHANGED/ENTITY_NAME_MISMATCH（无 allowAction 键）', () => changed({ name: '别的工作流' }, 'ENTITY_NAME_MISMATCH'));
check('compareCandidateFacts code 错配 → CHANGED/ENTITY_CODE_MISMATCH（无 allowAction 键）', () => changed({ code: 'wf-999' }, 'ENTITY_CODE_MISMATCH'));
check('compareCandidateFacts platformId 换代 → CHANGED/PLATFORM_ID_MISMATCH（值必比、无 allowAction 键）', () => changed({ platformId: 'new-generation' }, 'PLATFORM_ID_MISMATCH'));
check('compareCandidateFacts revision 漂移 → CHANGED/ENTITY_REVISION_DRIFT（值必比、无 allowAction 键）', () => changed({ revisionId: 'rev-8' }, 'ENTITY_REVISION_DRIFT'));

// ===== parseReceipt：外部锚语义（自行重算 canonical hash，篡改即拒）=====
// canonical 形状逐字段对齐 lib canonicalReceipt（顺序承重，用于自算正确 hash）。
const canonicalReceipt = (r) => ({
  lockId: r.lockId, kind: r.kind, bindingMode: r.bindingMode, name: r.name, code: r.code,
  platformId: r.platformId, scopeSha256: r.scopeSha256, parentReceiptHash: r.parentReceiptHash,
  revisionId: r.revisionId, provenance: r.provenance,
});
const receiptBody = {
  lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing',
  name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234',
  scopeSha256: '1'.repeat(64), parentReceiptHash: null, revisionId: 'rev-7',
  provenance: { kind: 'user-approval', ref: 'approval-unit-001' },
};
const receiptHash = sha256(JSON.stringify(canonicalReceipt(receiptBody)));
const validReceipt = { ...receiptBody, receiptHash };
// agent 也备一份等价策略：让 kind 篡改能过策略查表与结构预筛，从而把拒绝隔离到 hash 重算
// 不符（否则改 kind 会因缺策略被结构预筛拒、测不到 hash 逐字段覆盖）。
const anchorPolicyByKind = new Map([
  ['workflow', policy],
  ['agent', parsePolicy({ kind: 'agent', platformId: 'required', parent: 'optional', revision: 'exact' })],
]);
check('parseReceipt 合法收据（自算正确 hash）→ 冻结返回、外锚成立', () => {
  const r = parseReceipt(validReceipt, anchorPolicyByKind);
  if (!r) throw new Error(`合法收据被拒: ${JSON.stringify(r)}`);
  assertEq(r.receiptHash, receiptHash, 'receipt.receiptHash');
  assertEq(r.name, '审批工作流', 'receipt.name');
});

// Med-2 外锚逐字段覆盖：对 canonical 每个承重字段各做「改该字段、保留旧 receiptHash → null」，
// 证明 receiptHash 外锚逐字段覆盖 canonical（篡改任一被 hash 覆盖的字段即拒）。各 tamper
// 取「结构合法但值不同」，使拒绝确由 hash 重算不符驱动，隔离出该字段确被 hash 覆盖。
const tamperKeepsOldHash = (label, patch) =>
  check(`parseReceipt 改 ${label} 保留旧 receiptHash → null（外锚逐字段覆盖 canonical.${label}）`, () => {
    assertNull(parseReceipt({ ...validReceipt, ...patch }, anchorPolicyByKind), `篡改 ${label} 收据`);
  });
tamperKeepsOldHash('lockId', { lockId: 'lock-workflow-tamper' });
tamperKeepsOldHash('kind', { kind: 'agent' });
tamperKeepsOldHash('name', { name: '篡改工作流' });
tamperKeepsOldHash('code', { code: 'wf-tamper' });
tamperKeepsOldHash('platformId', { platformId: '90071992547409999999' });
tamperKeepsOldHash('scopeSha256', { scopeSha256: '2'.repeat(64) });
tamperKeepsOldHash('parentReceiptHash', { parentReceiptHash: 'a'.repeat(64) });
tamperKeepsOldHash('revisionId', { revisionId: 'rev-9' });
tamperKeepsOldHash('provenance.ref', { provenance: { kind: 'user-approval', ref: 'approval-unit-tamper' } });
// bindingMode 也在 canonical 内、亦被 hash 覆盖；但它另受「模式↔provenance 种类」不变式
// （existing 需 user-approval / created-in-run 需 platform-readback）双重把守，改 bindingMode
// 会先被该结构不变式拒（早于 hash 重算）。如实标注：本断言证 bindingMode 篡改被拒，其覆盖
// 由结构不变式 + hash 双重承担，非纯 hash 隔离。
check('parseReceipt 改 bindingMode 保留旧 receiptHash → null（结构不变式 + 外锚双重覆盖 canonical.bindingMode）', () => {
  assertNull(parseReceipt({ ...validReceipt, bindingMode: 'created-in-run' }, anchorPolicyByKind), '篡改 bindingMode 收据');
});

check('parseReceipt 篡改 receiptHash 保留 body → null（外锚拒自证 hash）', () => {
  assertNull(parseReceipt({ ...validReceipt, receiptHash: '0'.repeat(64) }, anchorPolicyByKind), '篡改 hash 收据');
});
check('parseReceipt 错 provenance 类型（existing 需 user-approval）→ null', () => {
  const wrongProv = { ...receiptBody, provenance: { kind: 'platform-readback', observationSha256: '1'.repeat(64) } };
  const wrongHash = sha256(JSON.stringify(canonicalReceipt(wrongProv)));
  assertNull(parseReceipt({ ...wrongProv, receiptHash: wrongHash }, anchorPolicyByKind), '错 provenance 收据');
});

// ===== 静态反滥用断言 =====
// Med-1：扩展名全覆盖（.mjs/.js/.cjs，防 .cjs/.js 换扩展名绕过）+ 多引入形态检测。
function listJsSources(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsSources(full));
    else if (/\.(mjs|cjs|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
// 检测导出面被引入的多种形态，非仅裸子串：
//  1) 字面名 includes——覆盖 import 语句、export{} re-export、解构，以及
//     obj['ENTITY_DISCRIMINATION_UNIT_FACE'] 动态属性访问（字面名在源码里都会原样出现）；
//  2) 拆分拼接构造——'ENTITY_'+'DISCRIMINATION_UNIT_FACE' 一类，裸 includes 会漏，故剥去
//     字符串/拼接标点后再查连续字面名兜一层（启发式，非穷尽）。
const stripJoinPunct = (source) => source.replace(/['"`+\s[\],]/g, '');
function referencesUnitFace(source) {
  if (source.includes(FACE_NAME)) return true;
  return stripJoinPunct(source).includes(FACE_NAME);
}
check('反滥用(a) bin/ 与 mcp/ 下零 JS 源引入该导出面（扩展名全覆盖 + 字面/re-export/动态属性/拆分拼接多信号）', () => {
  const offenders = [];
  for (const rel of ['bin', 'mcp']) {
    const dir = fileURLToPath(new URL(`../../${rel}/`, import.meta.url));
    for (const file of listJsSources(dir)) {
      if (referencesUnitFace(readFileSync(file, 'utf8'))) offenders.push(file);
    }
  }
  if (offenders.length) throw new Error(`生产路径竟引入单元导出面: ${offenders.join(', ')}`);
  // 静态边界（如实标注）：纯字符串静态扫描无法穷尽 eval/Function 构造/运行时逐字符拼名等
  // 混淆；上面是扩展名全覆盖 + 多引入形态的静态防线。运行时旁路的最终把守由
  // evaluateEntityAction 的 runtimeAuthorized 硬门承担——且本导出面本就不产 allowAction，
  // 即便被 import 也拿不到放行语义。
});
check('反滥用(b) 前瞻红基线字节 sha256 恒等于冻结值（本契约零触碰证明）', () => {
  const fwd = fileURLToPath(new URL('./teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs', import.meta.url));
  assertEq(sha256(readFileSync(fwd)), FWD_SHA_FROZEN, '前瞻红基线 sha256');
});

// ===== 缺口台账（如实标注、非失败断言；这些裁定分派/状态机归前瞻红基线·真机轨）=====
console.log('---- 覆盖边界台账（非本单元面覆盖，归前瞻红基线 teachin-semantic-lock-runtime-discrimination-successor 真机轨）----');
for (const gap of [
  'AMBIGUOUS：原始 candidateCount>1 不折叠的裁定分派内联于 evaluateEntityAction（用 raw count），非纯函数。',
  'MISSING：空候选 + 完整扫描 count===0 的裁定分派内联于 evaluateEntityAction，非纯函数。',
  'SCAN_INCOMPLETE：!complete 的裁定分派内联于 evaluateEntityAction，非纯函数。',
  'PHYSICAL_ID_CONFLICT：本面证 identityKey 不等基元；deny 裁定分派内联于 evaluateEntityAction。',
  'ENTITY_CANDIDATE_INVALID：本面证 parseCandidate 返回 null；null→UNVERIFIED 映射内联于 evaluateEntityAction。',
  'allowAction 放行语义：导出面刻意剥壳（compareCandidateFacts 只出 status/reason/candidateCount），allowAction 唯一决定权保留在 runtimeAuthorized 硬门之后的 evaluateEntityAction，本面显式断言剥壳事实无 allowAction 键、绝不冒充放行覆盖。',
  'successor 有状态判别（未签迁移/陈旧链头/版本不前进/成功迁移使旧链头失效）依赖 transitionById/activeHeads/runProofs 运行态，非纯函数。',
]) console.log(`GAP  ${gap}`);

if (failures.length) {
  for (const failure of failures) console.error(`RED  unit-discrimination: ${failure}`);
  console.error(`RED  unit-discrimination: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   unit-discrimination: ${passed}/${passed} 全过（纯函数判别基元 hermetic 绿；裁定分派/状态机归前瞻红基线真机轨）`);
