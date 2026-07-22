// agent-id-readback.chat-sut.golden.mjs —— 五场景浏览器配方金牌（chat-sut hermetic，红先行）。
// 阶段 2 门禁：本文件是规格，lib/bin 实现随后按它走（ATDD 红先行）。判据权威：
// docs/plans/agent-id-readback/plan.md §2/§5（双证门 + 编译接线）、§6（chat-sut 五场景）、§7 验收点 5；
// accept/interface-spec.md §3（剖面 agents.listApi 声明）、§4（身份观察件）、§6（夹具场景语义）。
// 治理定位（plan §6，Steven 2026-07-22 拍板范围化例外）：本金牌以新增非隔离义务身份进本契约 prd
// acceptance，不入 isolated-browser-obligations.json 冻结闭集；完成闸仍=真机（ADR-0009），
// 本金牌只证 hermetic 配方。
//
// 现状病灶（红先行基线）：compileAgentSearchOpen（lib/compile-atoms.mjs）只有 DOM 共享门
// （resolveAgentSearchTarget 精确锚+容器归属），无信封双证门——DOM 唯一即点，信封里的同名隐行/
// 码错配/分页缺页全部看不见；也不产身份观察件。故今日预期：
//   C1 idhappy         红（click 事件有、身份观察件 identity-observations.compile.json 不存在）；
//   C2 idtwins-hidden  红（DOM 只渲一卡、信封两行同名——旧实现 DOM 唯一即点，exit 0 落 events）；
//   C3 idcode-mismatch 红（params.code 给期望码、信封码不同——旧实现看不见信封码，照点）；
//   C4 idmissing       今日可能绿：fetch 500 → 夹具渲零卡片 → 旧 DOM 门 absent 恰好硬阻断。
//                      绿因与信封门无关但断言面等价（声明剖面下必须硬阻断——实现后仍必须挡）；
//                      红证如实注明，不冒充红。
//   C5 idpaged         红（total=2 单页一行——完整性先决失败须硬阻断，旧实现 DOM 唯一即点）。
// 整体今日应 exit 1（至少四红）。
//
// codex R1 修复钉追加（2026-07-22 修单，checksumAmendments 记账）：
//   C6  真实 compile→sign→replay 闭环（R1-C1）：draft 必须 v2+双 digest、sign 对真实产物过账、
//       冻结锁携三元组、回放点击前对已签 platformId 比对放行；
//   C7  真 v1 件+声明身份通道的新剖面（idtwins-sync 确定性考场：同步渲卡+信封两行同名）→
//       固定旧 DOM-only 路径（R1-M3 版本语义；82484ab 上守恒绿、M3 失守必 ambiguous 红）；
//   C8  伪造 evidenceStepId 错位 v2 锁 → 目标 click 缺已签三元组必须 action_failed（R1-H5）；
//   C9  iddom-skew DOM 假码 → 物理卡片 code 锚必拒（R1-H1）；
//   C10 idpaged-dupdom 完整性失败+DOM 双卡 → action_failed 非 ambiguous（R1-M2 判定序）；
//   C1 追加 fill=openName 义务断言（R1-H2）；C2-C5/C9/C10 追加结构化 compile-report.identityGate
//   类别断言（类别机器可判；「不钉 blocker 文案」裁量保持）。
//
// 断言纪律（护栏 #14/#15）：只认退出码与结构化字段（events 文档、compile-report.blockers、
// 观察件字段）；不 grep 失败标记串；三元组断言用【精确】等值不许 includes。
//
// 裁量申报（accept 期，interface-spec §8 追加）：剖面 agents.itemContainer 取 '.agent-card'——
// interface-spec §3 示例与 chat-sut id* 夹具渲染容器同款（tests/fixtures/chat-sut/server.mjs
// idListPage：card.className='agent-card'）；'.agent-item' 是旧 LIST_PAGE 容器，id* 场景不在场，
// 用它会让 idhappy 在 DOM 缺席处永久红（金牌不可满足）。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startChatSut } from '../fixtures/chat-sut/server.mjs';
import {
  requiredFlowEntityBindings,
  calculateIdentityAdmissionSignature,
  hashIdentityAdmissionBytes,
} from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const AGENT_NAME = '互联网问诊-主诉';
const EXPECT_CODE = 'AG-IM-001'; // 夹具 ID_AGENT_MAIN.agentCode（idcode-mismatch 场景服务端回 AG-WRONG-999）
const PLATFORM_ID = '1234567890123456789'; // 夹具 ID_AGENT_MAIN.agentId：19 位纯数字 string（无损义务）

