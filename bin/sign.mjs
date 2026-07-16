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
// fail-closed 纪律（codex R1-F3）：全部读+校验+cred-gate 在任何写盘之前完成；frozen/prd 走临时文件原子 rename；
// 任一环节失败绝不产生半份产物。退出码：0 成功；64 缺参；65 输入坏/闸拒；1 凭据兜底门拦截（护栏 #7）。
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path, { resolve, relative, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialGate } from '../lib/cred-gate.mjs';
import { assertSignedContract } from '../lib/sign-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const VERDICT_STATES = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const VERDICT_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);
const FROZEN_ASSERT_KEYS = new Set(['kind', 'op', 'value', 'soft', 'signedAt', 'signedAgainstBuild', 'signerId']);
const SAFE_ID = /^[A-Za-z0-9._@-]+$/; // 授权输入（signer/build）只许简单 id，防注入进归档名/断言值（codex R1-F2）

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i]; else o[k] = true; }
    else o.pos.push(a);
  }
  return o;
}
function die(code, msg) { console.error('sign: ' + msg); process.exit(code); }
// 读失败消毒（output-seal B1）：V8 的 JSON.parse 报错自带出错处内容片段（login-bootstrap 实测），
// 原样上抛会把 draft/prd/verdict-baseline 人编文件内容漏进 stderr——只报「不是合法 JSON/不可读」，内容不回显。
// SAFE_ID（:25，signer/build 复用）在 A11 键名遮值处也用。
function readJson(f, label) { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { die(65, `读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); } }
// 两阶段落盘（codex R1-F3 + R2-F1）：先把全部输出写 .tmp，任一失败清孤儿 tmp 后 fail-closed（真实文件零改动）；
// 全部 tmp 成功才统一 rename（同 FS near-atomic）。闭合「写前」与「写中（I/O/权限/满盘）」两类失败的半份风险。
function commitWrites(writes, dirsToMk = []) {
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
  for (const t of tmps) if (existsSync(t)) die(65, `tmp 路径已存在，拒（防预植 tmp 致写中失败留副作用，codex R5）：${t}`);
  // dirsToMk 不得等于或落在任一 target/tmp 之下（codex R6-F1）：否则 mkdir -p 会把该 tmp/文件路径建成目录。
  // 允许反向（归档文件合法地在 archiveDir 之下），故只查 d===p 或 d 在 p 之下、不查 p 在 d 之下。
  for (const d of dirs) for (const p of [...targets, ...tmps]) if (d === p || d.startsWith(p + path.sep)) die(65, `archive-dir 等于或落在某输出/tmp 路径之下，拒（codex R6）：${d} ~ ${p}`);
  for (const p of targets) { if (existsSync(p)) { let st; try { st = statSync(p); } catch { st = null; } if (st && st.isDirectory()) die(65, `输出目标是既存目录，拒（防 rename 半提交）：${p}`); } }
  // 预检通过才建目录（codex R4-F2/R5/R6：零落盘含目录副作用）；收集本次真新建的全部祖先（浅→深），写中失败逆序全量回滚。
  const createdDirs = [];
  for (const d of dirs) {
    const chain = [];
    for (let cur = d; cur && !existsSync(cur); cur = dirname(cur)) { chain.push(cur); if (dirname(cur) === cur) break; }
    for (const anc of chain.reverse()) if (!createdDirs.includes(anc)) createdDirs.push(anc);
    mkdirSync(d, { recursive: true });
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

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
if (!caseId || !args.draft || !args.prd || !args['frozen-out'] || !args.signer || !args['against-build']) {
  die(64, '用法: casey sign <caseId> --draft <f> --prd <f> --frozen-out <f> --signer <id> --against-build <id> [--signed-at <iso>] [--verdict-baseline <f>] [--resign] [--force] [--archive-dir <d>]');
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
const prd = readJson(prdPath, 'prd');
if (!prd || typeof prd !== 'object' || Array.isArray(prd)) die(65, 'prd 非对象');
// caseId 端到端绑定（codex R1-F1）：prd.caseId 必与命令行一致，防把 A 的签名塞进 B 的 prd。
if (prd.caseId !== caseId) die(65, `prd.caseId 不一致（命令行 ${caseId}；prd 侧值不符或缺，原值不回显——output-seal A5），拒签`);

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
const signedAt = args['signed-at'] ? String(args['signed-at']) : new Date().toISOString();
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

// 自守 1：白名单键（additionalProperties 合规，D5 + 冻结 schema）——intents 与 globalAssertions 同口径（codex R2-F3）。
for (const it of frozen.intents) for (const a of it.expected) for (const k of Object.keys(a)) if (!FROZEN_ASSERT_KEYS.has(k)) die(65, `断言含越界键（frozen additionalProperties 合规；键名原值不回显——output-seal A17）`);
for (const a of (frozen.globalAssertions || [])) for (const k of Object.keys(a)) if (!FROZEN_ASSERT_KEYS.has(k)) die(65, `全局断言含越界键（frozen additionalProperties 合规；键名原值不回显——output-seal A17）`);
// 自守 2：读侧门 assertSignedContract 必 ok（签发端与校验端同口径）。
const sc = assertSignedContract(frozen);
if (!sc.ok) die(65, `frozen 自守未过 assertSignedContract：${sc.problems.slice(0, 3).join('；')}`);

// 重签 / anti-clobber（D4）：frozen 已存在——无 --resign 拒覆写；有 --resign 备好归档（写盘留到最后）。
const archiveDir = args['archive-dir'] ? String(args['archive-dir']) : join(dirname(frozenOut), 'archive');
let archivePlan = null;
if (existsSync(frozenOut)) {
  if (!args.resign) die(65, `frozen 已存在（${frozenOut}）——重签须显式 --resign（anti-clobber 防误覆写）`);
  const old = readJson(frozenOut, '旧 frozen');
  const oldText = JSON.stringify(old, null, 2) + '\n';
  const rawBuild = old?.intents?.[0]?.expected?.[0]?.signedAgainstBuild || 'unknown';
  const safeBuild = String(rawBuild).replace(/[^A-Za-z0-9._-]/g, '_'); // 归档名去穿越（codex R1-F2：旧 build 可能含 /..）
  // 用旧 frozen 内容 hash 做唯一后缀（codex R2-F4）：不同旧内容 → 不同归档名（防稳定碰撞覆盖毁审计）；
  // 同内容重归档 → 同名（幂等无损）。取代易碰撞的 signed-at 数字串。
  const oldHash = createHash('sha256').update(oldText).digest('hex').slice(0, 12);
  archivePlan = { path: join(archiveDir, `expected.frozen.${caseId}.${safeBuild}.${oldHash}.json`), text: oldText };
}

// prd checksum 计划（D5）：只加 frozen 断言文件那一条；expectedFrozenPath 规范相对（仓内）。
const frozenText = JSON.stringify(frozen, null, 2) + '\n';
const relFrozen = relative(ROOT, resolve(frozenOut));
const frozenOutside = relFrozen === '..' || relFrozen.startsWith(`..${path.sep}`) || path.isAbsolute(relFrozen);
const frozenKey = (frozenOutside ? resolve(frozenOut) : relFrozen).split(path.sep).join('/');
const sha = createHash('sha256').update(frozenText).digest('hex');
const newPrd = { ...prd, schemaVersion: 2, expectedFrozenPath: frozenKey, testChecksums: { ...(prd.testChecksums || {}), [frozenKey]: sha } };
const prdText = JSON.stringify(newPrd, null, 2) + '\n';

// pending 留痕旁车（--force）。
const pendingSidecar = pending.length && args.force ? join(dirname(frozenOut), `expected.frozen.${caseId}.pending.json`) : null;
const pendingText = pendingSidecar ? JSON.stringify(pending, null, 2) + '\n' : null;

// 凭据兜底门（护栏 #7，codex R1-F5）：全部将写内容（frozen + sidecar + prd + archive）统一过门；命中 exit 1 零落盘。
const gateInputs = { [frozenOut]: frozenText, [prdPath]: prdText };
if (pendingSidecar) gateInputs[pendingSidecar] = pendingText;
if (archivePlan) gateInputs[archivePlan.path] = archivePlan.text;
const cg = credentialGate(gateInputs);
if (!cg.ok) die(1, `凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝落盘`);

// ── 全部校验通过，方落盘（两阶段：预检 → 建目录 → 全温 wx 写 → 统一 rename；写前/写中失败零半份）──
const writes = [];
if (archivePlan) writes.push([archivePlan.path, archivePlan.text]);
writes.push([frozenOut, frozenText]);
if (pendingSidecar) writes.push([pendingSidecar, pendingText]);
writes.push([prdPath, prdText]);
commitWrites(writes, archivePlan ? [archiveDir] : []);

const nAssert = frozen.intents.reduce((n, it) => n + it.expected.length, 0) + (frozen.globalAssertions?.length || 0);
console.log(`sign: 冻结 ${caseId} —— ${nAssert} 条断言盖签（signer=${signer} build=${build}）→ ${frozenOut}`);
console.log(`  testChecksums[${frozenKey}] = ${sha.slice(0, 16)}…；expectedFrozenPath 已设`);
if (pendingSidecar) console.log(`  ⚠ --force 签：${pending.length} 条 pending 留痕 → ${pendingSidecar}`);
