// entity-ui-wiring.searchopen.golden.mjs —— 语义锁 UI 接线 W1（agent.searchOpen 收紧 + 编码收敛）验收金牌。
// 阶段 2 门禁：本文件是规格，lib/bin 实现随后按它走（ATDD 红先行）。决策依 docs/plans/entity-ui-wiring/plan.md
// 的 W1 与验收点 A1/A2/A3。今日（未实现前）全部 A1/A2/A3 断言必红；A0 加法守恒控制面今日即绿。
//
// 现状病灶（lib/compile-atoms.mjs:1102-1111 compileAgentSearchOpen）：点击锚 {kind:'text', name:openName,
// exact:false} 是子串命中——openName 是某条目名的子串/前缀时（plan 病灶例：「主诉」命中「互联网问诊-主诉」）
// exact:false 会子串唯一命中并点下去（假绿：开错对象却判成功）；且无编码（code）输入通道；且条目定位+容器
// 归属闸没有抽成编译与回放共享的单一 helper（回放侧无专用门，落通用兜底）。
//
// 目标态（本金牌钉死，实现须满足）：
//  A1 联合定位收紧——共享门 lib/agent-search-gate.mjs 导出 resolveAgentSearchTarget(page, {openName,
//     containerSelector='.agent-item'})，精确锚（exact:true，绝不子串）+ 容器归属闸，返回结构化裁定
//     { resolution: 'unique'|'ambiguous'|'absent'|'container-out', candidateCount }：
//       · 唯一且落在条目容器内 → 'unique'（candidateCount 1，照常打开——对照面）；
//       · 同名双条目（多匹配）→ 'ambiguous'（candidateCount 2，硬阻断，绝不点 first）；
//       · openName 只是某条目子串（exact:true 零命中）→ 'absent'（旧面 exact:false 假绿被杀）；
//       · 命中落在条目容器外 → 非 'unique'（容器归属闸 fail-closed）。
//  A2 编码收敛——registry agent.searchOpen 补 code 可选参数；编译门放行带 code 的 flow；code 在场时搜索框
//     fill 事件 value【精确】等于 code。
//  A3 编译门=回放门同刻——lib/compile-atoms.mjs 与 lib/replay-actions.mjs 都 import './agent-search-gate.mjs'
//     （共享门单一事实源），且该文件在场。
//
// 断言纪律（护栏 #14/#15）：只认退出码与结构化字段（events 文档、compile-report.blockers、门 resolution、
// registry 结构、源码 import 结构）；不 grep 失败标记串；同名/编码断言用【精确】等值不许 includes。
//
// 基线实况：dev 基线上 entity-semantic-lock 预执行门把未登记为 read 的 agent 原子（nav.agentManagement /
// agent.searchOpen）按默认 mutation 处理——既有 chiefcomplaint-smoke 金牌因此现为 5 过/7 红。这与 W1 正交：
// A1 行为面在「共享门直连真实 Playwright DOM」这一层验（compile/回放消费门的同一层、门下面）。A2-event 走
// 整链：flow 步骤携 sourceIntentId + subject entityBindings，并按生产接缝铸造 entity-pre-execution-authority
// 工件（确定性签名 + 临时 prd checksum 发布 + --entity-authority 指入），合法过预执行门——不动人签冻结的
// admission policy 镜像（准入门语义零改动，本金牌只当消费者）。故 A2-event 的绿只依赖 W1（code 参数落地）；
// 今日在编译门「未声明参数 code」处红。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import pw from '@playwright/test';
import { startChatSut } from '../fixtures/chat-sut/server.mjs';
import {
  requiredFlowEntityBindings,
  calculateIdentityAdmissionSignature,
  hashIdentityAdmissionBytes,
} from '../../lib/entity-semantic-lock-preflight.mjs';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const GATE_MODULE = join(ROOT, 'lib', 'agent-search-gate.mjs');
const COMPILE_ATOMS_SRC = join(ROOT, 'lib', 'compile-atoms.mjs');
const REPLAY_ACTIONS_SRC = join(ROOT, 'lib', 'replay-actions.mjs');
const SNAPSHOT = join(ROOT, 'lib', 'atoms-registry.snapshot.json');
const AGENT_NAME = '互联网问诊-主诉';

const tmp = mkdtempSync(join(tmpdir(), 'casey-eui-searchopen-'));
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n'); // 合成隔离 site.json：绝不触真凭据（.auth/site.json 是凭据，不进任何输入）
const run = (args, timeout = 120000) => spawnSync(process.execPath, args, {
  encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE },
});
const rj = (p) => JSON.parse(readFileSync(p, 'utf8'));
const wj = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };

