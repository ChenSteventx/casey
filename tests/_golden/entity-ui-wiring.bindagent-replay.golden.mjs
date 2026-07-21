// entity-ui-wiring.bindagent-replay.golden.mjs —— 画布节点抽屉「智能体」接线原子（workflow.bindAgent）
// A7 红先行验收金牌（acceptance-gate 阶段：测试即规格、红先行）。决策依 docs/plans/entity-ui-wiring/plan.md
// W2 第 1/3/4 条 + 验收点 A7；配方 Steven 已裁 hermetic 先行。
//
// bindAgent 配方（复用抽屉族同刻门纪律，仿 workflow.selectNodeDropdown 形制）：
//   域锁打开节点配置抽屉（复用 doOpenNode 同族纪律：.lf-canvas-overlay 域锁 + 域内唯一 + 缺席守卫）→
//   抽屉内「智能体」选择控件（夹具 .agent-bind-select，与节点下拉 .hr-select、可填字段 .hr-input 均异名，
//   不进 selectNodeDropdown/setNodeField 域锁计数门）选中 agentName 精确项 → 抽屉内选中值【精确】回读双证
//   （非 includes 子串——openNode F1 精确回读同律的智能体版）。缺席/同名多匹配一律 fail-closed，绝不 first。
//   编译门 compileWorkflowBindAgent 与回放门 doBindAgent 同刻（同域锁 + 同精确回读，plan「编译门=回放门
//   同刻」）——本金牌于编译门断该共享纪律；纯回放门 doBindAgent 由 A5 端到端锁链金牌
//   （entity-ui-wiring.bindagent-lockchain.zero-sut）在双 receipt 授权就位后端到端过（bindAgent 属 relation
//   原子，其回放/执行准入必挂 [source,target] 双绑定授权——entity-semantic-lock-preflight.mjs:51 已泛化）。
//
// 【今日红基线（plan A8 精神 + 本任务 deliverable 3）】：workflow.bindAgent 尚无编译知识（不在
//   COMPILE_ATOM_COMPILERS、不在 lib/atoms-registry.snapshot.json）、无回放分支（不在 performAction 专用
//   分支）。故本金牌今日应当在「原子无编译知识」处红——bin/compile 的 validateStructural（lib/compile-gate.mjs:46
//   未知原子不在注册表）与 flow-bridge（lib/flow-bridge.mjs:105 isCompilableAtom）均拒 workflow.bindAgent。
//   如实钉住这个红点作为基线（唯一路径=真机运行时权威 2026-07-18 已裁，红填绿是后续实现者的活）。
//   断言纪律：退出码 + 结构化字段（isCompilableAtom 布尔 / COMPILE_KNOWN_ATOMS 计数 / blockers / events 产物），
//   禁标记串 grep 判绿。
//
// A7 三形态（夹具 tests/fixtures/fake-sut/server.mjs 三新场景，绝不破坏既有场景）：
//   A7a 唯一选项（bindagentone）：bindAgent 回放选中 agentName 并【精确】回读选中值 → 绿态 events 末步
//       bindAgent + compile-report 精确回读双证；今日红=原子无编译知识（gate exit 65「未知原子」）。
//   A7b 同名双选项（bindagenttwin）：浮层内目标 agentName 出现两次 → 硬阻断（域内 count=2 ambiguous 绝不
//       选 first）→ 绿态 blocker exit 65 零 events；今日红=原子无编译知识。
//   A7c 目标选项缺席（bindagentabsent）：浮层不含目标 agentName → 硬阻断（缺席守卫 count=0）→ 绿态
//       blocker exit 65 零 events；今日红=原子无编译知识。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';
import {
  requiredFlowEntityBindings,
  calculateIdentityAdmissionSignature,
  hashIdentityAdmissionBytes,
} from '../../lib/entity-semantic-lock-preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const S = (p) => join(ROOT, 'tests', '_golden', 'schemas', p);
const tmp = mkdtempSync(join(tmpdir(), 'casey-bindagent-replay-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-500)}`); } }
const SITE_FILE = join(tmp, 'site.synthetic.json');
writeFileSync(SITE_FILE, '{}\n');
function run(args, timeout = 120000) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout, env: { ...process.env, AT_SITE_JSON: SITE_FILE } }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const OPEN_NAME = 'atl_目录CRUD_a'; // fake-sut happy 列表既有行（只读点开进详情=画布页，沿用抽屉族）
const NODE = '模型节点'; // 面板前 4 真机实采名之一（抽屉族原子的典型宿主）
const NODE_X = 320, NODE_Y = 150;
const AGENT = '订单智能体'; // 夹具 buildAgentSelect 目标智能体（AGENT_TARGET）：唯一选中 / 双选项 / 缺席的锚

// 通道剖面（非凭据）：沿用抽屉族 countSelector='.hr-drawer__content-wrapper'（抽屉 0→1 归 openNode intent）。
const PROFILE_OBJ = { background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200, countSelector: '.hr-drawer__content-wrapper' };
const PROFILE = writeJson(join(tmp, 'profile.json'), PROFILE_OBJ);

// ── events.schema 结构校验器（无 ajv，与 wf-open-node/wf-select 金牌同一 hermetic 习惯）──
const EV_SCHEMA = readJson(S('events.schema.json'));
const ACTION_ENUM = EV_SCHEMA.definitions.event.properties.action.enum;
function assertEventsDocAgainstSchema(doc) {
  if (doc.schemaVersion !== 2 || doc.channel !== 'web') throw new Error('events 信封违 schema（schemaVersion 须 2、channel 须 web）');
  if (doc.authored !== false) throw new Error('authored 须 false（LLM 编译产物须干净 v2 events）');
  const props = Object.keys(EV_SCHEMA.definitions.event.properties);
  for (const [i, e] of doc.events.entries()) {
    if (!e.stepId || !e.intentId || !e.action) throw new Error(`events[${i}] 缺 stepId/intentId/action`);
    if (!ACTION_ENUM.includes(e.action)) throw new Error(`events[${i}] action ${e.action} 不在 events.schema 枚举 ${JSON.stringify(ACTION_ENUM)}`);
    for (const k of Object.keys(e)) if (!props.includes(k)) throw new Error(`events[${i}] 字段 ${k} 不在 schema event properties（additionalProperties:false 纪律）`);
  }
}

// ---------- A7-knowledge 编译原子集加法（结构化，原子无编译知识红锚）----------
// 断言纪律：isCompilableAtom 布尔 + COMPILE_KNOWN_ATOMS 计数（结构化字段，非标记串）。今日 false/25 → 红。
await checkAsync('A7-knowledge workflow.bindAgent 可编译、COMPILE_KNOWN_ATOMS 恰 26（bindAgent +1）、agent.removeToolByName 仍不可编译', async () => {
  const ca = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
  if (!ca.isCompilableAtom('workflow.bindAgent')) throw new Error('workflow.bindAgent 应可编译（智能体接线原子加法）——今日红基线：原子无编译知识（不在 COMPILE_ATOM_COMPILERS）');
  if (ca.COMPILE_KNOWN_ATOMS.size !== 26) throw new Error(`COMPILE_KNOWN_ATOMS 应恰 26（bindAgent +1，plan A4：25→26），实际 ${ca.COMPILE_KNOWN_ATOMS.size}——今日红基线`);
  if (ca.isCompilableAtom('agent.removeToolByName')) throw new Error('agent.removeToolByName 不应可编译（策略在册而编译知识未建的长寿真反例；原 openToolPicker 反例已随 agent_tool 维度落地失效，属被前置断言遮蔽的陈旧断言，修正记 evidence）');
  if (ca.isCompilableAtom('nonsense.x')) throw new Error('nonsense.x 不应可编译');
});

// ── 编译面公共助手：gate→confirm→execute，回 {g, x, od}（gate 段红即回 x:null，不进 execute）──
//    每场景各起自带 bindagent* 场景的 fake-sut 实例（抽屉智能体选择控件三形态）。──
function compileBindAgentCase(tag, caseId, sutUrl) {
  const tc = writeJson(join(tmp, `tc-${tag}.json`), {
    schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'],
    intents: [
      { intentId: 'intent_nav', text: '进入工作流管理列表' },
      { intentId: 'intent_open', text: `点开工作流 ${OPEN_NAME} 详情` },
      { intentId: 'intent_add', text: `往画布拖入「${NODE}」节点` },
      { intentId: 'intent_open_node', text: `单击「${NODE}」节点打开配置抽屉` },
      { intentId: 'intent_bind', text: `在节点抽屉里把智能体绑定为「${AGENT}」` },
    ],
  });
  // bindAgent step 携 source(workflow)+target(agent) 双 entityBindings（plan W2-1：relation 原子由 flow 文档
  //   给出双角色；entity-semantic-lock-preflight.mjs:51 relation/[source,target]）。绿态 execute 准入据此挂
  //   双 receipt 授权（A5 端到端锁链金牌覆盖）；今日 gate 段先在「未知原子」处红，双绑定尚不触达。
  // 预执行门口径：mutation 步（open/addNode/openNode/bindAgent）各携 sourceIntentId + entityBindings，
  // 供 execute 权威工件闭合绑定集投影（三字段）；bindAgent 保持 relation 双角色（source+target）。
  const flow = writeJson(join(tmp, `flow-${tag}.json`), {
    id: caseId, name: `智能体接线 ${tag}`, category: 'normal',
    steps: [
      { atom: 'nav.workflowManagement', params: {} },
      {
        atom: 'workflow.open', params: { openName: OPEN_NAME }, sourceIntentId: 'intent_open',
        entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }],
      },
      // （assert.onPage 不入 flow：不在只读白名单、默认 mutation 需绑定而语义为纯断言——详情路由后置
      //   已由 compileWorkflowOpen 的 waitForURL 兜、NODE 可见由下方 assert.textVisible 钉。）
      {
        atom: 'workflow.addNode', params: { nodeName: NODE, x: NODE_X, y: NODE_Y }, sourceIntentId: 'intent_add',
        entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }],
      },
      { atom: 'assert.textVisible', params: { text: NODE } }, // 折进 addNode intent，硬断言防 INDETERMINATE
      {
        atom: 'workflow.openNode', params: { label: NODE }, sourceIntentId: 'intent_open_node',
        entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }],
      },
      {
        atom: 'workflow.bindAgent', params: { nodeLabel: NODE, agentName: AGENT }, sourceIntentId: 'intent_bind',
        entityBindings: [
          { candidateId: 'candidate-workflow-main', role: 'source' },
          { candidateId: 'candidate-agent-target', role: 'target' },
        ],
      },
      { atom: 'assert.textVisible', params: { text: AGENT } }, // 折进 bind intent，硬断言防 INDETERMINATE
    ],
  });
  const od = join(tmp, `compile-${tag}`);
  const g = run([CASEY, 'compile', caseId, '--testcase', tc, '--flow', flow, '--out-dir', od]);
  if (g.status !== 0) return { g, x: null, od }; // gate 段红（今日：未知原子 workflow.bindAgent）→ 不进 execute
  const fd = readJson(join(od, `flow-${caseId}.json`));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-22T00:00:00.000Z';
  writeJson(join(od, `flow-${caseId}.json`), fd);
  // execute 权威铸造（生产接缝消费者，准入门语义零改动；工件在项目树内 + 临时 prd checksum 发布）。
  const flowBytes = readFileSync(join(od, `flow-${caseId}.json`));
  const tcBytes = readFileSync(tc);
  const bindings = requiredFlowEntityBindings(JSON.parse(flowBytes.toString('utf8')).flow);
  const artifact = {
    schemaVersion: 1, artifactKind: 'entity-pre-execution-authority', authorizedFor: 'compile-execute',
    caseId, signed: true, signerId: 'golden-human', signedAt: '2026-07-22T00:00:00.000Z', audience: 'test',
    flowSha256: hashIdentityAdmissionBytes(flowBytes), testcaseSha256: hashIdentityAdmissionBytes(tcBytes),
    bindings,
  };
  artifact.signature = calculateIdentityAdmissionSignature(artifact);
  const scratchRoot = `.golden-scratch-eui-bindagent-${randomUUID().slice(0, 8)}`;
  const scratchDir = join(ROOT, scratchRoot, caseId);
  const authorityPath = join(scratchDir, 'execute-authority.json');
  const authorityText = JSON.stringify(artifact, null, 2) + '\n';
  const prdPath = join(ROOT, 'loop', `prd-${caseId}.json`);
  // M3（codex R1/R2）：临时 prd 以 wx 先行独占创建（同名已存在即抛、零残留），散置目录随后才建；
  // 自 prd 创建起一切产物都在 finally 清理范围内（wx 抛错时尚未建任何散置产物）。
  writeFileSync(prdPath, JSON.stringify({
    schemaVersion: 2, caseId, task: 'entity-ui-wiring bindagent 金牌临时授权（finally 清理）',
    testChecksums: { [`${scratchRoot}/${caseId}/execute-authority.json`]: createHash('sha256').update(authorityText).digest('hex') },
    stories: [],
  }, null, 2) + '\n', { flag: 'wx' });
  try {
    mkdirSync(scratchDir, { recursive: true });
    writeFileSync(authorityPath, authorityText);
    const x = run([CASEY, 'compile', caseId, '--execute', '--testcase', tc, '--sut', sutUrl, '--out-dir', od, '--profile', PROFILE, '--skip-login', '--unique-name', tag, '--entity-authority', authorityPath]);
    return { g, x, od };
  } finally {
    rmSync(join(ROOT, scratchRoot), { recursive: true, force: true });
    rmSync(prdPath, { force: true });
  }
}