const tmp = mkdtempSync(join(tmpdir(), 'casey-agentid-chat-'));
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n'); // 合成隔离 site.json：绝不触真凭据（.auth/site.json 是凭据，不进任何输入）
const run = (args, timeout = 120000) => spawnSync(process.execPath, args, {
  encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE },
});
const rj = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wj = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; console.log(`ok   agent-id-readback.chat-sut: ${name}`); } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }

// 通道剖面（非凭据）：interface-spec §3 的 agents.listApi 身份通道声明 + 既有 chat 剖面键。
const PROFILE = wj(join(tmp, 'profile.json'), {
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/', agentList: '/agent/list' },
  chat: { streamUrlPattern: '/ai-api/tester/agent/stream', replySelector: '.hr-chat__text__assistant' },
  agents: {
    itemContainer: '.agent-card', // 裁量申报见头注：chat-sut id* 夹具容器（interface-spec §3 示例同款）
    cardFields: { name: '.agent-card__name', code: '.agent-card__code' }, // 物理卡片双锚（codex R1-H1）
    listApi: {
      pathname: '/api/agents/query',
      method: 'GET',
      queryParam: 'nameLike', // 查询回声判据（codex R1-H2）
      recordsPath: 'data.records',
      totalPath: 'data.total',
      hasNextPath: null,
      fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
    },
  },
});
// v1 兼容链专用旧式剖面（无 agents.listApi 身份声明；C7 用）：编译产 v1 件、DOM-only 门。
const LEGACY_PROFILE = wj(join(tmp, 'profile-legacy.json'), {
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/', agentList: '/agent/list' },
  chat: { streamUrlPattern: '/ai-api/tester/agent/stream', replySelector: '.hr-chat__text__assistant' },
  agents: { itemContainer: '.agent-card' },
});

// ── 编译闸段助手（同 searchopen 金牌模式；caseId 前缀 tc_agentid_ 避免与既有金牌撞 prd 路径）──
function gateCompile(tag, params) {
  const caseId = `tc_agentid_${tag}`;
  const od = join(tmp, tag); mkdirSync(od, { recursive: true });
  const tc = wj(join(tmp, `tc-${tag}.json`), {
    schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
    intents: [{ intentId: 'intent_nav', text: '进入智能体管理' }, { intentId: 'intent_open', text: '搜索并打开智能体（信封双证）' }],
  });
  const flow = wj(join(tmp, `flow-${tag}.json`), {
    id: caseId, name: `agent-id-readback ${tag}`, category: 'normal',
    steps: [
      // 预执行门口径（同 searchopen 金牌）：nav.agentManagement 与 agent.searchOpen 默认按 mutation
      // 处理 → 每步携 sourceIntentId + subject 绑定（闭合绑定集覆盖全部 mutation 口径步）。
      {
        atom: 'nav.agentManagement', params: {}, sourceIntentId: 'intent_nav',
        entityBindings: [{ candidateId: 'candidate-agent-list', role: 'subject' }],
      },
      {
        atom: 'agent.searchOpen', params, sourceIntentId: 'intent_open',
        entityBindings: [{ candidateId: 'candidate-agent-main', role: 'subject' }],
      },
    ],
  });
  const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
  return { caseId, od, tc, g };
}