const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-360)}`); } }
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-360)}`); } }

// 通道剖面（非凭据）：agentList 路由导航优先（同 chiefcomplaint-smoke）。
const PROFILE = wj(join(tmp, 'profile.json'), {
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/', agentList: '/agent/list' },
  chat: { streamUrlPattern: '/ai-api/tester/agent/stream', replySelector: '.hr-chat__text__assistant' },
});

// 共享门动态载入（今日缺失→null；每条 A1/A3 据此红，绝不让缺模块把整轮 import 崩掉）。
const gateMod = await import(`file://${GATE_MODULE.replace(/\\/g, '/')}`).catch(() => null);
function gateFn() {
  const fn = gateMod && gateMod.resolveAgentSearchTarget;
  if (typeof fn !== 'function') throw new Error('共享门 lib/agent-search-gate.mjs 未落地或未导出 resolveAgentSearchTarget(page,{openName,containerSelector})（A1/A3 结构缺——实现须补）');
  return fn;
}

// ── 编译门用例助手（gate 段，不触发被 entity-lock 预执行门拦住的 execute 整链）──
function gateCompile(tag, params) {
  const caseId = `tc_eui_searchopen_${tag}`;
  const od = join(tmp, tag); mkdirSync(od, { recursive: true });
  const tc = wj(join(tmp, `tc-${tag}.json`), {
    schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
    intents: [{ intentId: 'intent_nav', text: '进入智能体管理' }, { intentId: 'intent_open', text: '搜索并打开智能体' }],
  });
  const flow = wj(join(tmp, `flow-${tag}.json`), {
    id: caseId, name: `searchopen ${tag}`, category: 'normal',
    steps: [
      // 预执行门口径：只读白名单只有 nav.workflowManagement/assert.textVisible——nav.agentManagement 与
      // agent.searchOpen 均默认按 mutation 处理 → 每步携 sourceIntentId + subject 绑定（闭合绑定集须覆盖
      // 全部 mutation 口径步，缺一步整份投影拒绝 ENTITY_BINDING_REQUIRED_ROLES_INVALID）。
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

// ── execute 权威铸造（生产接缝消费者：entity-pre-execution-authority + 临时 prd checksum 发布）──
//    工件必须落在项目树内（projectArtifactKey 拒树外）；临时 prd 以 caseId 命名，finally 清理。
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
  const scratchRoot = `.golden-scratch-eui-searchopen-${randomUUID().slice(0, 8)}`;
  const scratchDir = join(ROOT, scratchRoot, caseId);
  const authorityPath = join(scratchDir, 'execute-authority.json');
  const text = JSON.stringify(artifact, null, 2) + '\n';
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  const artifactKey = `${scratchRoot}/${caseId}/execute-authority.json`;
  // M3（codex R1/R2）：临时 prd 以 wx 先行独占创建（同名已存在即抛、零残留），散置目录随后才建；
  // 散置写入失败即回滚 prd 再抛（自 prd 创建起一切产物受 cleanup 覆盖）。
  writeFileSync(prdPath, JSON.stringify({
    schemaVersion: 2, caseId, task: 'entity-ui-wiring searchopen 金牌临时授权（finally 清理）',
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

// ── A0 加法守恒控制面（今日即绿）：普通无 code 的 agent.searchOpen flow 过编译门 exit 0 ──
// 证 twins 夹具加法未破坏既有编译门、且 agent.searchOpen 词条形状对普通 flow 仍放行（对照锚）。
check('A0 控制面·普通 agent.searchOpen flow 过编译门 exit 0（加法守恒，今日绿）', () => {
  const { g } = gateCompile('a0_plain', { searchKeyword: AGENT_NAME, openName: AGENT_NAME });
  if (g.status !== 0) throw new Error(`普通 flow 编译门应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
});

// ================= A1：联合定位收紧（共享门 · 真实 Playwright DOM，红先行） =================
// 门在 compile/回放里消费的就是同一 Playwright page；此处在门这一层直连真实夹具 DOM 验其结构化裁定，
// 与被 entity-lock 预执行门拦住的 compile --execute/replay 整链解耦（见头注基线实况）。
const browser = await chromium.launch({ headless: true });
const happySut = await startChatSut({ scenario: 'happy' });
const twinsSut = await startChatSut({ scenario: 'twins' });
async function revealedListPage(sutUrl, keyword) {
  const page = await browser.newPage();
  await page.goto(sutUrl + '/agent/list', { waitUntil: 'load' });
  const box = page.getByRole('textbox');
  await box.fill(keyword);
  await box.press('Enter'); // 夹具：非空 Enter 才亮结果项（复刻真机搜索触发）
  await page.getByText(AGENT_NAME).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  return page;
}
try {
  // A1a 对照面（目标态今日红：门未落地）：happy 单条目、openName 精确 → 'unique'/1，照常打开。
  await checkAsync('A1a 对照面·唯一精确命中 → resolution=unique candidateCount=1（照常打开）', async () => {
    const fn = gateFn();
    const page = await revealedListPage(happySut.url, AGENT_NAME);
    try {
      const r = await fn(page, { openName: AGENT_NAME, containerSelector: '.agent-item' });
      if (!r || r.resolution !== 'unique') throw new Error(`唯一精确命中应 resolution='unique'，实际 ${JSON.stringify(r)}`);
      if (r.candidateCount !== 1) throw new Error(`candidateCount 应精确 1，实际 ${r && r.candidateCount}`);
    } finally { await page.close(); }
  });

  // A1b 子串假绿被杀（旧面病灶正面翻反例）：openName='主诉' 是条目名子串——exact:false 会子串唯一命中点下去
  // （今日假绿）；目标态 exact:true 零命中 → 'absent'（缺席硬阻断，绝不点子串超集）。
  await checkAsync('A1b 子串命中被杀·openName 只是条目子串 → resolution=absent（exact:true 零命中，旧面 exact:false 假绿被证）', async () => {
    const fn = gateFn();
    const page = await revealedListPage(happySut.url, '主诉');
    try {
      const r = await fn(page, { openName: '主诉', containerSelector: '.agent-item' });
      if (!r || r.resolution !== 'absent') throw new Error(`子串（非精确条目名）应 resolution='absent'（exact:true 零命中），实际 ${JSON.stringify(r)}`);
    } finally { await page.close(); }
  });

  // A1c 同名双条目硬阻断（deliverable #1 twins 夹具）：两条完全同名 .agent-item → 'ambiguous'/2，绝不点 first。
  await checkAsync('A1c 同名双条目·两条完全同名 → resolution=ambiguous candidateCount=2（硬阻断，绝不点 first）', async () => {
    const fn = gateFn();
    const page = await revealedListPage(twinsSut.url, AGENT_NAME);
    try {
      const r = await fn(page, { openName: AGENT_NAME, containerSelector: '.agent-item' });
      if (!r || r.resolution !== 'ambiguous') throw new Error(`同名双条目应 resolution='ambiguous'（多匹配硬阻断，绝不点 first），实际 ${JSON.stringify(r)}`);
      if (r.candidateCount !== 2) throw new Error(`candidateCount 应精确 2，实际 ${r && r.candidateCount}`);
    } finally { await page.close(); }
  });

  // A1d 容器归属闸（镜像 compileWorkflowOpen 先例）：命中文本落在条目容器外 → 非 'unique'（fail-closed，绝不点）。
  await checkAsync('A1d 容器归属闸·命中落在 .agent-item 容器外 → resolution 非 unique（fail-closed 绝不点）', async () => {
    const fn = gateFn();
    const page = await browser.newPage();
    await page.setContent(`<h1>智能体列表</h1><div id="stray">${AGENT_NAME}</div>`); // 名字在裸元素、非 .agent-item 容器
    try {
      const r = await fn(page, { openName: AGENT_NAME, containerSelector: '.agent-item' });
      if (!r || r.resolution === 'unique') throw new Error(`容器外命中应非 'unique'（容器归属闸硬阻断），实际 ${JSON.stringify(r)}`);
    } finally { await page.close(); }
  });
} finally {
  await happySut.close();
  await twinsSut.close();
  await browser.close();
}

// ================= A2：编码收敛（registry + 编译门 + 事件级 fill 值，红先行） =================
// A2-registry：registry 词条须含 code 可选参数（结构断言）。今日缺 → 红。
check('A2-registry agent.searchOpen 词条含 code 可选参数（required:false）', () => {
  const snap = rj(SNAPSHOT);
  const entry = snap && snap.atoms && snap.atoms['agent.searchOpen'];
  if (!entry) throw new Error('registry 缺 agent.searchOpen 词条');
  const code = entry.params && entry.params.code;
  if (!code) throw new Error('agent.searchOpen.params 缺 code 参数（编码收敛词条未登记）');
  if (code.required === true) throw new Error(`code 应为可选参数（required:false/缺省），实际 required=${code.required}`);
});

// A2-gate：带 code 的 flow 须过编译门 exit 0（code 是已声明参数）。今日「未声明的参数 code」→ exit 65 红。
check('A2-gate 带 code 参数的 agent.searchOpen flow 过编译门 exit 0（今日「未声明参数 code」→ 65 红）', () => {
  const { g } = gateCompile('a2_code', { searchKeyword: AGENT_NAME, openName: AGENT_NAME, code: 'DR-8848' });
  if (g.status !== 0) throw new Error(`带 code 的 flow 编译门应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
});

// A2-event：code 在场时 agent.searchOpen 的 fill 事件 value【精确】等于 code（事件级）。整链断言——今日
// 编译门先拒 code（无法产 events），故红；失败信息按阶段归因（registry 未登记 code / execute 权威链 /
// value 不等 code）。预执行门经铸造的 execute 权威工件合法通过（见头注，准入门语义零改动）。
await checkAsync('A2-event code 在场时 fill 事件 value 精确等于 code（整链事件级，今日红）', async () => {
  const code = 'DR-8848';
  const { caseId, od, tc, g } = gateCompile('a2_event', { searchKeyword: AGENT_NAME, openName: AGENT_NAME, code });
  if (g.status !== 0) throw new Error(`阶段[编译门]：带 code 的 flow 未过门（exit ${g.status}）——registry 未登记 code，无法产 events 断言 value===code：${(g.stderr || '').slice(-160)}`);
  const fd = rj(join(od, `flow-${caseId}.json`)); fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-22T00:00:00.000Z';
  wj(join(od, `flow-${caseId}.json`), fd);
  const execSut = await startChatSut({ scenario: 'happy' });
  let authority = null;
  try {
    authority = mintExecuteAuthority({ caseId, confirmedFlowPath: join(od, `flow-${caseId}.json`), testcasePath: tc });
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', execSut.url, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', 'a2e', '--entity-authority', authority.authorityPath]);
    if (x.status !== 0 || !existsSync(join(od, 'events.json'))) {
      throw new Error(`阶段[execute]：未产 events（exit ${x.status}）——权威链或执行失败：${(x.stderr || '').slice(-160)}`);
    }
    const ev = rj(join(od, 'events.json'));
    const fillEv = ev.events.find((e) => e.atom === 'agent.searchOpen' && e.action === 'fill');
    if (!fillEv) throw new Error('events 缺 agent.searchOpen fill 事件');
    if (fillEv.value !== code) throw new Error(`fill 事件 value 应【精确】等于 code「${code}」，实际「${fillEv.value}」`);
  } finally { if (authority) authority.cleanup(); await execSut.close(); }
});

// ================= A3：编译门=回放门同刻（共享门结构断言，红先行） =================
check('A3-file 共享门 lib/agent-search-gate.mjs 在场', () => {
  if (!existsSync(GATE_MODULE)) throw new Error('lib/agent-search-gate.mjs 未落地（共享门单一事实源缺）');
});
const IMPORT_RE = /import\b[^\n]*['"]\.\/agent-search-gate\.mjs['"]/;
check('A3-compile-import lib/compile-atoms.mjs import ./agent-search-gate.mjs（编译侧消费共享门）', () => {
  if (!IMPORT_RE.test(readFileSync(COMPILE_ATOMS_SRC, 'utf8'))) throw new Error('lib/compile-atoms.mjs 未 import ./agent-search-gate.mjs（编译侧未消费共享门）');
});
check('A3-replay-import lib/replay-actions.mjs import ./agent-search-gate.mjs（回放侧消费同一共享门）', () => {
  if (!IMPORT_RE.test(readFileSync(REPLAY_ACTIONS_SRC, 'utf8'))) throw new Error('lib/replay-actions.mjs 未 import ./agent-search-gate.mjs（回放侧未消费共享门——编译门≠回放门）');
});

if (fails.length) {
  for (const f of fails) console.error(`RED  entity-ui-wiring.searchopen: ${f}`);
  console.error(`RED  entity-ui-wiring.searchopen: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-ui-wiring.searchopen: ${pass}/${pass} 全过（A0 加法守恒 + A1 联合定位收紧 + A2 编码收敛 + A3 共享门同刻）`);
process.exit(0);