// ---------- A7a 唯一选项：bindAgent 回放选中 + 精确回读（绿态目标）；今日红=原子无编译知识 ----------
await checkAsync('A7a 唯一选项（bindagentone）：bindAgent 回放选中 agentName + 抽屉内选中值精确回读双证（events 末步 bindAgent + compile-report 精确回读）——今日红：原子无编译知识 gate exit 65「未知原子 workflow.bindAgent」', async () => {
  const s = await startFakeSut({ scenario: 'bindagentone' });
  try {
    const caseId = 'tc_bindagent_a7a';
    const { g, x, od } = compileBindAgentCase('a7a', caseId, s.url);
    // 【红基线·load-bearing】：bindAgent 无编译知识 → gate 段 validateStructural 拒「未知原子」。今日此处红。
    if (g.status !== 0) throw new Error(`gate 应接受已注册原子 workflow.bindAgent（exit 0）；今日红基线=原子无编译知识：gate exit ${g.status}（validateStructural 拒，stderr 尾: ${((g.stderr || '') + (g.stdout || '')).slice(-160)}）`);
    // —— 以下绿态目标（bindAgent 编译知识 + 回放分支 + 注册表 + 双 receipt 授权就位后）——
    if (!x || x.status !== 0) throw new Error(`execute 应 exit 0（唯一智能体选项正常选中），实际 ${x && x.status}: ${((x && x.stderr) || '').slice(-200)}`);
    const ev = readJson(join(od, 'events.json'));
    const bind = ev.events[ev.events.length - 1];
    if (bind.atom !== 'workflow.bindAgent') throw new Error(`末步 atom 应 workflow.bindAgent，实际 ${bind.atom}`);
    if (bind.text !== AGENT) throw new Error(`bindAgent text 应载 agentName「${AGENT}」（精确选中锚），实际 ${bind.text}`);
    if (bind.nodeName !== NODE) throw new Error(`bindAgent 应带 nodeName「${NODE}」（抽屉标题域锁供给通道），实际 ${bind.nodeName}`);
    assertEventsDocAgainstSchema(ev);
    const rep = readJson(join(od, 'compile-report.json'));
    if (!deepEq(rep.blockers || [], [])) throw new Error(`唯一选项 blockers 应空，实际 ${JSON.stringify(rep.blockers)}`);
    // 精确回读双证（结构化字段：compile-report notes；智能体选中值精确等于 agentName，非 includes 子串）。
    const repText = JSON.stringify(rep);
    if (!/智能体已选中/.test(repText) || !/精确回读/.test(repText)) throw new Error(`compile-report 应含「智能体已选中…精确回读」选中值双证 notes（编译门=回放门同刻），实际尾段 ${repText.slice(-300)}`);
  } finally { await s.close(); }
});