// ── execute 权威铸造（生产接缝消费者，抄 searchopen 金牌 mintExecuteAuthority + 临时 prd wx + finally）──
function mintExecuteAuthority({ caseId, confirmedFlowPath, testcasePath }) {
  const flowBytes = readFileSync(confirmedFlowPath);
  const tcBytes = readFileSync(testcasePath);
  const doc = JSON.parse(flowBytes.toString('utf8'));
  const bindings = requiredFlowEntityBindings(doc.flow);
  if (!bindings || !bindings.length) throw new Error('execute 权威铸造失败：flow 闭合绑定集投影为空（步骤缺 sourceIntentId/entityBindings）');
  const artifact = {
    schemaVersion: 1, artifactKind: 'entity-pre-execution-authority', authorizedFor: 'compile-execute',
    caseId, signed: true, signerId: 'golden-human', signedAt: '2026-07-22T00:00:00.000Z', audience: 'test',
    flowSha256: hashIdentityAdmissionBytes(flowBytes), testcaseSha256: hashIdentityAdmissionBytes(tcBytes),
    bindings,
  };
  artifact.signature = calculateIdentityAdmissionSignature(artifact);
  const scratchRoot = `.golden-scratch-agentid-${randomUUID().slice(0, 8)}`;
  const scratchDir = join(ROOT, scratchRoot, caseId);
  const authorityPath = join(scratchDir, 'execute-authority.json');
  const text = JSON.stringify(artifact, null, 2) + '\n';
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  const artifactKey = `${scratchRoot}/${caseId}/execute-authority.json`;
  // 临时 prd 以 wx 先行独占创建（同名已存在即抛、零残留）；散置写入失败即回滚 prd 再抛。
  writeFileSync(prdPath, JSON.stringify({
    schemaVersion: 2, caseId, task: 'agent-id-readback chat-sut 金牌临时授权（finally 清理）',
    testChecksums: { [artifactKey]: createHash('sha256').update(text).digest('hex') }, stories: [],
  }, null, 2) + '\n', { flag: 'wx' });
  try {
    mkdirSync(scratchDir, { recursive: true });
    writeFileSync(authorityPath, text);
  } catch (e) {
    rmSync(join(ROOT, scratchRoot), { recursive: true, force: true });
    rmSync(prdPath, { force: true });
    throw e;
  }
  return {
    authorityPath,
    cleanup() {
      rmSync(join(ROOT, scratchRoot), { recursive: true, force: true });
      rmSync(prdPath, { force: true });
    },
  };
}

// ── 场景整链：闸段 → 人签 confirm → 权威铸造 → execute（finally 关服务器 + 清临时 prd）──
async function runIdScenario({ tag, scenario, params, profile = PROFILE }) {
  const { caseId, od, tc, g } = gateCompile(tag, params);
  if (g.status !== 0) throw new Error(`阶段[编译闸]：flow 应过闸 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-240)}`);
  const fd = rj(join(od, `flow-${caseId}.json`)); fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-22T00:00:00.000Z';
  wj(join(od, `flow-${caseId}.json`), fd);
  const sut = await startChatSut({ scenario });
  let authority = null;
  try {
    authority = mintExecuteAuthority({ caseId, confirmedFlowPath: join(od, `flow-${caseId}.json`), testcasePath: tc });
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sut.url, '--out-dir', od, '--profile', profile, '--skip-login', '--unique-name', tag, '--entity-authority', authority.authorityPath]);
    return { caseId, od, tc, x };
  } finally {
    if (authority) authority.cleanup();
    await sut.close();
  }
}

// 硬阻断共同断言面（C2/C3/C4/C5/C9/C10）：非零退出 + 不落 events.json（无 click event）+ 诊断报告
// blockers 非空 + 结构化双证裁定类别（compile-report.identityGate，codex R1-M2 断言面——类别机器可判，
// 不 grep blocker 文案）。
async function expectHardBlock({ tag, scenario, params, why, gateResolution }) {
  const { od, x } = await runIdScenario({ tag, scenario, params });
  if (x.status === 0) throw new Error(`阶段[execute]：${why}——应硬阻断非零退出，实际 exit 0（旧 DOM-only 门被骗放行点击）`);
  if (existsSync(join(od, 'events.json'))) throw new Error(`阶段[execute]：硬阻断路径不得落 events.json（含 click event 的成功产物；exit ${x.status}）`);
  const rp = join(od, 'compile-report.json');
  if (!existsSync(rp)) throw new Error(`阶段[execute]：硬阻断应落诊断 compile-report.json（blockers 依据），实际缺失（exit ${x.status}：${(x.stderr || '').slice(-200)}）`);
  const report = rj(rp);
  if (!Array.isArray(report.blockers) || report.blockers.length === 0) {
    throw new Error(`阶段[execute]：compile-report.blockers 应非空（硬阻断证据），实际 ${JSON.stringify(report.blockers)}`);
  }
  if (gateResolution) {
    if (!report.identityGate || report.identityGate.resolution !== gateResolution) {
      throw new Error(`阶段[execute]：compile-report.identityGate.resolution 应【精确】'${gateResolution}'（${why}），实际 ${JSON.stringify(report.identityGate)}`);
    }
  }
}

