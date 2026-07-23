#!/usr/bin/env node
// bin/sign.mjs —— 相2 人签门确定性 CLI（零 LLM）。决策 docs/plans/sign/proposed/GRILL.md D1–D6。
//
//   node bin/sign.mjs <caseId> --draft <expected.draft-*.json> --prd <loop/prd-<caseId>.json>
//     --frozen-out <expected.frozen.json> --signer <id> --against-build <buildId>
//     [--signed-at <iso>] [--verdict-baseline <f>] [--resign] [--force] [--archive-dir <d>]
//
// 把 draft（未签草稿）逐条盖 signedAt/signedAgainstBuild/signerId 冻成 expected.frozen（去 pending、
// additionalProperties 合规），sha256 冻进 prd 的 testChecksums[expectedFrozenPath]（仅断言文件，护栏 #5），
// 自守 assertSignedContract ok。裁判零 LLM（不碰 verdict.mjs）；--signer/--build 当可信授权输入。
// fail-closed 纪律（codex R1-F3）：全部读+校验+cred-gate 在任何授权产物写盘之前完成；普通签发走 staged
// rename；含实体锁的多文件发布走 journal 可恢复事务且 PRD 最后落位（不声称多文件 OS 原子）。退出码：
// 0 成功；64 缺参；65 输入坏/闸拒；1 凭据兜底门拦截（护栏 #7）。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, dirname, join, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialGate } from '../lib/cred-gate.mjs';
import { assertSignedContract } from '../lib/sign-gate.mjs';
import { freezeEntityBindingsDraft, hashIdentityAdmissionBytes } from '../lib/entity-semantic-lock-preflight.mjs';
import { ENTITY_OBSERVATION_REGISTRY, validateObservationAdmission } from '../lib/entity-observation-registry.mjs';
import { publishSignPublication } from '../lib/sign-publication.mjs';
import { parseSignArgs } from '../lib/sign-cli-args.mjs';
import {
  checkProjectOutputBoundary,
  readPhysicalFileBytes,
  readProjectArtifactBytes,
  verifyProjectArtifactIdentity,
} from '../lib/project-artifact-boundary.mjs';

// 旧静态接缝名保留为兼容别名；实现语义由 successor 的 draft exact-join 冻结器提供。
const freezeEntityLocks = freezeEntityBindingsDraft;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const VERDICT_STATES = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const VERDICT_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);
const FROZEN_ASSERT_KEYS = new Set(['kind', 'op', 'value', 'soft', 'signedAt', 'signedAgainstBuild', 'signerId']);
const SAFE_ID = /^[A-Za-z0-9._@-]+$/; // 授权输入（signer/build）只许简单 id，防注入进归档名/断言值（codex R1-F2）