// ---------- A7b 同名双选项：硬阻断绝不 first（绿态目标）；今日红=原子无编译知识 ----------
await checkAsync('A7b 同名双选项（bindagenttwin：目标 agentName 浮层内两处）：域内 count=2 ambiguous 绝不选 first → blocker exit 65 零 events——今日红：原子无编译知识 gate exit 65「未知原子」', async () => {
  const s = await startFakeSut({ scenario: 'bindagenttwin' });
  try {
    const caseId = 'tc_bindagent_a7b';
    const { g, x, od } = compileBindAgentCase('a7b', caseId, s.url);
    // 【红基线·load-bearing】：今日红=原子无编译知识（gate 拒未知原子）。
    if (g.status !== 0) throw new Error(`gate 应接受已注册原子 workflow.bindAgent（exit 0）；今日红基线=原子无编译知识：gate exit ${g.status}（validateStructural 拒，stderr 尾: ${((g.stderr || '') + (g.stdout || '')).slice(-160)}）`);
    // —— 绿态目标：同名双选项 fail-closed（精确语义：绝不 first、退出码 65、零 events 半份危险防护）——
    if (!x || x.status !== 65) throw new Error(`同名双选项应 execute 预检 count=2 硬阻断 exit 65（多匹配绝不选 first），实际 ${x && x.status}: ${((x && x.stderr) || '').slice(-200)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/bindAgent/.test(btext) || !/count=2|多匹配|非唯一|ambiguous/.test(btext)) throw new Error(`blockers 应点名 bindAgent 域内智能体选项 count=2 多匹配（其自身签名），实际 ${btext.slice(0, 300)}`);
    // 绝不 first 反证：无 acted=true 谎报（选不了照 fail-closed 落轴）。
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.bindAgent' && v.acted === true);
    if (lied) throw new Error('同名双选项仍 acted=true——身份门破（多匹配绝不选 first，护栏 #14/ADR-0007）');
  } finally { await s.close(); }
});

// ---------- A7c 目标选项缺席：缺席守卫硬阻断（绿态目标）；今日红=原子无编译知识 ----------
await checkAsync('A7c 目标选项缺席（bindagentabsent：浮层不含 agentName）：缺席守卫 count=0 硬阻断 → blocker exit 65 零 events——今日红：原子无编译知识 gate exit 65「未知原子」', async () => {
  const s = await startFakeSut({ scenario: 'bindagentabsent' });
  try {
    const caseId = 'tc_bindagent_a7c';
    const { g, x, od } = compileBindAgentCase('a7c', caseId, s.url);
    // 【红基线·load-bearing】：今日红=原子无编译知识（gate 拒未知原子）。
    if (g.status !== 0) throw new Error(`gate 应接受已注册原子 workflow.bindAgent（exit 0）；今日红基线=原子无编译知识：gate exit ${g.status}（validateStructural 拒，stderr 尾: ${((g.stderr || '') + (g.stdout || '')).slice(-160)}）`);
    // —— 绿态目标：目标选项缺席 fail-closed（精确语义：缺席守卫、退出码 65、零 events）——
    if (!x || x.status !== 65) throw new Error(`目标选项缺席应 execute 预检 count=0 硬阻断 exit 65（缺席守卫），实际 ${x && x.status}: ${((x && x.stderr) || '').slice(-200)}`);
    if (existsSync(join(od, 'events.json'))) throw new Error('阻断不得产 events（半份危险）');
    const rep = readJson(join(od, 'compile-report.json'));
    const btext = JSON.stringify(rep.blockers || []);
    if (!(rep.blockers || []).length || !/bindAgent/.test(btext) || !/count=0|缺席|证不出/.test(btext)) throw new Error(`blockers 应点名 bindAgent 域内智能体选项 count=0 缺席（其自身签名），实际 ${btext.slice(0, 300)}`);
    const lied = (rep.verification || []).some((v) => v.atom === 'workflow.bindAgent' && v.acted === true);
    if (lied) throw new Error('目标选项缺席仍 acted=true——身份门破（缺席照 fail-closed 落轴，护栏 #14）');
  } finally { await s.close(); }
});


// ---------- R1 评审修复钉（codex R1 H1/H2/M1：先红后修，直连 lib 门层——s1 金牌 A1 层同法） ----------
const pwMod = (await import('@playwright/test')).default;
const raMod = await import(`file://${join(ROOT, 'lib', 'replay-actions.mjs').replace(/\\/g, '/')}`);
const caMod = await import(`file://${join(ROOT, 'lib', 'compile-atoms.mjs').replace(/\\/g, '/')}`);
const advBrowser = await pwMod.chromium.launch();
try {
  // R1-H1：回读必须限定可见+恰一——隐藏旧值(目标名)在前、可见错误值在后，绝不 unique/ok。
  await checkAsync('R1-H1 回读可见恰一：隐藏旧值(目标名)+可见错误值 → 绝不 unique/identityReadback.ok（修前红）', async () => {
    const page = await advBrowser.newPage();
    try {
      await page.setContent(`
        <div class="hr-drawer__content-wrapper"><h3>模型节点</h3>
          <div class="agent-bind-select">
            <span class="agent-bind-select__value" style="display:none">订单智能体</span>
            <span class="agent-bind-select__value">错误智能体</span>
          </div>
        </div>
        <div class="agent-bind-option">订单智能体</div>`);
      const axis = await raMod.performAction(page, { atom: 'workflow.bindAgent', action: 'click', semantic: { kind: 'text', name: '订单智能体', exact: true }, text: '订单智能体', value: '订单智能体', nodeName: '模型节点' }, { uniqueName: 'atl_x' });
      if (axis && axis.resolution === 'unique' && axis.identityReadback && axis.identityReadback.ok === true) {
        throw new Error(`隐藏旧值骗绿：可见选中值为「错误智能体」仍回 unique/ok（${JSON.stringify(axis)}）`);
      }
    } finally { await page.close(); }
  });
  // R1-H2：编译门必须锁 nodeLabel 抽屉——页面只有「另一个节点」抽屉（带真实选中回写脚本）时必硬阻断。
  await checkAsync('R1-H2 编译门抽屉域锁：只有别的节点抽屉时 bindAgent 必硬阻断、不产成功注记（修前红）', async () => {
    const page = await advBrowser.newPage();
    try {
      await page.setContent(`
        <div class="hr-drawer__content-wrapper"><h3>另一个节点</h3>
          <div class="agent-bind-select"><span class="agent-bind-select__value">请选择智能体</span></div>
        </div>
        <div class="agent-bind-option">订单智能体</div>
        <script>
          document.querySelector('.agent-bind-option').addEventListener('click', function () {
            document.querySelector('.agent-bind-select__value').textContent = this.textContent;
          });
        </script>`);
      const run2 = caMod.createCompileRun({ page, forensics: { records: () => [] }, state: {}, sut: 'http://127.0.0.1:1', uniqueName: 'atl_x', site: {} });
      await caMod.compileFlow(run2, { steps: [{ atom: 'workflow.bindAgent', params: { nodeLabel: '模型节点', agentName: '订单智能体' } }] });
      const btext = JSON.stringify(run2.blockers || []);
      const lied = (run2.notes || []).some((n) => /智能体已选中/.test(n));
      if (lied || !(run2.blockers || []).length || !/bindAgent/.test(btext)) {
        throw new Error(`页面无「模型节点」抽屉仍未硬阻断（blockers=${btext.slice(0, 200)}；成功注记=${lied}）`);
      }
    } finally { await page.close(); }
  });
  // R1-M1：容器覆写编译回放同参——ctx.profile.agents.itemContainer 在回放门生效。
  await checkAsync('R1-M1 容器覆写同刻：ctx.profile.agents.itemContainer 于回放门生效 → unique（修前红）', async () => {
    const page = await advBrowser.newPage();
    try {
      await page.setContent('<div class="custom-agent-row">目标智能体X</div>');
      const axis = await raMod.performAction(page, { atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: '目标智能体X', exact: true }, text: '目标智能体X' }, { uniqueName: 'atl_x', profile: { agents: { itemContainer: '.custom-agent-row' } } });
      if (!axis || axis.resolution !== 'unique') throw new Error(`自定义容器下应 unique，实际 ${JSON.stringify(axis)}`);
    } finally { await page.close(); }
  });
} finally { await advBrowser.close(); }

console.log(`entity-ui-wiring bindagent-replay golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
