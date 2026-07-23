#!/usr/bin/env node
// bin/compile.mjs —— 相1 编译 CLI（三段式，G3 分岔一取 A：flow 落盘 + 人 confirm 门）。
//
//   node bin/compile.mjs <caseId> --testcase <f> --flow <f> --out-dir <d>
//       闸段：flow 草稿过 compile-gate 双闸（前缀自 TestCase.uniquePrefix，fail-closed）→ 落 flow-<caseId>.json 等人 confirm。
//   node bin/compile.mjs <caseId> --execute --testcase <f> --sut <url> --out-dir <d> --profile <f> [--entity-authority <f>] [--skip-login] [--unique-name <tok>]
//       执行段：以 TestCase 为不可变锚重验三闸 → 登录预备动作（凭据只进内存）→ 骑 atom 知识真机逐步执行
//       → events.json + observed-<caseId>.json + compile-report.json（任一步证不出 → 只落诊断报告 exit 65）。
//   node bin/compile.mjs <caseId> --verify --sut <url> --out-dir <d> --profile <f> [--entity-locks <f>] [--events <events.json>] [--login-bootstrap]
//       核验段（G1 取 B）：调 bin/replay.mjs 产 axes → 动作轴全 unique 才 0；否则列雷点清单非零退出。
//       --login-bootstrap 透传给子 replay（真机核验过登录墙；hermetic 不带旗标零行为差）。
//
// 退出码：0 成功；1 运行时失败/凭据门拦；64 缺参；65 输入坏/闸拒（fail-closed）；66 flow 未 confirm。
// 所有落盘口过 lib/cred-gate.mjs（G5 取 B，护栏 #7）。本进程零 LLM、零裁定（护栏 #15）。
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pw from '@playwright/test';
import { validateDraft } from '../lib/compile-gate.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
import { createCompileRun, compileFlow, projectObserved, ROUTE_LIST } from '../lib/compile-atoms.mjs';
import { ENTITY_KIND_COMPILE_CHANNELS, checkIdentityObservationCardinality, deriveObservationIssuerAtom } from '../lib/entity-observation-registry.mjs';
import {
  buildEntityBindingsDraft,
  checkCompileIdentityAdmission as checkExecuteIdentityAdmission,
  checkReplayEntityAdmission,
  checkCredentialAudienceGate,
  flowContainsEntityMutation,
  readIdentityAdmissionAuthorityFromPrd,
  requiredFlowEntityBindings,
} from '../lib/entity-semantic-lock-preflight.mjs';
import { PROJECT_ROOT } from '../lib/paths.mjs';

const { chromium } = pw;
const SNAPSHOT_FILE = join(PROJECT_ROOT, 'lib', 'atoms-registry.snapshot.json');

// 统一三段式调用名：execute 使用预执行 authority；verify 使用 successor 的 replay 内部 policy。
function checkCompileIdentityAdmission(options) {
  if (options?.mode === 'execute') return checkExecuteIdentityAdmission(options);
  const { mode: _mode, ...replayOptions } = options || {};
  return checkReplayEntityAdmission(replayOptions);
}

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    } else o.pos.push(a);
  }
  return o;
}