// ── C1 idhappy：声明剖面下编译产出 click event 且落身份观察件（现红：观察件不存在）──
// searchKeyword 给诱饵（codex R1-H2 修复钉）：身份通道声明时完整性查询必须固定 openName——
// fill 事件 value 必须是 openName 而不是 searchKeyword/code。
await checkAsync('C1 idhappy 名码唯一命中 → execute exit 0 + click event + fill=openName + 身份观察件', async () => {
  const { od, x } = await runIdScenario({ tag: 'idhappy', scenario: 'idhappy', params: { searchKeyword: '诱饵关键词不得进搜索框', openName: AGENT_NAME } });
  if (x.status !== 0) throw new Error(`阶段[execute]：应 exit 0（信封唯一放行），实际 ${x.status}：${(x.stderr || '').slice(-240)}`);
  const ev = rj(join(od, 'events.json'));
  const clickEv = (ev.events || []).find((e) => e.atom === 'agent.searchOpen' && e.action === 'click');
  if (!clickEv) throw new Error('events 缺 agent.searchOpen click 事件（双证 unique 应放行点击）');
  const fillEv = (ev.events || []).find((e) => e.atom === 'agent.searchOpen' && e.action === 'fill');
  if (!fillEv || fillEv.value !== AGENT_NAME) {
    throw new Error(`身份通道下 fill 值应【精确】openName「${AGENT_NAME}」（完整性查询固定名称，codex R1-H2），实际 ${JSON.stringify(fillEv && fillEv.value)}`);
  }
  const obsPath = join(od, 'identity-observations.compile.json');
  if (!existsSync(obsPath)) throw new Error('身份观察件 identity-observations.compile.json 未落盘（plan §5：unique 落观察件——现实现无信封门，红先行）');
  const obs = rj(obsPath);
  if (obs.artifactKind !== 'compile-identity-observation') throw new Error(`观察件 artifactKind 应精确 'compile-identity-observation'（interface-spec §4），实际 ${JSON.stringify(obs.artifactKind)}`);
  const rows = Array.isArray(obs.observations) ? obs.observations.filter((o) => o && o.kind === 'agent') : [];
  if (rows.length !== 1) throw new Error(`observations 应恰一条 agent 观察（join 只对终端 click binding，plan §4），实际 ${rows.length} 条`);
  const o = rows[0];
  if (o.name !== AGENT_NAME || o.code !== EXPECT_CODE || o.platformId !== PLATFORM_ID) {
    throw new Error(`观察三元组应【精确】{name:「${AGENT_NAME}」, code:「${EXPECT_CODE}」, platformId:「${PLATFORM_ID}」(无损 string)}，实际 ${JSON.stringify({ name: o.name, code: o.code, platformId: o.platformId })}`);
  }
});

// ── C2 idtwins-hidden：DOM 只渲一卡、信封两行同名 → 必须硬阻断（现红：旧实现 DOM 唯一即点）──
await checkAsync('C2 idtwins-hidden DOM 假唯一·信封两行同名 → 硬阻断（blockers 非空、无 click event）', async () => {
  await expectHardBlock({
    tag: 'idtwins', scenario: 'idtwins-hidden',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME },
    why: '完整信封内 sameName=2（DOM 只渲一卡是假唯一，plan §2：先数同名再查唯一行）',
    gateResolution: 'ambiguous',
  });
});