function die(code, msg) { console.error('sign: ' + msg); process.exit(code); }
// 读失败消毒（output-seal B1）：V8 的 JSON.parse 报错自带出错处内容片段（login-bootstrap 实测），
// 原样上抛会把 draft/prd/verdict-baseline 人编文件内容漏进 stderr——只报「不是合法 JSON/不可读」，内容不回显。
// SAFE_ID（:25，signer/build 复用）在 A11 键名遮值处也用。
function readJson(f, label) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { die(65, `读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); } }
const digest = (value) => createHash('sha256').update(value).digest('hex');
// 两阶段落盘（codex R1-F3 + R2-F1）：普通路径先写全部 .tmp 再 staged rename；实体锁路径另用 journal
// 把逐文件 rename 变成可恢复发布事务。两者都不声称多文件 OS 原子。
function commitWrites(writes, dirsToMk = [], transaction = null) {
  const targets = writes.map(([p]) => resolve(p));
  const tmps = targets.map((t) => t + '.tmp');
  const dirs = dirsToMk.map((d) => resolve(d));
  // 预检（codex R3-F1 + R4 + R5）：target 两两互异 + tmp 两两互异 + target∩tmp=∅（防某目标恰为另一目标的
  // .tmp 派生致覆盖/删除）+ 无既存 tmp（文件或目录，防预植 tmp 致写中失败副作用）+ dirsToMk 与 target∪tmp
  // 不相交 + 无 target 是既存目录——消除全部可构造的半提交/破坏/目录副作用，任何 mkdir/写盘之前拦截 exit 65。
  if (new Set(targets).size !== targets.length) die(65, '输出路径碰撞（archive/frozen/pending/prd 须两两互异），拒');
  if (new Set(tmps).size !== tmps.length) die(65, 'tmp 路径碰撞，拒');
  const tset = new Set(tmps);
  if (targets.some((t) => tset.has(t))) die(65, '某输出目标恰为另一输出的 .tmp 派生路径（会致覆盖/删除），拒（codex R4-F1）');
  if (!transaction) for (const t of tmps) if (existsSync(t)) die(65, `tmp 路径已存在，拒（防预植 tmp 致写中失败留副作用，codex R5）：${t}`);
  let transactionPaths = [];
  if (transaction) {
    const journalPath = resolve(transaction.journalPath);
    const journalTmp = `${journalPath}.tmp`;
    transactionPaths = [journalPath, journalTmp];
    const occupied = new Set([...targets, ...tmps]);
    if (transactionPaths.some((p) => occupied.has(p)) || journalPath === journalTmp) {
      die(65, 'sign publication journal 与输出/临时路径碰撞，拒');
    }
  }
  // dirsToMk 不得等于或落在任一 target/tmp 之下（codex R6-F1）：否则 mkdir -p 会把该 tmp/文件路径建成目录。
  // 允许反向（归档文件合法地在 archiveDir 之下），故只查 d===p 或 d 在 p 之下、不查 p 在 d 之下。
  for (const d of dirs) for (const p of [...targets, ...tmps, ...transactionPaths]) if (d === p || d.startsWith(p + '/')) die(65, `archive-dir 等于或落在某输出/tmp/journal 路径之下，拒（codex R6）：${d} ~ ${p}`);
  for (const p of targets) { if (existsSync(p)) { let st; try { st = statSync(p); } catch { st = null; } if (st && st.isDirectory()) die(65, `输出目标是既存目录，拒（防 rename 半提交）：${p}`); } }
  // 预检通过才建目录（codex R4-F2/R5/R6：零落盘含目录副作用）；收集本次真新建的全部祖先（浅→深），写中失败逆序全量回滚。
  const createdDirs = [];
  for (const d of dirs) {
    const chain = [];
    for (let cur = d; cur && !existsSync(cur); cur = dirname(cur)) { chain.push(cur); if (dirname(cur) === cur) break; }
    for (const anc of chain.reverse()) if (!createdDirs.includes(anc)) createdDirs.push(anc);
    mkdirSync(d, { recursive: true });
  }

  if (transaction) {
    const result = publishSignPublication({
      writes: writes.map(([path, text]) => ({ path, text })),
      journalPath: transaction.journalPath,
      signedAt: transaction.signedAt,
      authorityPath: transaction.authorityPath,
      ...(transaction.beforeAuthorityCommit ? { beforeAuthorityCommit: transaction.beforeAuthorityCommit } : {}),
      ...(transaction.readExisting ? { readExisting: transaction.readExisting } : {}),
    });
    if (result?.ok !== true) {
      die(result?.retryable ? 74 : 65, `sign publication 未完成（${result?.reason || 'UNKNOWN'}）${result?.retryable ? '；journal 保留时可用相同输入重试' : ''}`);
    }
    return;
  }
  // 阶段1：wx 独占写 tmp（既存即 EEXIST 绝不覆盖真实文件）；任一失败清孤儿 tmp + 回滚本次新建目录（本轮 tmp 已清、
  // 目录只含本轮内容故可安全移除）+ fail-closed，真实文件与目录零副作用。
  const written = [];
  try { for (let i = 0; i < writes.length; i++) { writeFileSync(tmps[i], writes[i][1], { encoding: 'utf8', flag: 'wx' }); written.push(i); } }
  catch (e) {
    for (const i of written) { try { rmSync(tmps[i], { force: true }); } catch { /* 尽力 */ } }
    // 逆序（深→浅）回滚本次新建的全部祖先目录——tmp 已清、这些目录只含本轮内容，安全移除（codex R6-F2）。
    for (const d of [...createdDirs].reverse()) { try { rmSync(d, { recursive: true, force: true }); } catch { /* 尽力 */ } }
    die(74, `落盘 I/O 失败，清孤儿+回滚新建目录零落盘（fail-closed）：${String((e && e.message) || e).slice(0, 200)}`);
  }
  // 阶段2：统一 rename（预检后仅残余真 I/O 崩溃/掉电窗口，hermetic 强制不了；中途失败清剩余 tmp）。
  for (let i = 0; i < written.length; i++) {
    try { renameSync(tmps[i], targets[i]); }
    catch (e) { for (let j = i + 1; j < written.length; j++) { try { rmSync(tmps[j], { force: true }); } catch { /* 尽力 */ } } die(74, `落盘 rename 失败（已预检去重/非目录，残余 I/O 窗口）：${String((e && e.message) || e).slice(0, 200)}`); }
  }
}

const args = parseSignArgs(process.argv.slice(2));
const caseId = args.pos[0];
if (args.invalidFlags.length || args.duplicateFlags.length || args.pos.length !== 1) {
  die(64, '参数面未闭合（未知/重复旗标或多余位置参数）；请按 casey help 的 sign 真接口重试');
}
if (!caseId || !args.draft || !args.prd || !args['frozen-out'] || !args.signer || !args['against-build']) {
  die(64, '用法: casey sign <caseId> --draft <f> --prd <f> --frozen-out <f> --signer <id> --against-build <id> [--events <f> --entity-bindings-draft <f> --entity-confirmations <f> --entity-locks-out <f> --audience <test|production> [--entity-observations <f>]] [--signed-at <iso>] [--verdict-baseline <f>] [--resign] [--force] [--archive-dir <d>]');
}
// caseId / 授权输入 / 产物路径安全（codex R1-F2；caseId 同 draft.mjs:40）。
// 报错不回显原值——CLI 参数在凭据门扫描面外（ingest 契约 codex R2-F2 同族封缝，镜像 bin/ingest.mjs:29）。
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) die(65, 'caseId 含非法字符（仅限字母数字_-；原值不回显）');
const signer = String(args.signer);
const build = String(args['against-build']);
if (!SAFE_ID.test(signer)) die(65, 'signer 含非法字符（仅限 [A-Za-z0-9._@-]；原值不回显）');
if (!SAFE_ID.test(build)) die(65, 'against-build 含非法字符（仅限 [A-Za-z0-9._@-]；原值不回显）');
const frozenOut = String(args['frozen-out']);
const frozenBase = basename(frozenOut);
// frozen-out 只许 .json 断言旁车形态，拒 events-/spec- 形态（testChecksums 只冻断言文件，护栏 #5 + codex R1-F2）。
if (!frozenBase.endsWith('.json') || /^(events|spec)[-.]/.test(frozenBase)) die(65, `frozen-out 须为 .json 断言旁车、非 events/spec 形态：${frozenBase}`);
const entityLockArgs = ['events', 'entity-bindings-draft', 'entity-confirmations', 'entity-locks-out'];
const entityLockArgCount = entityLockArgs.filter((key) => typeof args[key] === 'string' && args[key]).length;
if (entityLockArgCount !== 0 && entityLockArgCount !== entityLockArgs.length) {
  die(64, '--events / --entity-bindings-draft / --entity-confirmations / --entity-locks-out 必须成组提供');
}
const entityLocksOut = entityLockArgCount ? String(args['entity-locks-out']) : null;
// 准入受众（ADR-0010）：产实体锁时必填，枚举 test|production，签进冻结件自哈希。真机生产签发用 production、
// 测试夹具用 test；读侧凭据上下文门据此拒「测试锁改真 SUT」。缺/非法一律 fail-closed。
const entityAudience = entityLocksOut ? String(args.audience || '') : null;
if (entityLocksOut && entityAudience !== 'test' && entityAudience !== 'production') {
  die(65, '产实体锁须 --audience test|production（ADR-0010 准入受众，缺/非法拒；原值不回显）');
}
let entityLocksProjectKey = null;
let publicationJournal = null;
let recoveryJournal = null;
if (entityLocksOut) {
  if (basename(entityLocksOut) !== 'entity-locks.frozen.json') die(65, 'entity-locks-out 文件名须为 entity-locks.frozen.json');
  const rel = relative(ROOT, resolve(entityLocksOut));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) die(65, 'entity-locks-out 必须位于 Casey 项目内，供固定 PRD checksum authority 读取');
  entityLocksProjectKey = rel.split(sep).join('/');
  const outputBoundary = checkProjectOutputBoundary({ projectRoot: ROOT, targetPath: entityLocksOut });
  if (!outputBoundary.ok) die(65, `entity-locks-out 物理项目边界未过（${outputBoundary.reason}），拒绝 symlink/reparse 路径`);
  publicationJournal = `${resolve(entityLocksOut)}.publish.json`;
  if (existsSync(publicationJournal)) {
    recoveryJournal = readJson(publicationJournal, 'sign publication journal');
    const keys = recoveryJournal && typeof recoveryJournal === 'object' && !Array.isArray(recoveryJournal)
      ? Object.keys(recoveryJournal).sort() : [];
    const journalShapeOk = JSON.stringify(keys) === JSON.stringify(['artifactKind', 'authorityTargetHash', 'entries', 'schemaVersion', 'signedAt'])
      && recoveryJournal.schemaVersion === 1
      && recoveryJournal.artifactKind === 'casey-sign-publication'
      && typeof recoveryJournal.signedAt === 'string' && recoveryJournal.signedAt.length > 0
      && /^[0-9a-f]{64}$/.test(recoveryJournal.authorityTargetHash)
      && Array.isArray(recoveryJournal.entries) && recoveryJournal.entries.length > 0
      && recoveryJournal.entries.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
        && JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(['contentHash', 'targetHash'])
        && /^[0-9a-f]{64}$/.test(entry.contentHash) && /^[0-9a-f]{64}$/.test(entry.targetHash));
    if (!journalShapeOk) die(65, 'sign publication journal 结构非法，拒绝猜测恢复');
    if (args['signed-at'] && String(args['signed-at']) !== recoveryJournal.signedAt) {
      die(65, '--signed-at 与未完成 publication journal 不一致；须使用原输入恢复');
    }
  }
  if (existsSync(entityLocksOut) && !recoveryJournal) die(65, 'entity-locks.frozen.json 已存在；身份锁重签须另走显式撤销/归档流程');
}

// ── 全部读 + 严校（任何写盘之前，codex R1-F3）──
const draft = readJson(String(args.draft), 'draft');
// draft schema 严校（codex R1-F4）：坏结构绝不静默降级为空契约。
if (!draft || typeof draft !== 'object' || Array.isArray(draft)) die(65, 'draft 非对象');
if (draft.caseId !== caseId) die(65, `caseId 不一致（命令行 ${caseId}；draft 侧值不符或缺，原值不回显——output-seal A4），拒签`);
if (!Array.isArray(draft.intents)) die(65, 'draft.intents 须为数组（坏 draft 拒签，不静默签成空）');
for (const it of draft.intents) {
  if (!it || typeof it !== 'object' || typeof it.intentId !== 'string' || !Array.isArray(it.expected)) die(65, 'draft.intents[] 须 {intentId, expected:[]}（坏结构拒签）');
}
if (draft.globalAssertions !== undefined && !Array.isArray(draft.globalAssertions)) die(65, 'draft.globalAssertions 须为数组');
if (draft.pending !== undefined && !Array.isArray(draft.pending)) die(65, 'draft.pending 存在须为数组（坏 pending 拒签，别丢 route:human 信号）');

// 冻结期易变字面量 lint（plan-debt-sweep，design §2.1 铁律的冻结面兑现）：草拟闸 validateDraft 已盖，
// 但手编草稿/重签路径可绕过草拟闸——sign 是冻结落盘唯一口，同款两正则再守一遍（正则与
// lib/assertion-draft.mjs:126-127 逐字同款；抽公共件另案）。盖全部断言字符串值、不分 op。
// output-seal A1/A2（codex R1-F2 提硬）：lint 命中只报「什么不对 + 结构性索引定位」——绝不回显断言值全文，
// 也不回显 intentId（文件侧字符串，SAFE_ID 挡不住字母数字种子）；定位用 draft 数组下标（结构位置泄不了）。
const lintTargets = [];
draft.intents.forEach((it, ii) => (it.expected || []).forEach((a, ai) => lintTargets.push([`intents[${ii}].expected[${ai}]`, a])));
(draft.globalAssertions || []).forEach((a, ai) => lintTargets.push([`globalAssertions[${ai}]`, a]));
for (const [loc, a] of lintTargets) {
  if (!a || typeof a.value !== 'string') continue;
  if (/atl_(?!\{\{uniqueName\}\})/.test(a.value)) die(65, `冻结期字面量 lint（${loc}）：值含未模板化 atl_ 字面量（须 atl_{{uniqueName}} 形态；原值不回显）`);
  if (/\d{9,}/.test(a.value)) die(65, `冻结期字面量 lint（${loc}）：值含 9+ 位数字长串（时间戳/实体 ID 字面量禁冻；原值不回显）`);
}

const prdPath = String(args.prd);
if (entityLocksOut && resolve(prdPath) !== resolve(ROOT, 'loop', `prd-${caseId}.json`)) {
  die(65, '身份锁签发须写规范 loop/prd-<caseId>.json，供 replay 铸造 opaque authority');
}
const prd = readJson(prdPath, 'prd');
if (!prd || typeof prd !== 'object' || Array.isArray(prd)) die(65, 'prd 非对象');
// caseId 端到端绑定（codex R1-F1）：prd.caseId 必与命令行一致，防把 A 的签名塞进 B 的 prd。
if (prd.caseId !== caseId) die(65, `prd.caseId 不一致（命令行 ${caseId}；prd 侧值不符或缺，原值不回显——output-seal A5），拒签`);
// 首次发布前不得已有同路径 checksum：否则 locks 在 PRD 最后提交前可能被旧 checksum 提前铸成 authority。
// 只有 journal 证明这是本次未完成发布的恢复，才允许 PRD 已处于新/旧任一阶段，并由 exact journal 收口。
if (entityLocksProjectKey && !recoveryJournal
  && Object.prototype.hasOwnProperty.call(prd.testChecksums || {}, entityLocksProjectKey)) {
  die(65, 'PRD 已含 entity-locks checksum 但无 publication journal；拒绝猜测残留状态，须人工审计');
}
let entityEventsBytes = null;
let entityEventsDocument = null;
let entityBindingsDraft = null;
let entityConfirmations = null;
if (entityLocksOut) {
  try { entityEventsBytes = readFileSync(String(args.events)); } catch { die(65, '读 events 原始字节失败（内容不回显）'); }
  entityEventsDocument = readJson(String(args.events), 'events');
  entityBindingsDraft = readJson(String(args['entity-bindings-draft']), 'entity-bindings-draft');
  entityConfirmations = readJson(String(args['entity-confirmations']), 'entity-confirmations');
  if (entityEventsDocument?.caseId !== caseId || entityBindingsDraft?.caseId !== caseId
    || entityConfirmations?.caseId !== caseId || !Array.isArray(entityConfirmations?.confirmations)) {
    die(65, 'events / entity-bindings-draft / entity-confirmations 与 caseId 或闭合结构不一致');
  }
}

// ── 身份观察对账（agent-id-readback plan §4；v1/v2 只按 draft schemaVersion 判别）────────────────
// v2 强制观察件、三错配（build/digest/eventsSha）任一拒签；v1 路径逐字不变。
// C0 接线（codex R1 Critical——「验证器未接线=假绿」修复）：观察准入语义——issuer 精确双锚 /
// 观察行 kind 绑定 / 五元关联 / 角色多重集恰等 / bindingMode→provenance 注册表不变量——全权委托闭集验证器
// validateObservationAdmission（lib/entity-observation-registry.mjs 唯一事实源，同金牌所验纯函数）；本块只保留
// 【非验证器职责】的三面：v2 信封形状 + 四哈希闭环 + 终端 click 锚存在性；及冻结三元组投影字段在场。
// 删去原漂移弱内联检查（kind===boundKind、issuer atom 集合 membership、五元 join 手写、基数手数）——
// 收敛为单一验证器裁定，令金牌对纯函数的健全性证明真实传导到生产 sign 路径。
let identityObservationRows = null;
{
  const observationsPath = typeof args['entity-observations'] === 'string' ? String(args['entity-observations']) : null;
  const draftIsV2 = entityLocksOut != null && entityBindingsDraft?.schemaVersion === 2;
  if (observationsPath && !entityLocksOut) die(64, '--entity-observations 仅随实体锁成组旗标使用');
  if (observationsPath && !draftIsV2) die(65, 'v1 实体绑定草稿不接受 --entity-observations（v1/v2 只按 schemaVersion 判别）');
  if (draftIsV2) {
    if (!observationsPath) die(65, 'v2 实体绑定草稿必须携身份观察件（--entity-observations，缺=拒签）');
    let obsBytes = null;
    try { obsBytes = readFileSync(observationsPath); } catch { die(65, '读身份观察件原始字节失败（内容不回显）'); }
    const obs = readJson(observationsPath, '身份观察件');
    // 义务原子集 = events 里【已登记身份原子】的终端 click（∩注册表；codex R1-H5：从 events 独立推导，
    // 绝不由观察件自报 source.atom 驱动）。仅用于 v2 专属的「终端锚存在性」守卫。
    const identityObservationAtoms = new Set(
      (entityEventsDocument.events || [])
        .filter((ev) => ev && ev.action === 'click' && ENTITY_OBSERVATION_REGISTRY.has(ev.atom))
        .map((ev) => ev.atom),
    );
    // v2 信封形状 + 四哈希闭环（件级 digest 闭环非验证器职责）。source.atom 是否落在允许 issuer 由验证器
    // 精确双锚裁定——此处不再以集合 membership 弱判（收敛到单一事实源，codex R1）。
    const obsShapeOk = obs && typeof obs === 'object' && !Array.isArray(obs)
      && obs.schemaVersion === 1 && obs.artifactKind === 'compile-identity-observation' && obs.caseId === caseId
      && obs.source && typeof obs.source === 'object' && !Array.isArray(obs.source)
      && obs.source.kind === 'compile-envelope'
      && obs.source.signed === false && obs.source.replayReady === false
      && Array.isArray(obs.observations) && obs.observations.length > 0;
    if (!obsShapeOk) die(65, '身份观察件闭合形状不符（compile-identity-observation schema v1）');
    if (obs.capturedAgainstBuild !== build) die(65, '身份观察件 capturedAgainstBuild 与 --against-build 不符（错配拒签）');
    if (obs.identityProfileDigest !== entityBindingsDraft.identityProfileDigest) die(65, '身份观察件 identityProfileDigest 与 v2 草稿不符（错配拒签）');
    if (obs.eventsSha256 !== hashIdentityAdmissionBytes(entityEventsBytes)) die(65, '身份观察件 eventsSha256 与签署 events 原始字节不符（陈旧/错配拒签）');
    if (entityBindingsDraft.identityObservationsSha256 !== hashIdentityAdmissionBytes(obsBytes)) {
      die(65, 'v2 草稿 identityObservationsSha256 与观察件原始字节不符（换件拒签）');
    }
    // v2 专属：终端 click 锚点必须存在（验证器对「无观察义务」返回 ok，故 v2「必携观察」在此另守）。
    const terminalStepIds = new Set();
    for (const ev of entityEventsDocument.events || []) {
      if (ev && identityObservationAtoms.has(ev.atom) && ev.action === 'click') terminalStepIds.add(ev.stepId);
    }
    if (terminalStepIds.size === 0) die(65, 'v2 签署缺终端 click 事件（观察无锚点，拒签）');
    // 冻结三元组投影字段在场（name/code/platformId/sourcePath 是冻结锁投影字段、非验证器职责）。
    for (const row of obs.observations) {
      const fieldsOk = row && typeof row === 'object' && !Array.isArray(row)
        && ['kind', 'name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId', 'sourcePath']
          .every((f) => typeof row[f] === 'string' && row[f].trim() !== '');
      if (!fieldsOk) die(65, '身份观察行缺必填字段（冻结三元组投影字段须在场，拒签）');
    }
    // ── 观察准入闭集裁定（codex R1 Critical 接线：验证器接进生产 sign 路径）──────────────────
    // bindingMode/provenance 是绑定属性、活在确认收据里（观察件本身不带）——按五元组 join 确认取，
    // 富化进观察行后传验证器，供其强制注册表 provenanceByBindingMode 不变量（收据自洽的 successor 等
    // 越注册表允许集的 mode 由此拒）。events/bindings 传原件，validateObservationAdmission 出唯一裁定。
    const provenanceByTuple = new Map();
    for (const c of entityConfirmations.confirmations) {
      if (!c || typeof c !== 'object' || Array.isArray(c) || !c.receipt || typeof c.receipt !== 'object') continue;
      provenanceByTuple.set(
        JSON.stringify([c.stepId, c.sourceIntentId, c.candidateId, c.role, c.atom]),
        { bindingMode: c.receipt.bindingMode, provenance: c.receipt.source },
      );
    }
    const admission = validateObservationAdmission({
      events: entityEventsDocument.events || [],
      observation: {
        source: obs.source,
        observations: obs.observations.map((row) => {
          const prov = provenanceByTuple.get(
            JSON.stringify([row.evidenceStepId, row.sourceIntentId, row.candidateId, row.role, row.atom]),
          ) || {};
          return { ...row, bindingMode: prov.bindingMode, provenance: prov.provenance };
        }),
      },
      bindings: Array.isArray(entityBindingsDraft.bindings) ? entityBindingsDraft.bindings : [],
    });
    if (!admission.ok) die(65, `身份观察准入闭集拒（${admission.rejectCode}）`);
    identityObservationRows = obs.observations.map((row) => ({
      name: row.name, code: row.code, platformId: row.platformId,
      sourceIntentId: row.sourceIntentId, candidateId: row.candidateId, role: row.role,
      atom: row.atom, evidenceStepId: row.evidenceStepId,
    }));
  }
}

// pending 处置（D2）：非空默认拒签，--force 放行 + 留痕独立旁车（别静默丢）。
const pending = draft.pending || [];
if (pending.length && !args.force) {
  die(65, `draft 含 ${pending.length} 条 pending（未映射意图 route:human）——默认拒签（护栏：别对未闭合契约背书）；确要签用 --force 留痕`);
}

// 期望裁定基线（D3）：仅 --verdict-baseline 人给值，强制 fail-safe 不变量；缺则不写、绝不反推。
let verdictBaseline = null;
if (args['verdict-baseline']) {
  verdictBaseline = readJson(String(args['verdict-baseline']), 'verdict-baseline');
  if (!verdictBaseline || typeof verdictBaseline !== 'object' || Array.isArray(verdictBaseline)) die(65, 'verdict-baseline 须为 intentId→{verdict,reason} 映射对象');
  // output-seal A11（codex R2-F5 提硬）：键名是人编文件任意字符串——SAFE_ID 挡不住字母数字种子（同 F2 论据），
  // 定位改结构性 entries 下标（结构位置泄不了），绝不回显键名原值。
  Object.entries(verdictBaseline).forEach(([, adj], i) => {
    const loc = `verdict-baseline entries[${i}]`;
    if (!adj || typeof adj !== 'object' || !VERDICT_STATES.has(adj.verdict)) die(65, `${loc}.verdict 非法四态`);
    if (adj.verdict === 'NEEDS_HUMAN') { if (!VERDICT_REASONS.has(adj.reason)) die(65, `${loc} NEEDS_HUMAN 须带 reason 子类（fail-safe 不变量）`); }
    else if (adj.reason != null) die(65, `${loc} 终判 ${adj.verdict} 的 reason 须为 null（fail-safe 不变量）`);
  });
}

// 盖签署字段（D1）：逐条 intents[].expected[] 与 globalAssertions[]，去 draft-only 的 pending。
const signedAt = args['signed-at'] ? String(args['signed-at']) : (recoveryJournal?.signedAt || new Date().toISOString());
const stamp = (a) => ({ ...a, signedAt, signedAgainstBuild: build, signerId: signer });
const frozen = { caseId };
if (draft.channel !== undefined) frozen.channel = draft.channel;
frozen.intents = draft.intents.map((it) => {
  const out = { intentId: it.intentId, ...(it.intent !== undefined ? { intent: it.intent } : {}), expected: it.expected.map(stamp) };
  if (verdictBaseline && Object.prototype.hasOwnProperty.call(verdictBaseline, it.intentId)) {
    const adj = verdictBaseline[it.intentId];
    out.expectedVerdict = TERMINAL.has(adj.verdict) ? { verdict: adj.verdict, reason: null } : { verdict: adj.verdict, reason: adj.reason };
  }
  return out;
});
if (draft.globalAssertions !== undefined) frozen.globalAssertions = draft.globalAssertions.map(stamp);
let frozenEntityLocks = null;
if (entityLocksOut) {
  const frozenResult = freezeEntityLocks({
    caseId,
    eventsBytes: entityEventsBytes,
    eventsDocument: entityEventsDocument,
    draft: entityBindingsDraft,
    confirmations: entityConfirmations.confirmations,
    signerId: signer,
    signedAt,
    audience: entityAudience,
    ...(identityObservationRows ? { identityObservations: identityObservationRows } : {}),
  });
  if (frozenResult?.ok !== true || frozenResult.artifact?.replayReady !== true) {
    die(65, `entity locks 冻结失败（${frozenResult?.reason || 'UNKNOWN'}）`);
  }
  frozenEntityLocks = frozenResult.artifact;
}

// 自守 1：白名单键（additionalProperties 合规，D5 + 冻结 schema）——intents 与 globalAssertions 同口径（codex R2-F3）。
for (const it of frozen.intents) for (const a of it.expected) for (const k of Object.keys(a)) if (!FROZEN_ASSERT_KEYS.has(k)) die(65, `断言含越界键（frozen additionalProperties 合规；键名原值不回显——output-seal A17）`);
for (const a of (frozen.globalAssertions || [])) for (const k of Object.keys(a)) if (!FROZEN_ASSERT_KEYS.has(k)) die(65, `全局断言含越界键（frozen additionalProperties 合规；键名原值不回显——output-seal A17）`);
// 自守 2：读侧门 assertSignedContract 必 ok（签发端与校验端同口径）。
const sc = assertSignedContract(frozen);
if (!sc.ok) die(65, `frozen 自守未过 assertSignedContract：${sc.problems.slice(0, 3).join('；')}`);

// 重签 / anti-clobber（D4）：frozen 已存在——无 --resign 拒覆写；有 --resign 备好归档（写盘留到最后）。
const archiveDir = args['archive-dir'] ? String(args['archive-dir']) : join(dirname(frozenOut), 'archive');
let archivePlan = null;
function archivePlanFromFrozenText(rawText) {
  let old;
  try { old = JSON.parse(rawText); } catch { return null; }
  const oldText = JSON.stringify(old, null, 2) + '\n';
  const rawBuild = old?.intents?.[0]?.expected?.[0]?.signedAgainstBuild || 'unknown';
  const safeBuild = String(rawBuild).replace(/[^A-Za-z0-9._-]/g, '_'); // 归档名去穿越（codex R1-F2：旧 build 可能含 /..）
  // 用旧 frozen 内容 hash 做唯一后缀（codex R2-F4）：不同旧内容 → 不同归档名（防稳定碰撞覆盖毁审计）；
  // 同内容重归档 → 同名（幂等无损）。取代易碰撞的 signed-at 数字串。
  const oldHash = createHash('sha256').update(oldText).digest('hex').slice(0, 12);
  return { path: join(archiveDir, `expected.frozen.${caseId}.${safeBuild}.${oldHash}.json`), text: oldText };
}
const journalNeedsArchive = recoveryJournal
  ? recoveryJournal.entries[0].targetHash !== digest(resolve(frozenOut))
  : false;
if (!recoveryJournal && existsSync(frozenOut)) {
  if (!args.resign) die(65, `frozen 已存在（${frozenOut}）——重签须显式 --resign（anti-clobber 防误覆写）`);
  archivePlan = archivePlanFromFrozenText(readFileSync(frozenOut, 'utf8'));
  if (!archivePlan) die(65, '旧 frozen 非法，拒绝生成重签 archive');
} else if (recoveryJournal) {
  if (journalNeedsArchive !== Boolean(args.resign)) {
    die(65, 'publication journal 的 archive 目标集合与本次 --resign 不一致，拒绝恢复');
  }
  if (journalNeedsArchive) {
    const first = recoveryJournal.entries[0];
    const candidates = [];
    // journal 刚建立、archive 尚未 staged 时，当前 frozen 仍是旧字节，可直接重建确定性归档计划。
    if (existsSync(frozenOut)) {
      const fromCurrent = archivePlanFromFrozenText(readFileSync(frozenOut, 'utf8'));
      if (fromCurrent && digest(resolve(fromCurrent.path)) === first.targetHash && digest(fromCurrent.text) === first.contentHash) {
        candidates.push(fromCurrent);
      }
    }
    // archive 已 staged/committed 后当前 frozen 可能已是新字节；在同一 archiveDir 内按 journal 路径摘要找回。
    if (existsSync(archiveDir)) {
      let names = [];
      try { names = readdirSync(archiveDir); } catch { die(65, '重签恢复无法读取 archive-dir，拒绝猜测'); }
      if (names.length > 1000) die(65, 'archive-dir 条目过多，拒绝无界恢复扫描');
      for (const name of names) {
        const storedPath = join(archiveDir, name);
        const targetPath = name.endsWith('.tmp') ? storedPath.slice(0, -4) : storedPath;
        if (digest(resolve(targetPath)) !== first.targetHash) continue;
        let text;
        try {
          const physical = readPhysicalFileBytes({ targetPath: storedPath });
          if (!physical.ok) continue;
          text = physical.bytes.toString('utf8');
        } catch { continue; }
        if (digest(text) === first.contentHash) candidates.push({ path: targetPath, text });
      }
    }
    const unique = new Map(candidates.map((candidate) => [`${resolve(candidate.path)}\u0000${digest(candidate.text)}`, candidate]));
    if (unique.size !== 1) die(65, '无法从当前 frozen/archive staged target 唯一重建 --resign journal，须人工审计');
    archivePlan = [...unique.values()][0];
  }
}

// prd checksum 计划（D5）：只加 frozen 断言文件那一条；expectedFrozenPath 规范相对（仓内）。
const frozenText = JSON.stringify(frozen, null, 2) + '\n';
const relFrozen = relative(ROOT, resolve(frozenOut));
const frozenKey = relFrozen.startsWith('..') ? resolve(frozenOut) : relFrozen;
const sha = createHash('sha256').update(frozenText).digest('hex');
const entityLocksText = frozenEntityLocks ? JSON.stringify(frozenEntityLocks, null, 2) + '\n' : null;
const entityLocksKey = entityLocksProjectKey;
const entityLocksSha = entityLocksText ? createHash('sha256').update(entityLocksText).digest('hex') : null;
const newPrd = {
  ...prd,
  schemaVersion: 2,
  expectedFrozenPath: frozenKey,
  testChecksums: {
    ...(prd.testChecksums || {}),
    [frozenKey]: sha,
    ...(entityLocksKey ? { [entityLocksKey]: entityLocksSha } : {}),
  },
};
const prdText = JSON.stringify(newPrd, null, 2) + '\n';

// pending 留痕旁车（--force）。
const pendingSidecar = pending.length && args.force ? join(dirname(frozenOut), `expected.frozen.${caseId}.pending.json`) : null;
const pendingText = pendingSidecar ? JSON.stringify(pending, null, 2) + '\n' : null;

// 凭据兜底门（护栏 #7，codex R1-F5）：全部将写内容（frozen + sidecar + prd + archive）统一过门；命中 exit 1 零落盘。
const gateInputs = { [frozenOut]: frozenText, [prdPath]: prdText };
if (entityLocksOut) gateInputs[entityLocksOut] = entityLocksText;
if (pendingSidecar) gateInputs[pendingSidecar] = pendingText;
if (archivePlan) gateInputs[archivePlan.path] = archivePlan.text;
const cg = credentialGate(gateInputs);
if (!cg.ok) die(1, `凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝落盘`);

// ── 全部校验通过，方落盘。实体锁发布由 journal 恢复且 PRD 最后落位；不是多文件 OS 原子。──
const writes = [];
if (archivePlan) writes.push([archivePlan.path, archivePlan.text]);
writes.push([frozenOut, frozenText]);
if (entityLocksOut) writes.push([entityLocksOut, entityLocksText]);
if (pendingSidecar) writes.push([pendingSidecar, pendingText]);
writes.push([prdPath, prdText]);
commitWrites(
  writes,
  archivePlan ? [archiveDir] : [],
  publicationJournal ? {
    journalPath: publicationJournal,
    signedAt,
    authorityPath: prdPath,
    beforeAuthorityCommit: () => {
      const identity = verifyProjectArtifactIdentity({ projectRoot: ROOT, targetPath: entityLocksOut });
      if (!identity.ok) console.error(`sign: entity locks PRD-last 前物理身份复核未过（${identity.reason}）`);
      return identity.ok === true;
    },
    ...(archivePlan ? { readExisting: (path) => {
      const resolved = resolve(path);
      const archiveTarget = resolve(archivePlan.path);
      if (resolved !== archiveTarget && resolved !== `${archiveTarget}.tmp`) return readFileSync(resolved, 'utf8');
      const physical = readPhysicalFileBytes({ targetPath: resolved });
      if (!physical.ok) throw new Error(`archive physical boundary rejected: ${physical.reason}`);
      return physical.bytes.toString('utf8');
    } } : {}),
  } : null,
);

const nAssert = frozen.intents.reduce((n, it) => n + it.expected.length, 0) + (frozen.globalAssertions?.length || 0);
console.log(`sign: 冻结 ${caseId} —— ${nAssert} 条断言盖签（signer=${signer} build=${build}）→ ${frozenOut}`);
console.log(`  testChecksums[${frozenKey}] = ${sha.slice(0, 16)}…；expectedFrozenPath 已设`);
if (entityLocksOut) console.log(`  entity locks: 原 eventsSha256 + lockId + receiptHash 已人签冻结 → ${entityLocksOut}`);
if (pendingSidecar) console.log(`  ⚠ --force 签：${pending.length} 条 pending 留痕 → ${pendingSidecar}`);