// 读失败消毒（output-seal B3）：V8 JSON.parse 报错自带内容片段——testcase/flow 无输入预扫；
// 只报「不是合法 JSON/不可读」，内容不回显。
function readJson(f, label) {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch { console.error(`compile: 读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); process.exit(65); }
}

// CLI 文件参数只负责指向已发布 artifact；真正授权来源仍是规范 PRD 中该 project-relative key 的 checksum。
function projectArtifactKey(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const rel = relative(PROJECT_ROOT, resolve(input));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

// 落盘统一过凭据门（G5）：任一产物命中即全部拒写、非零退出（fail-closed）。
function gatedWrite(files) {
  const outputs = Object.fromEntries(Object.entries(files).map(([p, text]) => [p, text]));
  const gate = credentialGate(outputs);
  if (!gate.ok) { console.error(`compile: 凭据兜底门拦截（护栏 #7）：${gate.hit}；拒绝落盘`); process.exit(1); }
  const entries = Object.entries(files);
  const tmps = entries.map(([p]) => `${p}.tmp`);
  if (new Set(entries.map(([p]) => resolve(p))).size !== entries.length || tmps.some((p) => existsSync(p))) {
    console.error('compile: 输出路径碰撞或 .tmp 已存在，拒绝落盘'); process.exit(65);
  }
  const written = [];
  try {
    for (let index = 0; index < entries.length; index++) {
      writeFileSync(tmps[index], entries[index][1], { encoding: 'utf8', flag: 'wx' });
      written.push(index);
    }
  } catch {
    for (const index of written) try { rmSync(tmps[index], { force: true }); } catch { /* 尽力清理 */ }
    console.error('compile: 输出预写失败，已清理临时文件；零目标落盘'); process.exit(74);
  }
  for (let index = 0; index < entries.length; index++) {
    try { renameSync(tmps[index], entries[index][0]); }
    catch {
      for (let rest = index; rest < tmps.length; rest++) try { rmSync(tmps[rest], { force: true }); } catch { /* 尽力清理 */ }
      console.error('compile: 输出 staged rename 中断，已清理未提交临时文件；可能已有部分非授权产物到位，无 draft 不可签，下一次 compile 会清场重建'); process.exit(74);
    }
  }
}

// ── 闸段：flow 草稿 → compile-gate → 落盘等 confirm ─────────────────────────
function gateMode(caseId, args) {
  const tc = readJson(args.testcase, 'TestCase');
  if (tc.caseId !== caseId) { console.error(`compile: TestCase.caseId 与命令行 caseId（${caseId}）不一致（文件侧值原值不回显——output-seal A8）`); process.exit(65); }
  if (typeof tc.uniquePrefix !== 'string' || !tc.uniquePrefix.length) { console.error('compile: TestCase.uniquePrefix 缺失/空——破坏性前缀硬闸无锚，拒绝（fail-closed）'); process.exit(65); }
  const flow = readJson(args.flow, 'flow 草稿');
  const registry = readJson(SNAPSHOT_FILE, '原子注册表快照');
  // 初始状态种子 = TestCase.preconditions（「已登录」由登录预备动作建立，flow 不含 login 原子）。
  const { ok, problems } = validateDraft(flow, { prefix: tc.uniquePrefix, registry, initialStates: tc.preconditions || [] });
  if (!ok) {
    console.error(`compile: flow 草稿未过编译门（${problems.length} 问题，fail-closed）：`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(65);
  }
  const outDir = resolve(String(args['out-dir']));
  mkdirSync(outDir, { recursive: true });
  const doc = {
    caseId, uniquePrefix: tc.uniquePrefix,
    preconditions: tc.preconditions || [],
    gate: { ok: true, atomsFrom: 'lib/atoms-registry.snapshot.json' },
    confirmedBy: '', confirmedAt: null,
    flow,
  };
  const p = join(outDir, `flow-${caseId}.json`);
  gatedWrite({ [p]: JSON.stringify(doc, null, 2) + '\n' });
  console.log(`compile: flow 草稿过闸 → ${p}`);
  console.log('compile: 等人 confirm（填 confirmedBy/confirmedAt）后方可 --execute（G3 人签门）');
  process.exit(0);
}

// ── 执行段：登录预备动作 → 骑 atom 知识逐步执行 → 三产物 ─────────────────────
async function executeMode(caseId, args) {
  const outDir = resolve(String(args['out-dir']));
  const flowFile = join(outDir, `flow-${caseId}.json`);
  if (!existsSync(flowFile)) { console.error(`compile: 缺 ${flowFile}——先跑闸段落 flow 草稿`); process.exit(65); }
  const flowDoc = readJson(flowFile, 'flow-<caseId>.json');
  if (typeof flowDoc.confirmedBy !== 'string' || !flowDoc.confirmedBy.trim()
    || typeof flowDoc.confirmedAt !== 'string' || !flowDoc.confirmedAt.trim()) {
    console.error('compile: flow 草稿未经人 confirm（confirmedBy/confirmedAt 空）——破坏性原子上真机前须人眼一道（G3 人签门），拒跑');
    process.exit(66);
  }
  // 执行段重验闸（R1-F1 + R2-F1）：flow-<caseId>.json 是可编辑文件，自带 uniquePrefix/preconditions
  // 可与 flow 一起自洽伪造——重验锚点一律取 --testcase（不可变 TestCase），不信 flow 文件自带字段。
  const tc = readJson(args.testcase, 'TestCase');
  if (tc.caseId !== caseId || flowDoc.caseId !== caseId) {
    console.error(`compile: caseId 不一致（命令行 ${caseId}；TestCase/flow 侧值不符，原值不回显——output-seal A9），拒跑`);
    process.exit(65);
  }
  if (typeof tc.uniquePrefix !== 'string' || !tc.uniquePrefix.length) {
    console.error('compile: TestCase.uniquePrefix 缺失/空——破坏性前缀硬闸无锚，拒跑（fail-closed）');
    process.exit(65);
  }
  const registry = readJson(SNAPSHOT_FILE, '原子注册表快照');
  {
    const re = validateDraft(flowDoc.flow, { prefix: tc.uniquePrefix, registry, initialStates: tc.preconditions || [] });
    if (!re.ok) {
      console.error(`compile: 执行前重验闸未过（${re.problems.length} 问题，疑 confirm 后被改）：`);
      for (const p of re.problems) console.error(`  - ${p}`);
      process.exit(65);
    }
  }
  // 预执行身份授权门：mutation 由已过闸 flow + registry 机械判定，不接受调用者自称只读。
  // 授权同时绑定 flow/TestCase 原始字节和全部显式对象角色；未过时尚未启动浏览器。
  const containsEntityMutation = flowContainsEntityMutation(flowDoc.flow, registry);
  const executeArtifactKey = projectArtifactKey(args['entity-authority']);
  const executeAuthorityRead = executeArtifactKey
    ? readIdentityAdmissionAuthorityFromPrd({
      prdId: caseId,
      artifactKey: executeArtifactKey,
      domain: 'execute',
    })
    : null;
  const executeAuthority = executeAuthorityRead?.ok === true ? executeAuthorityRead.authority : null;
  // 凭据上下文门（ADR-0010，codex High-2 修）：铸权后、启动浏览器前、且【早于】bindings 准入——按实际凭据加载派生
  // 上下文（非 --skip-login 旗标自报）：非 skip-login=生产意图，此处即把站点配置/凭据加载掉，成功=production 上下文、
  // 失败=浏览器前 exit 65 fail-closed（绝不启动浏览器后才发现无凭据）；--skip-login=test 上下文、无凭据。受众与上下文
  // 严格匹配，不符 exit 65。与 replay.mjs 同律；受众与 bindings 正交、故置于 admission 之前更早 fail-closed。防测试锁误指真 SUT。
  let preloadedCreds = null;
  let credentialContext = 'test';
  if (!args['skip-login']) {
    try {
      loadSiteConfig(undefined, { strict: true }); // 坏 site.json 抛错 fail-closed
      preloadedCreds = loadCreds();
      credentialContext = 'production';
    } catch {
      console.error('compile --execute: 登录站点配置/凭据加载失败（fail-closed；详情不回显，护栏 #7），未启动浏览器');
      process.exit(65);
    }
  }
  if (executeAuthorityRead?.ok === true) {
    const audienceGate = checkCredentialAudienceGate({ audience: executeAuthorityRead.audience, credentialContext });
    if (!audienceGate.ok) {
      console.error(`compile --execute: 准入受众与凭据上下文不符（${audienceGate.reason}：受众=${executeAuthorityRead.audience} 上下文=${credentialContext}），未启动浏览器；下一步 ${audienceGate.nextAction}`);
      process.exit(65);
    }
  }
  const identityAdmission = checkCompileIdentityAdmission({
    mode: 'execute',
    caseId,
    containsEntityMutation,
    flow: flowDoc.flow,
    executeAuthority,
    flowBytes: readFileSync(flowFile),
    testcaseBytes: readFileSync(String(args.testcase)),
    requiredBindings: requiredFlowEntityBindings(flowDoc.flow),
  });
  if (!identityAdmission.ok) {
    console.error(`compile --execute: 预执行身份授权未过（${identityAdmission.reason}），未启动浏览器；下一步 ${identityAdmission.nextAction}`);
    process.exit(65);
  }
  // 旧成功产物清场（R2-F3）：本目录语义 = 本次运行结果；先清旧 events/observed，
  // 失败路径绝不让上一轮成功产物残留假冒本轮（可进 P4 的只能是本轮全 unique 产物）。
  rmSync(join(outDir, 'events.json'), { force: true });
  rmSync(join(outDir, 'entity-bindings.draft.json'), { force: true });
  rmSync(join(outDir, 'identity-observations.compile.json'), { force: true });
  rmSync(join(outDir, `observed-${caseId}.json`), { force: true });
  const profile = readJson(args.profile, '通道剖面');
  // 剖面可选 routes.workflowList（非凭据通道配置）：present 则须以 / 开头的路径段（R1-F5 形状校验同律），
  // 缺省 null → compile-atoms 走 ROUTE_LIST（hermetic 行为不变）。
  let listRoute = null;
  let agentListRoute = null;
  if (profile.routes !== undefined) {
    const r = profile.routes;
    const routeOk = (v) => v === undefined || (typeof v === 'string' && v.startsWith('/'));
    const okShape = r && typeof r === 'object' && !Array.isArray(r) && routeOk(r.workflowList) && routeOk(r.agentList);
    if (!okShape) { console.error('compile: 通道剖面 routes 形状非法（各路由须以 / 开头的路径段），拒跑（fail-closed）'); process.exit(65); }
    listRoute = r.workflowList || null;
    agentListRoute = r.agentList || null; // chief-bringup G1：智能体列表路由（nav.agentManagement 路由导航优先）
  }
  // 身份通道剖面（剖面声明制——未声明零行为差，声明则形状非法 fail-closed）。
  // C0：注入不再硬认 profile.agents，改按闭集注册表登记的实体 kind 数据驱动遍历（ENTITY_KIND_COMPILE_CHANNELS）：
  //   各 kind 从其对应 profile 通道注入身份 ledger，好让 C1 加闸、C2 加 workflow 各碰不同缝。
  //   C0 只登记 agent（→ profile.agents）；未登记观察通道的 kind（如 workflow）不遍历 = 行为逐字等价今日 agent-only。
  // per-kind 身份观察通道（codex R1 High：原单变量 identityChannelCfg 逐次覆盖——C2 加 workflow 后
  // 第二 kind 会覆盖第一——改真 per-kind Map，键=已登记 kind、值=该 kind 的 channelCfg，
  // 让 C2 只需往 Map 加条目、不覆盖 agent）。C0 注册表恰含 agent 一个观察通道 kind。
  const identityChannelsByKind = new Map();
  for (const [kind, channelSpec] of ENTITY_KIND_COMPILE_CHANNELS) {
    const channelProfile = profile[channelSpec.profileKey];
    if (channelProfile === undefined || channelProfile === null) continue;
    const a = channelProfile;
    const aOk = a && typeof a === 'object' && !Array.isArray(a);
    if (!aOk) { console.error(`compile: 通道剖面 ${channelSpec.profileKey} 形状非法，拒跑（fail-closed）`); process.exit(65); }
    if (a.listApi !== undefined && a.listApi !== null) {
      const l = a.listApi;
      const s = (v) => typeof v === 'string' && v.trim() !== '';
      const shapeOk = l && typeof l === 'object' && !Array.isArray(l)
        && s(l.pathname) && l.pathname.startsWith('/') && s(l.method)
        && s(l.recordsPath) && s(l.totalPath) && s(l.queryParam)
        && (l.hasNextPath === null || l.hasNextPath === undefined || s(l.hasNextPath))
        && l.fields && typeof l.fields === 'object' && !Array.isArray(l.fields)
        && s(l.fields.id) && s(l.fields.code) && s(l.fields.name);
      if (!shapeOk) { console.error(`compile: 通道剖面 ${channelSpec.profileKey}.listApi 形状非法（身份通道声明不完整，含 queryParam），拒跑（fail-closed）`); process.exit(65); }
      // 物理卡片双锚（codex R1-H1）：声明身份通道即须声明卡片容器与 name/code 子选择器——
      // DOM 证据必须从同一物理卡片读出，缺声明 fail-closed。
      const cardOk = s(a.itemContainer)
        && a.cardFields && typeof a.cardFields === 'object' && !Array.isArray(a.cardFields)
        && s(a.cardFields.name) && s(a.cardFields.code);
      if (!cardOk) { console.error(`compile: 身份通道声明缺物理卡片面（${channelSpec.profileKey}.itemContainer + ${channelSpec.profileKey}.cardFields.name/code），拒跑（fail-closed）`); process.exit(65); }
      identityChannelsByKind.set(kind, {
        pathname: l.pathname, method: l.method, recordsPath: l.recordsPath, totalPath: l.totalPath,
        queryParam: l.queryParam,
        hasNextPath: l.hasNextPath ?? null,
        fields: { id: l.fields.id, code: l.fields.code, name: l.fields.name },
      });
    }
  }
  // 下游 ledger/forensics 目前单通道消费：C0 取唯一已登记 kind 的 channelCfg。多 kind（C2 加 workflow 后
  // 剖面同时声明多观察通道）尚无 per-kind 下游注入——fail-closed 拒，绝不静默择一（正是本 finding 覆盖 bug）。
  if (identityChannelsByKind.size > 1) {
    console.error('compile: 剖面声明多身份观察通道 kind，per-kind 下游注入尚未支持（C2），拒跑（fail-closed）'); process.exit(65);
  }
  let identityChannelCfg = null;
  for (const cfg of identityChannelsByKind.values()) identityChannelCfg = cfg;
  const identityLedger = identityChannelCfg
    ? (await import('../lib/agent-identity-observation.mjs')).createIdentityObservationLedger({ channel: identityChannelCfg })
    : null;
  const sut = String(args.sut).replace(/\/$/, '');
  const uniqueName = String(args['unique-name'] || Date.now().toString(36));
  const site = loadSiteConfig();
  const watchdog = setTimeout(() => { console.error('compile 看门狗：超时强制退出'); process.exit(1); }, 120000);

  // 浏览器启动哨兵（仅测试注入，生产 env 未设即 no-op）：到达本行=控制流已越过一切浏览器前 fail-closed 门（准入/受众/
  // 凭据）。设 env 时写哨兵并 exit 66 短路——【不真启浏览器】即可让验收金牌机械证「门是否在浏览器前拦」：门先 fire→
  // exit 65 哨兵缺席；控制流到达此点→哨兵在 + exit 66（正控证哨兵非空、非产物缺席那种可被先启动后退门绕过的弱证）。codex round-4。
  if (process.env.CASEY_LAUNCH_SENTINEL) { writeFileSync(process.env.CASEY_LAUNCH_SENTINEL, 'launched'); process.exit(66); }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const state = { currentStepId: null };
  const forensics = watchNetworkForensics(cdp, {
    denylist: profile.background || [],
    successField: profile.successField,
    successValue: profile.successValue,
    currentStep: () => state.currentStepId,
    ...(identityLedger ? {
      identityChannel: {
        ...identityChannelCfg,
        sutOrigin: new URL(sut).origin, // 同源判据（codex R1-H2）：跨源同路径响应不入身份通道
        onRequest: (x) => identityLedger.onRequestWillBeSent(x),
        onTerminal: (x) => identityLedger.onBodyTerminal(x),
      },
    } : {}),
  });

  const run = createCompileRun({ page, forensics, state, sut, uniqueName, site, listRoute, agentListRoute, profile, identityLedger });
  let exitCode = 0;
  try {
    if (!args['skip-login']) {
      // 登录预备动作：不产 event，凭据只进内存（护栏 #7）。登录入口 = --sut 基址 + site.json startUrl 的路径段——
      // devProxyUrl/根 '/' 只是基址不渲染登录表单（真机实采 2026-07-02：裸基址上 SPA 判据「表单不在场」
      // 会被误读为已登录态 fail-open，后续全步 absent）；基址恒由 --sut 注入、绝不写死。
      const creds = preloadedCreds; // 已在浏览器启动前加载（codex High-2 凭据上下文门），此处复用不重载
      run.notes.push('凭据于浏览器启动前加载（凭据上下文门 fail-closed）');
      let entryPath = ROUTE_LIST;
      try { entryPath = new URL(site.target.startUrl).pathname; } catch { /* 无 startUrl：退列表路由 */ }
      await loginBootstrap(page, { site, creds, startUrl: sut + entryPath });
      run.notes.push('登录预备动作完成（不产 event）');
    }
    await compileFlow(run, flowDoc.flow);
  } catch (e) {
    console.error(`compile: 执行失败：${String((e && e.message) || e).slice(0, 300)}`); // 剥栈只留消息（output-seal B7）
    exitCode = 1;
  } finally {
    await forensics.awaitStreamsSettled(1500);
    await forensics.drain();
  }

  if (exitCode === 0) {
    const now = new Date().toISOString();
    const reportDoc = {
      caseId, compiledAt: now, uniquePrefix: tc.uniquePrefix,
      verification: run.verification,
      countAudit: run.countAudit,
      blockers: run.blockers,
      caseDefectCandidates: run.caseDefectCandidates,
      handoff: { assertionAtoms: run.assertionAtoms },
      notes: run.notes,
      // 双证门结构化裁定（codex R1-M2 断言面）：硬阻断类别（action_failed/ambiguous/absent）机器可判，
      // 金牌不靠 blocker 文案 grep。
      ...(run.identityGateOutcome ? { identityGate: run.identityGateOutcome } : {}),
    };
    const nonUnique = run.verification.filter((v) => v.resolution !== 'unique');
    if (nonUnique.length || run.blockers.length) {
      // 证不出不产成功产物（R1-F3 + R2-F4，护栏 #14）：任一步非 unique 或存在硬阻断 →
      // 只落诊断用 compile-report（route:human 依据），不落可进 P4 的 events/observed，非零退出。
      gatedWrite({ [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n' });
      console.error(`compile: ${nonUnique.length} 步非 unique + ${run.blockers.length} 硬阻断（fail-closed，不产 events/observed）→ route:human：`);
      for (const v of nonUnique) console.error(`  - ${v.stepId}（${v.atom}/${v.action}）resolution=${v.resolution} count=${v.candidateCount}`);
      for (const b of run.blockers) console.error(`  - ${b}`);
      exitCode = 65;
    } else {
      const firstNav = run.events.find((e) => e.action === 'nav');
      const eventsDoc = {
        schemaVersion: 2, channel: 'web', caseId,
        url: firstNav ? firstNav.url : `{{baseUrl}}${ROUTE_LIST}`,
        recordedAt: now, compiledBy: 'casey-compile/p3', authored: false,
        events: run.events,
      };
      const eventsText = JSON.stringify(eventsDoc, null, 2) + '\n';
      // 身份观察基数强校验（codex R1-C1 封缝 + C2 High-1 kind-无关泛化）：声明身份通道时，每条已归档观察行须
      // 锚定唯一真实终端 click（evidenceStepId ∈ 已发 click stepId 集、互不重复）——多/少/错位/重复都不产成功产物，
      // 绝不静默降级出可按 v1 签署的编译件。旧实现只数 agent.searchOpen click（workflow-only 流 0≠1 误 exit 65）；
      // 改锚 evidenceStepId 后 agent 结论逐字不变、workflow 单观察不再误杀（纯函数 checkIdentityObservationCardinality）。
      let entityBindingsDraft = null;
      let entityBindingsDraftText = null;
      let observationIssuer = null; // C2 High-1：观察成品 issuer 原子（据观察行泛化，非硬编码 agent.searchOpen）
      if (identityLedger) {
        const card = checkIdentityObservationCardinality({ events: run.events, observations: run.identityObservations });
        if (!card.ok) {
          gatedWrite({ [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n' });
          console.error(`compile: 身份观察基数门 fail-closed（${card.reason}；观察 ${run.identityObservations.length} 条），不产 events/draft/observed`);
          exitCode = 65;
        }
        // issuer 原子泛化（codex High-1）：据已归档观察行推导单一 issuer 原子，多原子/未登记 fail-closed（浏览器后成品前）。
        if (exitCode === 0 && run.identityObservations.length) {
          observationIssuer = deriveObservationIssuerAtom(run.identityObservations);
          if (!observationIssuer.ok) {
            gatedWrite({ [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n' });
            console.error(`compile: 身份观察 issuer 门 fail-closed（${observationIssuer.reason}），不产 events/draft/observed`);
            exitCode = 65;
          }
        }
      }
      if (exitCode === 0 && containsEntityMutation) {
        const draftResult = buildEntityBindingsDraft({
          eventsBytes: Buffer.from(eventsText),
          eventsDocument: eventsDoc,
          provenance: run.entityBindingProvenance,
        });
        if (draftResult?.ok !== true) {
          gatedWrite({ [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n' });
          console.error(`compile: entity binding sidecar 未闭合（${draftResult?.reason || 'UNKNOWN'}），不产 events/draft/observed`);
          exitCode = 65;
        }
        if (draftResult?.ok === true) entityBindingsDraft = draftResult.draft;
      }
      if (exitCode === 0) {
      // capturedAgainstBuild 提取（Steven 决议 2026-07-02 ⑥ 接线，plan-debt-sweep）：入口 HTML 脚本 src 的
      // ?v= 查询串 = 前端发版号（Heren api-config.js?v=1.1.2 形态）；SPA 脚本跨路由常驻、尾页提取即入口提取。
      // 取不到/异常照旧 null（fail-safe 方向一字不变）。
      let capturedBuild = null;
      try {
        capturedBuild = await page.evaluate(() => {
          for (const s of Array.from(document.scripts)) {
            const m = /[?&]v=([A-Za-z0-9._-]+)/.exec(s.getAttribute('src') || '');
            if (m) return m[1];
          }
          return null;
        });
      } catch { capturedBuild = null; }
      if (typeof capturedBuild !== 'string' || !capturedBuild) capturedBuild = null;
      const observedDoc = projectObserved(run, { caseId, capturedAt: now, capturedAgainstBuild: capturedBuild });
      // 身份观察件（agent-id-readback plan §5）：unique 双证放行时落盘；digest=listApi 闭合对象规范化 sha、
      // eventsSha256 绑最终 events 字节；compile-report 只记状态与观察件 sha（不复制三元组，sol P1）。
      let identityObservationsText = null;
      if (identityLedger && run.identityObservations.length) {
        const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
          : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v));
        const digest = `sha256:${createHash('sha256').update(JSON.stringify(sortKeys(identityChannelCfg))).digest('hex')}`;
        const observationArtifact = {
          schemaVersion: 1,
          artifactKind: 'compile-identity-observation',
          caseId,
          capturedAgainstBuild: capturedBuild,
          identityProfileDigest: digest,
          eventsSha256: `sha256:${createHash('sha256').update(Buffer.from(eventsText)).digest('hex')}`,
          // issuer 泛化（codex High-1）：源信封原子据观察行推导（agent→agent.searchOpen 逐字等价、workflow→workflow.create/open）。
          source: { kind: observationIssuer.sourceKind, atom: observationIssuer.atom, signed: false, replayReady: false },
          observations: run.identityObservations,
        };
        identityObservationsText = JSON.stringify(observationArtifact, null, 2) + '\n';
        reportDoc.identityObservation = {
          status: 'captured',
          count: run.identityObservations.length,
          artifactSha256: createHash('sha256').update(identityObservationsText).digest('hex'),
        };
        // v2 草稿真接线（codex R1-C1）：含身份观察的编译产物必须以 schemaVersion:2 落盘并绑双 digest
        // （通道指纹 + 观察件原始字节 sha）——否则 sign 的 v2 对账路径对真实产物永不激活，
        // platformId 进不了签署/回放闭环。
        if (entityBindingsDraft) {
          entityBindingsDraft = {
            ...entityBindingsDraft,
            schemaVersion: 2,
            identityProfileDigest: digest,
            identityObservationsSha256: `sha256:${createHash('sha256').update(Buffer.from(identityObservationsText)).digest('hex')}`,
          };
        }
      }
      if (entityBindingsDraft) entityBindingsDraftText = JSON.stringify(entityBindingsDraft, null, 2) + '\n';
      gatedWrite({
        [join(outDir, 'events.json')]: eventsText,
        ...(entityBindingsDraftText ? { [join(outDir, 'entity-bindings.draft.json')]: entityBindingsDraftText } : {}),
        ...(identityObservationsText ? { [join(outDir, 'identity-observations.compile.json')]: identityObservationsText } : {}),
        [join(outDir, `observed-${caseId}.json`)]: JSON.stringify(observedDoc, null, 2) + '\n',
        [join(outDir, 'compile-report.json')]: JSON.stringify(reportDoc, null, 2) + '\n',
      });
      console.log(`compile: 执行段完成 → events ${run.events.length} 步 / observed ${observedDoc.steps.length} 步 / 候选 ${run.caseDefectCandidates.length}`);
      }
    }
  }
  clearTimeout(watchdog);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  process.exit(exitCode);
}

// ── 核验段（G1 取 B）：喂空 expected 跑 bin/replay.mjs，扫动作轴全 unique ────────
// 判据是动作轴（可加载、可回放、点击身份门全 unique），不以 verdict 终判为准（无冻结断言时裁定必落 NEEDS_HUMAN 属正常）。
function verifyMode(caseId, args) {
  const outDir = resolve(String(args['out-dir']));
  // sign 不覆写 compile 原始 events；核验始终消费原 events v2 字节。
  const eventsFile = args.events ? resolve(String(args.events)) : join(outDir, 'events.json');
  if (!existsSync(eventsFile)) { console.error(`compile: 缺 ${eventsFile}——先 --execute 产 events`); process.exit(65); }
  // verify 的写链只认绑定最终 events 字节的 frozen locks，不得拿 execute authority 冒充；
  // 固定 atom+action 的纯只读链由 replay 内部 policy 证明，可不带 locks。
  // 本门位于临时文件和 replay spawn 之前，拒绝路径零回放副作用。
  const eventsBytes = readFileSync(eventsFile);
  const eventsDoc = readJson(eventsFile, 'events.json');
  const entityLocksSupplied = typeof args['entity-locks'] === 'string' && Boolean(args['entity-locks']);
  const frozenArtifactKey = entityLocksSupplied ? projectArtifactKey(args['entity-locks']) : null;
  const frozenAuthorityRead = frozenArtifactKey
    ? readIdentityAdmissionAuthorityFromPrd({
      prdId: caseId,
      artifactKey: frozenArtifactKey,
      domain: 'verify',
    })
    : null;
  const frozenLockAuthority = frozenAuthorityRead?.ok === true ? frozenAuthorityRead.authority : null;
  const identityAdmission = checkCompileIdentityAdmission({
    mode: 'verify',
    caseId,
    eventsBytes,
    eventsDocument: eventsDoc,
    ...(entityLocksSupplied ? { frozenLockAuthority } : {}),
  });
  if (!identityAdmission.ok) {
    console.error(`compile --verify: frozen identity locks 未过（${identityAdmission.reason}），未启动 replay；下一步 ${identityAdmission.nextAction}`);
    process.exit(65);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'casey-compile-verify-'));
  const expFile = join(tmp, 'expected.empty.json');
  writeFileSync(expFile, JSON.stringify({ caseId, channel: 'web', intents: [], globalAssertions: [] }));
  const axesFile = join(tmp, 'axes.json');
  const r = spawnSync(process.execPath, [join(PROJECT_ROOT, 'bin', 'replay.mjs'),
    '--events', eventsFile, '--sut', String(args.sut), '--expected', expFile, '--profile', String(args.profile), '--out', axesFile,
    ...(entityLocksSupplied ? ['--entity-locks', String(args['entity-locks'])] : []),
    // 登录预备动作透传（GRILL 人签取 A）：真机核验必过登录墙；hermetic 调用不带旗标、行为一字不变。
    ...(args['login-bootstrap'] ? ['--login-bootstrap'] : []),
  ], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    console.error(`compile --verify: 回放器非零退出（${r.status}）：${(r.stderr || '').slice(-400)}`);
    process.exit(1);
  }
  const axes = readJson(axesFile, 'axes');
  // 逐 event 扫（R1-F4）：intent 卷回的代表步会掩盖中间 event 的 ambiguous——优先吃 eventActions 全量；
  // 老 axes 无该字段时退回代表步（弱判据，照实提示）。
  const bad = [];
  let total = 0;
  let sawEventActions = true;
  for (const s of axes.steps || []) {
    const evs = Array.isArray(s.eventActions) && s.eventActions.length
      ? s.eventActions
      : (sawEventActions = false, [{ stepId: s.stepId, action: s.action }]);
    for (const ea of evs) {
      total++;
      if (!ea.action || ea.action.resolution !== 'unique') bad.push({ stepId: ea.stepId, intentId: s.intentId, resolution: ea.action && ea.action.resolution });
    }
  }
  if (bad.length) {
    console.error(`compile --verify: ${bad.length} 步未过点击身份门（回放核验红，G1 判据）：`);
    for (const b of bad) console.error(`  - ${b.stepId}（intent=${b.intentId}）resolution=${b.resolution}（ambiguous/失配雷点 → route:human）`);
    process.exit(1);
  }
  if (!sawEventActions) console.error('compile --verify: 注意——axes 无 eventActions 字段，只核验了 intent 代表步（弱判据）');
  console.log(`compile --verify: ${total} 步动作轴全 unique——events 可加载、可回放、点击身份门全过`);
  process.exit(0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.pos[0];
  if (!caseId) { console.error('compile: 缺 <caseId>'); process.exit(64); }
  // caseId 进产物文件名（flow-/observed-<caseId>.json）——限路径安全字符，拒 / .. 等穿越形态
  // （fail-closed；镜像 bin/draft.mjs R1-F2 先例，draft-cli 评审挖出的同型缝）。
  if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('compile: caseId 含非法字符（仅限字母数字_-；原值不回显——CLI 参数在凭据门扫描面外）'); process.exit(65); }
  if (args.verify) {
    for (const k of ['sut', 'out-dir', 'profile']) if (typeof args[k] !== 'string' || !args[k]) { console.error(`compile --verify: 缺 --${k}`); process.exit(64); }
    return verifyMode(caseId, args);
  }
  if (args.execute) {
    for (const k of ['sut', 'out-dir', 'profile', 'testcase']) if (!args[k]) { console.error(`compile --execute: 缺 --${k}`); process.exit(64); }
    return executeMode(caseId, args);
  }
  for (const k of ['testcase', 'flow', 'out-dir']) if (!args[k]) { console.error(`compile: 缺 --${k}（闸段用法：--testcase <f> --flow <f> --out-dir <d>）`); process.exit(64); }
  return gateMode(caseId, args);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error('compile 失败：' + String((e && e.message) || e).slice(0, 300)); process.exit(1); }); // 剥栈（output-seal B7）