// ── C3 idcode-mismatch：params.code 给期望码、信封码不同 → 硬阻断（现红：旧实现看不见信封码）──
await checkAsync('C3 idcode-mismatch 期望码≠信封码 → 硬阻断（blockers 非空、无 click event）', async () => {
  await expectHardBlock({
    tag: 'idcode', scenario: 'idcode-mismatch',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME, code: EXPECT_CODE },
    why: `期望 code=${EXPECT_CODE} 而信封行 code=AG-WRONG-999（唯一行联合判据任一不等=action_failed，plan §2 表）`,
    gateResolution: 'action_failed',
  });
});

// ── C4 idmissing：API 500 → 声明剖面下必须硬阻断 ──
// 注意（红证如实注明）：今日此检查可能绿——夹具 fetch 500 后渲零卡片，旧 DOM 门 absent 恰好硬阻断；
// 绿因与信封门无关（信封 action_failed 语义未实现），但断言面等价、实现后仍必须保持挡住。
await checkAsync('C4 idmissing API 500 → 硬阻断（blockers 非空、无 click event；今日或因 DOM absent 恰好绿，见头注）', async () => {
  await expectHardBlock({
    tag: 'idmissing', scenario: 'idmissing',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME },
    why: 'HTTP 500——事务无合格成功响应（plan §2 表：HTTP·API 失败=action_failed）',
    gateResolution: 'action_failed',
  });
});

// ── C5 idpaged：total=2 单页一行 → 完整性先决失败硬阻断（现红：旧实现 DOM 唯一即点）──
await checkAsync('C5 idpaged total=2 单页一行 → 完整性先决失败硬阻断（blockers 非空、无 click event）', async () => {
  await expectHardBlock({
    tag: 'idpaged', scenario: 'idpaged',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME },
    why: 'total(2)!==records.length(1)——完整性先决未过=action_failed 不是 ambiguous（plan §2 R2-2 统一口径）',
    gateResolution: 'action_failed',
  });
});

// ══ C6-C10：codex R1 修复钉（真实闭环 + 判定序 + 版本语义 + 双锚）══════════════════════
const SIGN = join(ROOT, 'bin', 'sign.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');

// 三轴内按 stepId 查动作裁定（bin/replay.mjs axes = { caseId, steps[].eventActions[].action }）。
function findAxesAction(axes, stepId) {
  for (const s of axes.steps || []) {
    for (const ea of s.eventActions || []) if (ea.stepId === stepId) return ea.action;
  }
  return null;
}

// 真实 compile 产物 → sign（ROOT 内 scratch，路径安全同 sign 金牌）→ 可选伪造 → 供 replay 消费。
// 返回句柄含 cleanup（prd + scratch 目录）；调用侧 finally 必调。
function signCompiledCase({ caseId, od, withObservations, againstBuild = 'chat-sut-id-1' }) {
  const scratchRoot = `.golden-scratch-agentid-chain-${randomUUID().slice(0, 8)}`;
  const dir = join(ROOT, scratchRoot, caseId);
  mkdirSync(dir, { recursive: true });
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  writeFileSync(prdPath, JSON.stringify({ schemaVersion: 1, caseId, task: 'agent-id-readback C6-C8 全链金牌临时 prd（finally 清理）', testChecksums: {}, stories: [] }, null, 2) + '\n', { flag: 'wx' });
  const cleanup = () => {
    rmSync(join(ROOT, scratchRoot), { recursive: true, force: true });
    rmSync(prdPath, { force: true });
  };
  try {
    // 复制真实 compile 产物入 ROOT scratch（sign 产物路径安全面要求 ROOT 内相对路径）。
    const eventsPath = join(dir, 'events.json');
    writeFileSync(eventsPath, readFileSync(join(od, 'events.json')));
    const bindingsPath = join(dir, 'entity-bindings.draft.json');
    writeFileSync(bindingsPath, readFileSync(join(od, 'entity-bindings.draft.json')));
    let obsPath = null;
    if (withObservations) {
      obsPath = join(dir, 'identity-observations.compile.json');
      writeFileSync(obsPath, readFileSync(join(od, 'identity-observations.compile.json')));
    }
    const eventsDoc = rj(eventsPath);
    const intents = [...new Set((eventsDoc.events || []).map((e) => e.intentId))];
    const draftPath = wj(join(dir, 'expected.draft.json'), {
      caseId, intents: intents.map((intentId) => ({ intentId, expected: [{ kind: 'textVisible', op: 'appears', value: '测试' }] })), pending: [],
    });
    const bindings = rj(bindingsPath);
    const receipt = createEntityLockReceipt({
      lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
      expected: { name: AGENT_NAME, code: EXPECT_CODE },
      observed: { name: AGENT_NAME, code: EXPECT_CODE, platformId: PLATFORM_ID },
      source: 'user-confirmed',
    });
    const confirmationsPath = wj(join(dir, 'entity-confirmations.json'), {
      caseId,
      confirmations: (bindings.bindings || []).map((b) => ({
        stepId: b.stepId, intentId: b.intentId, atom: b.atom,
        sourceIntentId: b.sourceIntentId, candidateId: b.candidateId, role: b.role, receipt,
      })),
    });
    const frozenPath = join(dir, 'expected.frozen.json');
    const locksPath = join(dir, 'entity-locks.frozen.json');
    const argv = [SIGN, caseId,
      '--draft', draftPath, '--prd', prdPath, '--frozen-out', frozenPath,
      '--signer', 'golden-human', '--against-build', againstBuild, '--signed-at', '2026-07-22T08:00:00.000Z',
      '--events', eventsPath, '--entity-bindings-draft', bindingsPath,
      '--entity-confirmations', confirmationsPath, '--entity-locks-out', locksPath,
      '--audience', 'test'];
    if (withObservations) argv.push('--entity-observations', obsPath);
    const s = spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8' });
    return { s, prdPath, eventsPath, frozenPath, locksPath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}

async function replaySignedCase({ scenario, eventsPath, frozenPath, locksPath, outDir }) {
  const sut = await startChatSut({ scenario });
  try {
    const axesPath = join(outDir, `axes-${scenario}.json`);
    const r = run([REPLAY, '--events', eventsPath, '--sut', sut.url, '--expected', frozenPath,
      '--profile', PROFILE, '--entity-locks', locksPath, '--out', axesPath]);
    return { r, axesPath };
  } finally {
    await sut.close();
  }
}

// ── C6 真实闭环（codex R1-C1 修复钉）：compile 产 v2 草稿+双 digest → 真实 sign 过账 →
// 冻结锁携三元组 → replay 点击前对已签比对放行（今日红：compile 产 v1、sign v2 路径不激活）──
await checkAsync('C6 idhappy 真实 compile→sign→replay 闭环：draft v2+双 digest、sign exit 0、frozen v2 携三元组、replay 点击 unique', async () => {
  const { caseId, od, x } = await runIdScenario({ tag: 'idchain', scenario: 'idhappy', params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME } });
  if (x.status !== 0) throw new Error(`阶段[execute]：应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-240)}`);
  const draft = rj(join(od, 'entity-bindings.draft.json'));
  if (draft.schemaVersion !== 2) throw new Error(`真实 compile 草稿应 schemaVersion=2（codex R1-C1：v2 不接线则 platformId 进不了签署闭环），实际 ${JSON.stringify(draft.schemaVersion)}`);
  const obsBytes = readFileSync(join(od, 'identity-observations.compile.json'));
  const wantObsSha = 'sha256:' + createHash('sha256').update(obsBytes).digest('hex');
  if (draft.identityObservationsSha256 !== wantObsSha) throw new Error(`v2 草稿 identityObservationsSha256 未绑观察件原始字节：${JSON.stringify(draft.identityObservationsSha256)} ≠ ${wantObsSha}`);
  if (typeof draft.identityProfileDigest !== 'string' || !draft.identityProfileDigest.startsWith('sha256:')) throw new Error(`v2 草稿缺 identityProfileDigest：${JSON.stringify(draft.identityProfileDigest)}`);
  const chain = signCompiledCase({ caseId, od, withObservations: true });
  try {
    if (chain.s.status !== 0) throw new Error(`真实产物 sign 应 exit 0（v2 对账全过），实际 ${chain.s.status}：${(chain.s.stderr || '').slice(-240)}`);
    const frozen = rj(chain.locksPath);
    if (frozen.schemaVersion !== 2) throw new Error(`冻结锁应 v2，实际 ${JSON.stringify(frozen.schemaVersion)}`);
    const row = (frozen.identityObservations || [])[0];
    if (!row || row.platformId !== PLATFORM_ID) throw new Error(`冻结锁三元组未携平台 ID：${JSON.stringify(row)}`);
    const clickEv = (rj(chain.eventsPath).events || []).find((e) => e.atom === 'agent.searchOpen' && e.action === 'click');
    const { r, axesPath } = await replaySignedCase({ scenario: 'idhappy', eventsPath: chain.eventsPath, frozenPath: chain.frozenPath, locksPath: chain.locksPath, outDir: od });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-240)}`);
    const action = findAxesAction(rj(axesPath), clickEv.stepId);
    if (!action || action.resolution !== 'unique') throw new Error(`回放点击步应 unique（对已签 platformId 比对放行），实际 ${JSON.stringify(action)}`);
  } finally { chain.cleanup(); }
});

// ── C7 v1 版本语义（codex R1-M3 修复钉）：真 v1 件 + 声明身份通道的新剖面 → 固定旧 DOM-only 路径
// （82484ab 守恒绿；R1 候选的坏代码剖面声明即建账本，v1 回放被未签信封门改判 ambiguous 必红）──
await checkAsync('C7 v1 件+新剖面 idtwins-sync 回放：走旧 DOM-only 路径点击 unique（剖面不得反向改变版本语义）', async () => {
  const { caseId, od, x } = await runIdScenario({ tag: 'v1chain', scenario: 'idhappy', params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME }, profile: LEGACY_PROFILE });
  if (x.status !== 0) throw new Error(`阶段[execute v1]：应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-240)}`);
  const draft = rj(join(od, 'entity-bindings.draft.json'));
  if (draft.schemaVersion !== 1) throw new Error(`旧式剖面编译应产 v1 草稿，实际 ${JSON.stringify(draft.schemaVersion)}`);
  const chain = signCompiledCase({ caseId, od, withObservations: false });
  try {
    if (chain.s.status !== 0) throw new Error(`v1 sign 应 exit 0，实际 ${chain.s.status}：${(chain.s.stderr || '').slice(-240)}`);
    const clickEv = (rj(chain.eventsPath).events || []).find((e) => e.atom === 'agent.searchOpen' && e.action === 'click');
    // 考场=idtwins-sync（确定性双向）：页面按键【同步】渲一张主卡（旧 DOM-only 门确定性 unique——
    // 回放 press→click 零等待，fetch 渲染页对旧门有固有竞态，gate 首轮 C7 的 none 红即此，非 M3 信号）
    // + 照发 fetch 且信封仍两行同名（M3 失守的坏代码消费未签信封必 ambiguous，一击必红，信号零弱化）。
    const { r, axesPath } = await replaySignedCase({ scenario: 'idtwins-sync', eventsPath: chain.eventsPath, frozenPath: chain.frozenPath, locksPath: chain.locksPath, outDir: od });
    if (r.status !== 0) throw new Error(`v1 回放应 exit 0（旧路径零行为差），实际 ${r.status}：${(r.stderr || '').slice(-240)}`);
    const action = findAxesAction(rj(axesPath), clickEv.stepId);
    if (!action || action.resolution !== 'unique') {
      throw new Error(`v1 件回放应按旧 DOM-only 门 unique（同步渲染恰一卡，零时序赌局），实际 ${JSON.stringify(action)}${action && (action.resolution === 'ambiguous' || action.resolution === 'action_failed') ? '（v1 被未签信封门改判=版本语义被剖面反向改变，M3 失守）' : ''}`);
    }
  } finally { chain.cleanup(); }
});

// ── C8 已签三元组硬先决（codex R1-H5 修复钉）：伪造 evidenceStepId 错位的 v2 锁（内容自哈希可重算，
// ADR-0010 威胁边界内的合法构造）→ 目标 click 缺 signed 期望必须 action_failed，绝不按首采模式续跑
// （今日红：缺签即静默走首采、点击 unique）──
await checkAsync('C8 伪造锚错位 v2 锁回放：目标 click 缺已签三元组 → action_failed 不点击', async () => {
  const { caseId, od, x } = await runIdScenario({ tag: 'idforge', scenario: 'idhappy', params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME } });
  if (x.status !== 0) throw new Error(`阶段[execute]：应 exit 0，实际 ${x.status}：${(x.stderr || '').slice(-240)}`);
  const chain = signCompiledCase({ caseId, od, withObservations: true });
  try {
    if (chain.s.status !== 0) throw new Error(`sign 应 exit 0，实际 ${chain.s.status}：${(chain.s.stderr || '').slice(-240)}`);
    // 伪造：三元组锚移到不存在的 step，重算内容自哈希 + 重钉 prd checksum（golden 自有临时 prd）。
    const locks = rj(chain.locksPath);
    locks.identityObservations = [{ ...locks.identityObservations[0], evidenceStepId: 'atstep_999' }];
    delete locks.signature;
    locks.signature = calculateIdentityAdmissionSignature(locks);
    const forgedText = JSON.stringify(locks, null, 2) + '\n';
    writeFileSync(chain.locksPath, forgedText);
    const prd = rj(chain.prdPath);
    const oldKey = Object.keys(prd.testChecksums).find((k) => k.endsWith('entity-locks.frozen.json'));
    if (!oldKey) throw new Error('夹具自身红：sign 未在临时 prd 注册 locks checksum');
    prd.testChecksums[oldKey] = createHash('sha256').update(forgedText).digest('hex');
    wj(chain.prdPath, prd);
    const clickEv = (rj(chain.eventsPath).events || []).find((e) => e.atom === 'agent.searchOpen' && e.action === 'click');
    const { r, axesPath } = await replaySignedCase({ scenario: 'idhappy', eventsPath: chain.eventsPath, frozenPath: chain.frozenPath, locksPath: chain.locksPath, outDir: od });
    if (r.status !== 0) throw new Error(`replay 本体应 exit 0（步级 fail-safe 落轴，不裁定），实际 ${r.status}：${(r.stderr || '').slice(-240)}`);
    const action = findAxesAction(rj(axesPath), clickEv.stepId);
    if (!action || action.resolution !== 'action_failed') throw new Error(`缺已签三元组的 click 应 action_failed（禁按首采模式续跑），实际 ${JSON.stringify(action)}`);
  } finally { chain.cleanup(); }
});

// ── C9 iddom-skew（codex R1-H1 修复钉）：信封正常、DOM 卡片副标题假码 → 物理卡片 code 锚必拒 ──
await checkAsync('C9 iddom-skew DOM 假码 → 硬阻断 action_failed（物理卡片双锚：DOM code 必读必比）', async () => {
  await expectHardBlock({
    tag: 'iddomskew', scenario: 'iddom-skew',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME },
    why: 'DOM 卡片副标题 AG-DOM-999 ≠ 信封码 AG-IM-001（dom.code 必须从同一物理卡片读出并比对，name 单锚必被骗）',
    gateResolution: 'action_failed',
  });
});

// ── C10 idpaged-dupdom（codex R1-M2 修复钉）：信封完整性失败叠加 DOM 双卡 → 必须 action_failed 不是 ambiguous ──
await checkAsync('C10 idpaged-dupdom 完整性失败+DOM 双卡 → action_failed（完整性先决优先于 DOM 分类，判定序不得倒置）', async () => {
  await expectHardBlock({
    tag: 'idpageddup', scenario: 'idpaged-dupdom',
    params: { searchKeyword: AGENT_NAME, openName: AGENT_NAME },
    why: 'total(2)!==records.length(1) 完整性先决未过；DOM 同名双卡只是伴随噪声，绝不得洗成 ambiguous',
    gateResolution: 'action_failed',
  });
});

if (fails.length) {
  for (const f of fails) console.error(`RED  agent-id-readback.chat-sut: ${f}`);
  console.error(`RED  agent-id-readback.chat-sut: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   agent-id-readback.chat-sut: ${pass}/${pass} 全过（五场景信封双证门 + 身份观察件）`);
process.exit(0);
