#!/usr/bin/env node
// agent-id-readback · 82484ab 差分棘轮金牌（zero-SUT，纯 node，禁浏览器/网络/SUT）。
//
// 【回归保护：冻结即绿】——本金牌不是红先行：基线在未实现树（=82484ab 等价）上录制、今日即绿；
// 实现落地后它守住「未声明身份通道路径」的字节零漂移（plan.md §6 差分棘轮 + §7 验收点 4，
// interface-spec §7）。做法：mock CDP + 固定事件脚本直接驱动 lib/replay-forensics.mjs 的
// watchNetworkForensics（无真浏览器），四面逐字节对照基线：
//   ① CDP listener 注册名序列 + send 调用名序列（cdp-calls.json）；
//   ② records() JSON 字节——drain 前/后各一份快照（records.pre-drain.json / records.post-drain.json；
//      ts 等不定字段用 mock 事件里注入的固定值，绝不 normalize 真实值）；
//   ③ api 面：watchNetworkForensics 返回对象的键集合（api-surface.json）；
//   ④ 基线文件集清单 + 逐文件 sha256（manifest.json）。
// 脚本内含一条命中 /api/agents/query 形态 url 的请求（r2/r6）——未声明身份通道时它必须被当
// 普通前台 API 对待（正常归因、正常取 body 算信封，零特殊分支）；这正是棘轮要冻住的面。
//
// codex R2-H6 升级（2026-07-22 修单）：
//   面⑤ sign-v1-cli.json——sign v1 happy 固定夹具真执行：三流+完整输出文件集合+逐文件 sha256+prd
//     字节全冻（双跑探针实证跨运行字节确定；相对路径调用零绝对路径泄漏、跨树可移植）；
//   面⑥ cli-early-reject.json——compile/replay 无参拒绝三流（sign 三流由面⑤覆盖：其无参 usage 行
//     含 --entity-observations 新旗标文档，属已声明接口合法演进、不入未声明路径冻结面）；
//   R15-R17 过校验负控——sign 真执行 / replay 真 v1 件过全部准入到 chromium.launch 哨兵(exit 66) /
//     compile 闸段合法 flow 全跑，全程零身份模块解析（回应「无参早退证不了过校验路径」）。
//
// sol 五面构造落地（R2-H6 残余，sol-consult-plan6 判「零 SUT 不可达」不成立后兑现；R18-R21）：
//   面⑦ compile-run-v1.json——mock Page/forensics 替身（fixtures/agent-id-readback/mock-page.mjs）驱
//     【真实】createCompileRun/compileFlow 走 v1（未声明身份通道）flow，冻 events/verification/
//     provenance/observed 全量 JSON 字节；
//   面⑧ action-axes-v1.json——同替身驱【真实】performAction 固定 v1 事件脚本（unique/ambiguous/
//     none/action_failed/纯断言/selectOption/漂移探针形状全分支），冻逐事件动作轴 JSON 字节；
//   面⑨ axes-projection-v1.json——固定证据结构驱生产共用纯函数 lib/replay-axes.mjs（自 bin/replay.mjs
//     逐字搬移，82484ab..b920b4f 对投影段零改动、搬移 diff 交异构评审静态核）冻完整 axes 字节
//     （归因归一/孤儿并入/凭据路由打码/非 http 脱敏/intent 折叠洗白禁/软断言透传全覆盖）；
//   面⑩ verdict-report-v1.json——面⑨ axes 喂真实 bin/verdict.mjs → bin/report-model.mjs
//     （--generated-at 固定）→ bin/report.mjs 全链，冻三流+verdict JSON+report JSON 字节
//     （四态 PASS/SUT_DEFECT/NEEDS_HUMAN(INDETERMINATE)/AMBIGUOUS_ACTION 各一）。
//   面⑩ 两笔明示排除（同 sign usage 排除先例，冻的是具体调用矩阵）：report 的 html/md 字节属报告
//     模板演进面（plan §6 面②义务=report 的 JSON 字节；文件名集仍冻）；bin/report.mjs 成功 stdout
//     打印 resolve 后绝对路径——冻它=冻树根、破跨树可移植（R13 零绝对路径纪律），改冻 status/stderr+
//     产物文件名集+逐文件 sha（产物字节面才是义务对象）。
//
// poison spy（plan §6-⑤）：未声明身份通道路径下身份模块不得被采集器触达——
//   lib/agent-identity-observation.mjs / lib/agent-identity-gate.mjs 今日不存在 → 通过（无从加载）；
//   文件存在后 → 断言 lib/replay-forensics.mjs 源码不含对它们的顶层静态 import（读源码字符串判定：
//   静态 `import ... from './agent-identity-*.mjs'` 与裸副作用 `import './agent-identity-*.mjs'` 均拒；
//   声明路径下的按需消费须走独立回调注入/动态 import——plan §1「以独立回调注入（onIdentityBody）」）。
//
// 录制（仅未实现树上合法一次）：
//   AGENT_ID_BASELINE_RECORD=1 node tests/_golden/agent-id-regression-diff.zero-sut.golden.mjs
// 把四面落 tests/_golden/fixtures/agent-id-readback/baseline/。此后棘轮只比对、绝不重录——
// 重录=换基线，必须走 accept 相重冻结（gate testChecksums），不是实现者可做的动作。
//
// 断言纪律（护栏 #14）：逐字节 Buffer 等值 + sha256 对账；不 normalize、不 grep 失败标记串。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchNetworkForensics } from '../../lib/replay-forensics.mjs';
import { createCompileRun, compileFlow } from '../../lib/compile-atoms.mjs';
import { performAction } from '../../lib/replay-actions.mjs';
import { projectReplayAxes } from '../../lib/replay-axes.mjs';
import { createMockPage } from './fixtures/agent-id-readback/mock-page.mjs';

const TAG = 'agent-id-regression-diff';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BASELINE_DIR = join(HERE, 'fixtures', 'agent-id-readback', 'baseline');
const FORENSICS_SRC = join(ROOT, 'lib', 'replay-forensics.mjs');
const IDENTITY_MODULES = ['agent-identity-observation.mjs', 'agent-identity-gate.mjs'];

let failures = 0;
let passes = 0;
const red = (label, detail) => { failures += 1; console.error(`RED  ${TAG}: ${label}: ${detail}`); };
const ok = (label) => { passes += 1; console.log(`ok   ${TAG}: ${label}`); };
class CheckFail extends Error {}
const must = (cond, detail) => { if (!cond) throw new CheckFail(detail); };
const check = (label, fn) => {
  try { fn(); ok(label); } catch (e) {
    if (e instanceof CheckFail) red(label, e.message);
    else red(label, `检查执行异常（非断言）：${e?.stack?.split('\n')[0] ?? e}`);
  }
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// ── 录制器（可复用）：mock CDP + 固定事件脚本驱动 watchNetworkForensics ────────────────
// mock CDP：记录 on(listener 名) 注册序列与 send(方法名) 调用序列；getResponseBody 按 requestId
// 回固定 body（确定性，零网络）。
function createMockCdp(bodies) {
  const handlers = new Map();
  const listenersRegistered = [];
  const sendCalls = [];
  return {
    listenersRegistered,
    sendCalls,
    on(name, handler) { listenersRegistered.push(name); handlers.set(name, handler); },
    send(method, params) {
      sendCalls.push(method);
      if (method === 'Network.getResponseBody' && params && Object.prototype.hasOwnProperty.call(bodies, params.requestId)) {
        return Promise.resolve({ body: bodies[params.requestId], base64Encoded: false });
      }
      return Promise.resolve(null);
    },
    emit(name, event) { const h = handlers.get(name); if (h) h(event); },
  };
}

// 固定脚本：与 chat-sut/真机同形态的一段旅程。全部 timestamp/requestId/url 固定注入——
// records() 字节因此确定，绝不 normalize 真实值。
async function runRecorder() {
  const state = { step: null };
  const bodies = {
    // r2：身份形态 url 的成功信封（未声明通道 → 必须按普通请求取 body 算 errorEnvelope）
    r2: JSON.stringify({ status: 200, data: { records: [{ agentId: '1234567890123456789', agentCode: 'AG-IM-001', agentName: 'alice' }], total: 1 } }),
    // r6：身份形态 url 的软失败信封（errorEnvelope ok:false 面）
    r6: JSON.stringify({ status: 500, msg: 'server error' }),
  };
  const cdp = createMockCdp(bodies);
  const watcher = watchNetworkForensics(cdp, {
    denylist: ['/ai-api/background/'],
    successField: 'status',
    successValue: 200,
    currentStep: () => state.step,
  });
  const watcherKeys = Object.keys(watcher);

  // 1) 文档导航（非脚本发起 → 归因 null、不取 body）
  state.step = 'step_nav';
  cdp.emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'http://127.0.0.1:4173/agent/list', method: 'GET' }, initiator: { type: 'other' }, type: 'Document', timestamp: 1001.001 });
  cdp.emit('Network.responseReceived', { requestId: 'r1', response: { status: 200 } });
  cdp.emit('Network.loadingFinished', { requestId: 'r1' });

  // 2) 身份形态 url 的前台 Fetch（本步发起 → 正常归因；未声明通道零特殊分支）
  state.step = 'step_search';
  cdp.emit('Network.requestWillBeSent', { requestId: 'r2', request: { url: 'http://127.0.0.1:4173/api/agents/query?nameLike=alice', method: 'GET' }, initiator: { type: 'script' }, type: 'Fetch', timestamp: 1002.002 });
  cdp.emit('Network.responseReceived', { requestId: 'r2', response: { status: 200 } });

  // 3) 背景轮询（denylist 命中 → 归因 null、不取 body、不进在途账）
  cdp.emit('Network.requestWillBeSent', { requestId: 'r3', request: { url: 'http://127.0.0.1:4173/ai-api/background/poll', method: 'GET' }, initiator: { type: 'script' }, type: 'XHR', timestamp: 1003.003 });
  cdp.emit('Network.responseReceived', { requestId: 'r3', response: { status: 401 } });
  cdp.emit('Network.loadingFinished', { requestId: 'r3' });

  // 4) 身份形态 url 第二条：软失败信封
  cdp.emit('Network.requestWillBeSent', { requestId: 'r6', request: { url: 'http://127.0.0.1:4173/api/agents/query?nameLike=missing', method: 'GET' }, initiator: { type: 'script' }, type: 'Fetch', timestamp: 1003.503 });
  cdp.emit('Network.responseReceived', { requestId: 'r6', response: { status: 200 } });

  // 5) SSE 流：finished 静默点消息（streamFinished/streamStatus 面）
  state.step = 'step_send';
  cdp.emit('Network.requestWillBeSent', { requestId: 'r4', request: { url: 'http://127.0.0.1:4173/ai-api/tester/agent/stream', method: 'GET' }, initiator: { type: 'script' }, type: 'EventSource', timestamp: 1004.004 });
  cdp.emit('Network.responseReceived', { requestId: 'r4', response: { status: 200 } });
  cdp.emit('Network.eventSourceMessageReceived', { requestId: 'r4', eventName: 'finished', data: '{"status":200}' });

  // 6) 无活动步的 XHR 失败（loadingFailed 面：归因 null、在途账出清）
  state.step = null;
  cdp.emit('Network.requestWillBeSent', { requestId: 'r5', request: { url: 'http://127.0.0.1:4173/api/agents/save', method: 'POST' }, initiator: { type: 'script' }, type: 'XHR', timestamp: 1005.005 });
  cdp.emit('Network.loadingFailed', { requestId: 'r5' });

  // 7) 前台 API 收尾：body 取数走 mock send（send 调用序列由此产生）
  cdp.emit('Network.loadingFinished', { requestId: 'r2' });
  cdp.emit('Network.loadingFinished', { requestId: 'r6' });

  // 快照一：drain 前（同步取——body 微任务尚未回填，errorEnvelope 恒 null，确定性）
  const preDrain = JSON.stringify(watcher.records(), null, 2) + '\n';
  const inFlightAfterScript = watcher.inFlightCount();
  await watcher.drain();
  // 快照二：drain 后（errorEnvelope 回填完毕）
  const postDrain = JSON.stringify(watcher.records(), null, 2) + '\n';

  return {
    faces: {
      'cdp-calls.json': JSON.stringify({ listenersRegistered: cdp.listenersRegistered, sendCalls: cdp.sendCalls }, null, 2) + '\n',
      'records.pre-drain.json': preDrain,
      'records.post-drain.json': postDrain,
      'api-surface.json': JSON.stringify({ watcherKeys, inFlightAfterScript }, null, 2) + '\n',
    },
  };
}

// ── sign v1 CLI 面 + 过校验路径夹具（plan §6 面③④，codex R2-H6 升级）───────────────────
// 固定夹具（同 sign 金牌 c7 形态、固定 signedAt/scratch 名/相对路径）→ sign v1 happy 全链真执行：
// 三流 + 完整输出文件集合 + 逐文件 sha256 + prd 字节全部冻结（2026-07-22 双跑探针实证跨运行字节确定、
// 相对路径调用零绝对路径泄漏——跨树可移植）。产物随后喂 replay 过校验哨兵负控。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync as wf } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildEntityBindingsDraft } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SPY_LOADER = join(HERE, 'fixtures', 'agent-id-readback', 'spy-loader.mjs');
const RATCHET_CASE = 'tc_air_ratchet_v1';
const RATCHET_REL = `.golden-scratch-agent-id-regression-diff-v1/${RATCHET_CASE}`;
const RATCHET_DIR = join(ROOT, RATCHET_REL);
const RATCHET_PRD = join(ROOT, 'loop', `prd-${RATCHET_CASE}.json`);
const AGENT_NAME_V1 = '互联网问诊-主诉';
const jt = (v) => JSON.stringify(v, null, 2) + '\n';

function prepareRatchetV1Fixture() {
  rmSync(join(ROOT, '.golden-scratch-agent-id-regression-diff-v1'), { recursive: true, force: true });
  rmSync(RATCHET_PRD, { force: true });
  mkdirSync(RATCHET_DIR, { recursive: true });
  const events = {
    schemaVersion: 2, channel: 'web', caseId: RATCHET_CASE, url: '{{baseUrl}}/agent/list',
    recordedAt: '2026-07-22T08:00:00.000Z', compiledBy: 'ratchet-fixture', authored: false,
    events: [
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: AGENT_NAME_V1 },
      { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
      { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME_V1 },
    ],
  };
  const eventsText = jt(events);
  const provenance = ['atstep_1', 'atstep_2', 'atstep_3'].map((stepId) => ({
    stepId, intentId: 'intent_1', atom: 'agent.searchOpen',
    sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
  }));
  const draftResult = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: events, provenance });
  if (draftResult.ok !== true) throw new Error(`夹具自身红：buildEntityBindingsDraft ${draftResult.reason}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
    expected: { name: AGENT_NAME_V1, code: 'AG-IM-001' },
    observed: { name: AGENT_NAME_V1, code: 'AG-IM-001', platformId: '1234567890123456789' },
    source: 'user-confirmed',
  });
  wf(join(RATCHET_DIR, 'events.json'), eventsText);
  wf(join(RATCHET_DIR, 'entity-bindings.draft.json'), jt(draftResult.draft));
  wf(join(RATCHET_DIR, 'entity-confirmations.json'), jt({ caseId: RATCHET_CASE, confirmations: provenance.map((r) => ({ ...r, receipt })) }));
  wf(join(RATCHET_DIR, 'expected.draft.json'), jt({ caseId: RATCHET_CASE, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: '测试' }] }], pending: [] }));
  wf(join(RATCHET_DIR, 'profile.v1.json'), jt({ background: [], successField: 'status', successValue: 200 }));
  wf(RATCHET_PRD, jt({ schemaVersion: 1, caseId: RATCHET_CASE, task: 'agent-id 差分棘轮 v1 面夹具（金牌自清理）', testChecksums: {}, stories: [] }), { flag: 'wx' });
}
function cleanupRatchetV1Fixture() {
  rmSync(join(ROOT, '.golden-scratch-agent-id-regression-diff-v1'), { recursive: true, force: true });
  rmSync(RATCHET_PRD, { force: true });
}
const spyEnvRun = (argv, extraEnv = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'casey-agentid-spy-'));
  const spyOut = join(dir, 'touches.txt');
  const r = spawnSync(process.execPath, ['--import', SPY_LOADER, ...argv], {
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, AGENT_ID_SPY_OUT: spyOut, ...extraEnv },
  });
  const touches = existsSync(spyOut) ? readFileSync(spyOut, 'utf8').trim() : '';
  rmSync(dir, { recursive: true, force: true });
  return { r, touches };
};

// sign v1 happy 真执行（带 spy）：face 冻三流+输出集+逐文件 sha+prd 字节；spy 必须零身份模块解析。
let signV1Face = null;
let signV1Touches = null;
let replayControl = null;
let compileControl = null;
try {
  prepareRatchetV1Fixture();
  const signRun = spyEnvRun([join(ROOT, 'bin', 'sign.mjs'), RATCHET_CASE,
    '--draft', `${RATCHET_REL}/expected.draft.json`, '--prd', `loop/prd-${RATCHET_CASE}.json`,
    '--frozen-out', `${RATCHET_REL}/expected.frozen.json`, '--signer', 'golden-human',
    '--against-build', 'ratchet-build', '--signed-at', '2026-07-22T08:00:00.000Z',
    '--events', `${RATCHET_REL}/events.json`, '--entity-bindings-draft', `${RATCHET_REL}/entity-bindings.draft.json`,
    '--entity-confirmations', `${RATCHET_REL}/entity-confirmations.json`,
    '--entity-locks-out', `${RATCHET_REL}/entity-locks.frozen.json`, '--audience', 'test']);
  signV1Touches = signRun.touches;
  const outputs = {};
  for (const f of readdirSync(RATCHET_DIR).sort()) outputs[f] = sha256(readFileSync(join(RATCHET_DIR, f)));
  signV1Face = JSON.stringify({
    status: signRun.r.status, stdout: signRun.r.stdout, stderr: signRun.r.stderr,
    outputs, prdSha256: sha256(readFileSync(RATCHET_PRD)),
  }, null, 2) + '\n';
  // replay 过校验哨兵负控（codex R2-H6）：真 v1 件+未声明身份通道剖面，过全部参数与准入校验、
  // 走到 chromium.launch 哨兵（exit 66）——「完成参数校验后的有效未声明路径」零身份模块解析。
  const sentinel = join(mkdtempSync(join(tmpdir(), 'casey-agentid-sentinel-')), 'launched');
  const rep = spyEnvRun([join(ROOT, 'bin', 'replay.mjs'),
    '--events', `${RATCHET_REL}/events.json`, '--sut', 'http://127.0.0.1:1',
    '--expected', `${RATCHET_REL}/expected.frozen.json`, '--profile', `${RATCHET_REL}/profile.v1.json`,
    '--entity-locks', `${RATCHET_REL}/entity-locks.frozen.json`, '--out', `${RATCHET_REL}/axes.out.json`,
  ], { CASEY_LAUNCH_SENTINEL: sentinel });
  replayControl = { status: rep.r.status, sentinelWritten: existsSync(sentinel), touches: rep.touches, stderrTail: (rep.r.stderr || '').slice(-200) };
  rmSync(dirname(sentinel), { recursive: true, force: true });
} finally {
  cleanupRatchetV1Fixture();
}
// compile 闸段过校验负控：合法 testcase+flow 非 execute 全跑（零浏览器）——真执行路径零身份模块解析。
{
  const dir = mkdtempSync(join(tmpdir(), 'casey-agentid-compilectl-'));
  const tc = join(dir, 'tc.json');
  const flow = join(dir, 'flow.json');
  wf(tc, jt({ schemaVersion: 1, caseId: 'tc_air_ratchet_gate', channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'], intents: [{ intentId: 'intent_nav', text: '进入智能体管理' }, { intentId: 'intent_open', text: '搜索并打开智能体' }] }));
  wf(flow, jt({ id: 'tc_air_ratchet_gate', name: 'ratchet gate-phase control', category: 'normal', steps: [
    { atom: 'nav.agentManagement', params: {}, sourceIntentId: 'intent_nav', entityBindings: [{ candidateId: 'candidate-agent-list', role: 'subject' }] },
    { atom: 'agent.searchOpen', params: { searchKeyword: AGENT_NAME_V1, openName: AGENT_NAME_V1 }, sourceIntentId: 'intent_open', entityBindings: [{ candidateId: 'candidate-agent-main', role: 'subject' }] },
  ] }));
  const cc = spyEnvRun([join(ROOT, 'bin', 'casey.mjs'), 'compile', 'tc_air_ratchet_gate', '--testcase', tc, '--flow', flow, '--out-dir', join(dir, 'out')]);
  compileControl = { status: cc.r.status, touches: cc.touches, stderrTail: (cc.r.stderr || '').slice(-200) };
  rmSync(dir, { recursive: true, force: true });
}
// CLI 无参拒绝三流面（compile/replay；sign 的三流由 v1 happy 面覆盖——其无参 usage 行含新旗标文档，
// 属已声明接口面的合法演进、不入未声明路径冻结面）。
const earlyReject = {};
for (const [tag, entry] of [['compile', 'bin/compile.mjs'], ['replay', 'bin/replay.mjs']]) {
  const r = spawnSync(process.execPath, [join(ROOT, entry)], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  earlyReject[tag] = { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const earlyRejectFace = JSON.stringify(earlyReject, null, 2) + '\n';

// ── sol 五面构造（R2-H6 兑现；面⑦⑧⑨⑩，全程零浏览器/零网络/零 SUT、逐字比较不 normalize）──────
const AGENT_SEARCH_NAME_FACE = '输入智能体名称或编码进行搜索'; // 与 lib/compile-atoms.mjs AGENT_SEARCH_NAME 同字面（编译期作者与回放期消费者同构）
const V1_SEARCHBOX = `role:textbox:${AGENT_SEARCH_NAME_FACE}`;
const jsonFace = (v) => JSON.stringify(v, null, 2) + '\n';

// 面⑦：mock Page/forensics 替身驱【真实】createCompileRun/compileFlow —— v1（未声明身份通道）flow。
// identityObservations/identityGateOutcome 用 ?? 归一：82484ab（字段不存在）与现行（空值）投影同字节，
// 既保跨窗口可录，又冻死「v1 路径零身份观察」这条不变量本身。
async function buildCompileRunV1Face() {
  const page = createMockPage({
    dom: {
      [V1_SEARCHBOX]: { count: 1 },
      [`text:${AGENT_NAME_V1}:exact`]: { count: 1, inContainer: true },
      'role:button:测试': { count: 1 },
    },
    url: 'http://127.0.0.1:4173/',
    titles: ['智能体管理'],
  });
  const run = createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null,
    agentListRoute: '/agent/list', profile: null, identityLedger: null,
  });
  await compileFlow(run, {
    id: 'tc_air_ratchet_face_compile',
    steps: [
      { atom: 'nav.agentManagement', params: {}, sourceIntentId: 'intent_nav', entityBindings: [{ candidateId: 'candidate-agent-list', role: 'subject' }] },
      { atom: 'agent.searchOpen', params: { searchKeyword: AGENT_NAME_V1, openName: AGENT_NAME_V1, code: 'AG-IM-001' }, sourceIntentId: 'intent_open', entityBindings: [{ candidateId: 'candidate-agent-main', role: 'subject' }] },
    ],
  });
  return jsonFace({
    events: run.events,
    verification: run.verification,
    entityBindingProvenance: run.entityBindingProvenance,
    observed: run.observed,
    assertionAtoms: run.assertionAtoms,
    notes: run.notes,
    blockers: run.blockers ?? [],
    identityObservations: run.identityObservations ?? [],
    identityGateOutcome: run.identityGateOutcome ?? null,
  });
}

// 面⑧：同款替身驱【真实】performAction —— 固定 v1 事件脚本逐分支冻动作轴。
async function buildActionAxesV1Face() {
  const page = createMockPage({
    dom: {
      [V1_SEARCHBOX]: { count: 1 },
      [`text:${AGENT_NAME_V1}:exact`]: { count: 1, inContainer: true },
      'text:双子智能体:exact': { count: 2 },
      'role:button:保存草稿': { count: 1, click: 'throw' },
      'role:button:发布': { count: 2 },
      'role:combobox:模型': { count: 1 },
      'css:.hr-select__list>text:平衡:exact': { count: 1 },
    },
  });
  const ctx = { uniqueName: 'atl_fixed', baseUrl: 'http://127.0.0.1:4173' };
  const SEARCH = { kind: 'role', role: 'textbox', name: AGENT_SEARCH_NAME_FACE, exact: true };
  const script = [
    ['纯断言步→kind:none', { stepId: 'ax1', intentId: 'ai1', atom: 'assert.textVisible', action: 'none' }],
    ['nav→null 交回编排器', { stepId: 'ax2', intentId: 'ai2', atom: 'nav.agentManagement', action: 'nav', url: '{{baseUrl}}/agent/list' }],
    ['fill 唯一', { stepId: 'ax3', intentId: 'ai3', atom: 'agent.searchOpen', action: 'fill', semantic: SEARCH, value: 'AG-IM-001' }],
    ['press 唯一', { stepId: 'ax4', intentId: 'ai3', atom: 'agent.searchOpen', action: 'press', key: 'Enter', semantic: SEARCH }],
    ['searchOpen v1 click 唯一', { stepId: 'ax5', intentId: 'ai3', atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: AGENT_NAME_V1, exact: true }, text: AGENT_NAME_V1 }],
    ['searchOpen v1 同名双条目→ambiguous', { stepId: 'ax6', intentId: 'ai4', atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: '双子智能体', exact: true }, text: '双子智能体' }],
    ['searchOpen v1 缺席→none', { stepId: 'ax7', intentId: 'ai5', atom: 'agent.searchOpen', action: 'click', semantic: { kind: 'text', name: '幽灵智能体', exact: true }, text: '幽灵智能体' }],
    ['唯一但动作失败→action_failed', { stepId: 'ax8', intentId: 'ai6', atom: 'workflow.saveDraft', action: 'click', semantic: { kind: 'role', role: 'button', name: '保存草稿', exact: true } }],
    ['通用多匹配→ambiguous 不落笔', { stepId: 'ax9', intentId: 'ai7', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '发布', exact: true } }],
    ['通用缺席→none+漂移探针形状', { stepId: 'ax10', intentId: 'ai8', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '幽灵按钮', exact: true }, targetName: '某行' }],
    ['selectOption 唯一', { stepId: 'ax11', intentId: 'ai9', atom: 'workflow.selectModel', action: 'selectOption', dropdownUnit: { fieldLabel: '模型', optionListSelector: '.hr-select__list', optionText: '平衡' } }],
    ['selectOption 缺席→none+漂移探针形状', { stepId: 'ax12', intentId: 'ai10', atom: 'workflow.selectModel', action: 'selectOption', dropdownUnit: { fieldLabel: '幽灵下拉', optionListSelector: '.hr-select__list', optionText: '平衡' } }],
  ];
  const rows = [];
  for (const [label, ev] of script) rows.push({ label, ev, axis: await performAction(page, ev, ctx) });
  return jsonFace(rows);
}

// 面⑨：固定证据结构驱生产共用纯函数 projectReplayAxes（lib/replay-axes.mjs，自 bin/replay.mjs 逐字搬移）。
// 覆盖：归因归一到代表步 / 孤儿并入首 intent / 凭据路由段打码 / blob: 非 http 脱敏 / intent 折叠洗白禁 /
// 断言多 kind（urlPathname/countChange/textVisible/noErrorEnvelope/noPageError）/ 全局软断言透传。
function buildAxesProjectionV1Face() {
  const ev = (stepId, atom) => ({ stepId, atom });
  return projectReplayAxes({
    caseId: 'tc_air_axes_proj',
    records: [
      { url: 'http://127.0.0.1:4173/api/agents/query?nameLike=alice', status: 200, ts: 1001.001, initiator: 'script', firingStepId: 's1', attributedStepId: 's1', errorEnvelope: { ok: true, status: 200 }, streamFinished: null, streamStatus: null },
      { url: 'http://127.0.0.1:4173/api/token/refresh', status: 200, ts: 1002.002, initiator: 'script', firingStepId: 's1', attributedStepId: null, errorEnvelope: null, streamFinished: null, streamStatus: null },
      { url: 'http://127.0.0.1:4173/api/agents/save', status: 500, ts: 1003.003, initiator: 'script', firingStepId: 's4', attributedStepId: 's4', errorEnvelope: { ok: false, status: 500 }, streamFinished: null, streamStatus: null },
      { url: 'blob:http://127.0.0.1:4173/uuid-0001', status: 200, ts: 1004.004, initiator: 'other', firingStepId: null, attributedStepId: null, errorEnvelope: null, streamFinished: null, streamStatus: null },
      { url: 'http://127.0.0.1:4173/ai-api/background/poll', status: 401, ts: 1005.005, initiator: 'script', firingStepId: 's9', attributedStepId: null, errorEnvelope: null, streamFinished: null, streamStatus: null },
    ],
    intentOrder: ['i1', 'i2', 'i3', 'i4'],
    intentEvents: new Map([
      ['i1', [ev('s1', 'nav.agentManagement'), ev('s2', 'agent.searchOpen')]],
      ['i2', [ev('s3', 'agent.searchOpen'), ev('s4', 'agent.searchOpen')]],
      ['i3', [ev('s5', 'agent.openTestPanel')]],
      ['i4', [ev('s6', 'workflow.bindAgent')]],
    ]),
    reprStepOf: new Map([['i1', 's2'], ['i2', 's4'], ['i3', 's5'], ['i4', 's6']]),
    actionByStep: new Map([
      ['s1', { resolution: 'unique', identityReadback: { ok: true } }],
      ['s2', { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } }],
      ['s3', { resolution: 'none', candidateCount: 0, driftProbe: { sameSignatureUniquePresent: false, candidateCount: 0, matchedSignature: null } }],
      ['s4', { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } }],
      ['s5', { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } }],
      ['s6', { resolution: 'ambiguous', candidateCount: 2 }],
    ]),
    pageErrors: [{ attributedStepId: 's6', message: 'TypeError: 演示页错误' }],
    intentCount: new Map([
      ['i1', { before: 2, after: 3 }], ['i2', { before: null, after: null }],
      ['i3', { before: 1, after: 1 }], ['i4', { before: 0, after: 0 }],
    ]),
    expectedByIntent: new Map([
      ['i1', [
        { kind: 'urlPathname', op: 'startsWith', value: '/agent' },
        { kind: 'countChange', op: 'up', value: 1 },
        { kind: 'textVisible', op: 'appears', value: AGENT_NAME_V1 },
        { kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200' },
      ]],
      ['i2', [{ kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200' }]],
      ['i3', []],
      ['i4', [{ kind: 'noPageError', op: 'absent' }]],
    ]),
    globalAssertions: [{ kind: 'textVisible', op: 'appears', value: '全局软锚', soft: true }],
    intentUrl: new Map([['i1', '/agent/list'], ['i2', '/agent/list'], ['i3', '/agent/detail'], ['i4', '/process/list']]),
    intentToasts: new Map([['i1', []], ['i2', []], ['i3', []], ['i4', []]]),
    intentTextHits: new Map([['i1', { [AGENT_NAME_V1]: 2 }], ['i2', {}], ['i3', {}], ['i4', {}]]),
    intentButtonHits: new Map(),
    intentButtonSeen: new Map(),
    intentButtonDisabledHits: new Map(),
    intentReply: new Map(),
    intentInputReadback: new Map(),
    chatCfg: null,
    allStepIds: new Set(['s1', 's2', 's3', 's4', 's5', 's6']),
  });
}

// 面⑩：面⑨ axes → 真实 bin/verdict.mjs → bin/report-model.mjs（--generated-at 固定）→ bin/report.mjs。
// 四态各一（PASS / SUT_DEFECT / NEEDS_HUMAN·INDETERMINATE / NEEDS_HUMAN·AMBIGUOUS_ACTION）。
// 明示排除（头注）：html/md 字节、report 成功 stdout（绝对路径打印面）。
function buildVerdictReportV1Face(axesProjectionText) {
  const REL = '.golden-scratch-agent-id-regression-diff-axes';
  const DIR = join(ROOT, REL);
  try {
    rmSync(DIR, { recursive: true, force: true });
    mkdirSync(join(DIR, 'report'), { recursive: true });
    wf(join(DIR, 'axes.json'), axesProjectionText);
    const runCli = (argv) => {
      const r = spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    };
    const verdictRun = runCli([join(ROOT, 'bin', 'verdict.mjs'), '--axes', `${REL}/axes.json`, '--out', `${REL}/verdict.json`]);
    const reportModelRun = runCli([join(ROOT, 'bin', 'report-model.mjs'), '--verdict', `${REL}/verdict.json`, '--axes', `${REL}/axes.json`, '--out', `${REL}/report-model.json`, '--generated-at', '2026-07-22T08:00:00.000Z']);
    const rr = runCli([join(ROOT, 'bin', 'report.mjs'), '--model', `${REL}/report-model.json`, '--out', `${REL}/report`]);
    const reportRun = { status: rr.status, stderr: rr.stderr, stdoutNote: '<excluded: 成功 stdout 打印 resolve 后绝对路径，冻它破跨树可移植——见头注排除条>' };
    const shaOf = (rel) => (existsSync(join(DIR, rel)) ? sha256(readFileSync(join(DIR, rel))) : null);
    return jsonFace({
      verdictRun, reportModelRun, reportRun,
      verdictJson: existsSync(join(DIR, 'verdict.json')) ? readFileSync(join(DIR, 'verdict.json'), 'utf8') : null,
      outputs: {
        'axes.json': shaOf('axes.json'),
        'verdict.json': shaOf('verdict.json'),
        'report-model.json': shaOf('report-model.json'),
        'report/tc_air_axes_proj.report.json': shaOf('report/tc_air_axes_proj.report.json'),
      },
      reportFiles: existsSync(join(DIR, 'report')) ? readdirSync(join(DIR, 'report')).sort() : [],
    });
  } finally {
    rmSync(DIR, { recursive: true, force: true });
  }
}

const { faces } = await runRecorder();
faces['sign-v1-cli.json'] = signV1Face;
faces['cli-early-reject.json'] = earlyRejectFace;
faces['compile-run-v1.json'] = await buildCompileRunV1Face();
faces['action-axes-v1.json'] = await buildActionAxesV1Face();
faces['axes-projection-v1.json'] = buildAxesProjectionV1Face();
faces['verdict-report-v1.json'] = buildVerdictReportV1Face(faces['axes-projection-v1.json']);
const FACE_NAMES = Object.keys(faces).sort();

// ── 录制模式（仅未实现树合法一次；见头注）────────────────────────────────────────────
if (process.env.AGENT_ID_BASELINE_RECORD === '1') {
  mkdirSync(BASELINE_DIR, { recursive: true });
  const manifest = { schemaVersion: 1, files: {} };
  for (const name of FACE_NAMES) {
    writeFileSync(join(BASELINE_DIR, name), faces[name], 'utf8');
    manifest.files[name] = sha256(Buffer.from(faces[name], 'utf8'));
  }
  writeFileSync(join(BASELINE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`${TAG}: 基线已录制 → ${BASELINE_DIR}（${FACE_NAMES.length} 面 + manifest.json）`);
}

// ── 比对：逐字节对照 baseline ───────────────────────────────────────────────────────
check('R1 基线在场且文件集与 manifest 恰等（多一件/少一件都红）', () => {
  must(existsSync(join(BASELINE_DIR, 'manifest.json')), `基线缺席：${BASELINE_DIR}/manifest.json 不存在（先在未实现树上录制，见头注）`);
  const manifest = JSON.parse(readFileSync(join(BASELINE_DIR, 'manifest.json'), 'utf8'));
  must(manifest && typeof manifest.files === 'object' && manifest.files !== null, 'manifest.files 缺失/形状非法');
  const onDisk = readdirSync(BASELINE_DIR).filter((f) => f !== 'manifest.json').sort();
  const listed = Object.keys(manifest.files).sort();
  must(JSON.stringify(onDisk) === JSON.stringify(listed),
    `基线目录文件集 ${JSON.stringify(onDisk)} ≠ manifest 清单 ${JSON.stringify(listed)}`);
  must(JSON.stringify(listed) === JSON.stringify(FACE_NAMES),
    `manifest 清单 ${JSON.stringify(listed)} ≠ 本金牌四面 ${JSON.stringify(FACE_NAMES)}`);
});

check('R2 逐文件 sha256 与 manifest 相符（基线内部单点篡改即红）', () => {
  const manifest = JSON.parse(readFileSync(join(BASELINE_DIR, 'manifest.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest.files || {})) {
    const actual = sha256(readFileSync(join(BASELINE_DIR, name)));
    must(actual === expected, `${name} sha256 ${actual} ≠ manifest 记载 ${expected}`);
  }
});

const faceCheck = (label, name) => check(label, () => {
  const p = join(BASELINE_DIR, name);
  must(existsSync(p), `基线文件缺席：${name}`);
  const baseline = readFileSync(p);
  const current = Buffer.from(faces[name], 'utf8');
  must(baseline.equals(current),
    `${name} 字节漂移（棘轮红）：基线 ${baseline.length}B sha256=${sha256(baseline).slice(0, 16)}… ≠ 现行 ${current.length}B sha256=${sha256(current).slice(0, 16)}…`);
});

faceCheck('R3 CDP listener 注册名序列 + send 调用名序列逐字节等于基线', 'cdp-calls.json');
faceCheck('R4 records() drain 前快照逐字节等于基线（归因/denylist/身份形态 url 普通对待）', 'records.pre-drain.json');
faceCheck('R5 records() drain 后快照逐字节等于基线（errorEnvelope 回填面）', 'records.post-drain.json');
faceCheck('R6 api 面（watchNetworkForensics 返回对象键集合）逐字节等于基线', 'api-surface.json');

// ── poison spy（一层：源码结构面）：未声明通道路径下身份模块不得被采集器静态拉入 ────────
IDENTITY_MODULES.forEach((mod, idx) => {
  check(`R${7 + idx} poison spy：lib/${mod} 未被采集器无条件拉入`, () => {
    const modPath = join(ROOT, 'lib', mod);
    if (!existsSync(modPath)) return; // 模块尚不存在 → 无从加载，通过（红先行阶段的物理保证）
    // 模块已落地：读 replay-forensics.mjs 源码字符串判定——顶层静态 import（含裸副作用 import）即红；
    // 动态 import(...)（按需、声明路径内）不在禁面。
    const src = readFileSync(FORENSICS_SRC, 'utf8');
    const specifier = `./${mod}`;
    const staticFrom = new RegExp(`\\bfrom\\s*['"]${specifier.replace(/[.\\/]/g, '\\$&')}['"]`);
    const bareImport = new RegExp(`\\bimport\\s*['"]${specifier.replace(/[.\\/]/g, '\\$&')}['"]`);
    must(!staticFrom.test(src) && !bareImport.test(src),
      `lib/replay-forensics.mjs 含对 ${specifier} 的顶层静态 import——身份模块被无条件拉进采集器（未声明通道路径也会加载，违反 plan §1 独立回调注入）`);
  });
});

// ── poison spy（二层：真实加载证据，codex R1-H6 修复钉）：子进程 loader 探针——
// 未声明身份通道时，加载 compile/replay/sign 三个 CLI 入口（含其静态依赖 compile-atoms /
// replay-actions）绝不解析身份模块；正控证探针机制非空（能逮到真实加载）。
// 修前红：compile-atoms/replay-actions 顶层静态 import agent-identity-gate → 负控探针文件非空。
{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, rmSync: rmTmp } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const SPY_LOADER = join(HERE, 'fixtures', 'agent-id-readback', 'spy-loader.mjs');
  const spyRun = (argv, evalCode = null) => {
    const dir = mkdtempSync(join(tmpdir(), 'casey-agentid-spy-'));
    const spyOut = join(dir, 'touches.txt');
    const args = ['--import', SPY_LOADER, ...(evalCode ? ['--input-type=module', '-e', evalCode] : argv)];
    const r = spawnSync(process.execPath, args, {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, AGENT_ID_SPY_OUT: spyOut },
    });
    const touches = existsSync(spyOut) ? readFileSync(spyOut, 'utf8').trim() : '';
    rmTmp(dir, { recursive: true, force: true });
    return { r, touches };
  };

  const negativeControls = [
    ['R9', 'bin/compile.mjs'],
    ['R10', 'bin/replay.mjs'],
    ['R11', 'bin/sign.mjs'],
  ];
  for (const [tag, entry] of negativeControls) {
    check(`${tag} poison spy 负控：加载 ${entry}（未声明身份通道，无参早退）零身份模块解析`, () => {
      const { r, touches } = spyRun([join(ROOT, entry)]);
      must(r.status !== null, `${entry} 子进程未正常退出（signal=${r.signal}）`);
      must(touches === '', `${entry} 未声明路径解析了身份模块（真实加载证据）：\n${touches}`);
    });
  }

  check('R12 poison spy 正控：显式 import 身份门 → 探针必须逮到（机制非空）', () => {
    const gateUrl = new URL('../../lib/agent-identity-gate.mjs', import.meta.url).href;
    const { r, touches } = spyRun(null, `await import(${JSON.stringify(gateUrl)});`);
    must(r.status === 0, `正控子进程应 exit 0，实得 ${r.status}：${(r.stderr || '').slice(-160)}`);
    must(/agent-identity-gate\.mjs/.test(touches), `正控未逮到身份模块解析（探针机制空转）：${JSON.stringify(touches)}`);
  });
}

// ── 面③④ + 过校验负控（codex R2-H6 升级）────────────────────────────────────────────
faceCheck('R13 sign v1 happy 全链：三流+完整输出文件集合+逐文件 sha256+prd 字节逐字节等于基线（面③④）', 'sign-v1-cli.json');
faceCheck('R14 compile/replay 无参拒绝三流逐字节等于基线（未声明路径 CLI 面）', 'cli-early-reject.json');

check('R15 sign v1 真执行（过全部校验+产物落盘）零身份模块解析（过校验负控）', () => {
  must(signV1Touches === '', `sign v1 真执行解析了身份模块：\n${signV1Touches}`);
});

check('R16 replay 过校验哨兵负控：真 v1 件+未声明剖面过全部准入、到 chromium.launch 哨兵（exit 66）零身份模块解析', () => {
  must(replayControl.status === 66, `应过全部校验到 launch 哨兵 exit 66，实得 ${replayControl.status}：${replayControl.stderrTail}`);
  must(replayControl.sentinelWritten === true, '启动哨兵未写（未走到 launch 点=没证到过校验路径）');
  must(replayControl.touches === '', `replay 过校验未声明路径解析了身份模块：\n${replayControl.touches}`);
});

check('R17 compile 闸段真执行（合法 flow 全跑、零浏览器）零身份模块解析（过校验负控）', () => {
  must(compileControl.status === 0, `闸段应 exit 0，实得 ${compileControl.status}：${compileControl.stderrTail}`);
  must(compileControl.touches === '', `compile 闸段路径解析了身份模块：\n${compileControl.touches}`);
});

// ── sol 五面构造（R2-H6 兑现）：面⑦⑧⑨⑩逐字节对照 ──────────────────────────────────
faceCheck('R18 面⑦ 替身驱真实 createCompileRun/compileFlow：v1 flow 全量产物 JSON 逐字节等于基线（events 字节面）', 'compile-run-v1.json');
faceCheck('R19 面⑧ 替身驱真实 performAction：固定 v1 事件脚本逐事件动作轴逐字节等于基线', 'action-axes-v1.json');
faceCheck('R20 面⑨ 生产共用纯函数 projectReplayAxes：固定证据结构完整 axes 逐字节等于基线', 'axes-projection-v1.json');
faceCheck('R21 面⑩ verdict→report-model→report 真 CLI 链（固定 generatedAt）：三流+verdict/report JSON 逐字节等于基线', 'verdict-report-v1.json');

// ── 收口 ──────────────────────────────────────────────────────────────────────────
const total = passes + failures;
if (failures > 0) {
  console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${total}/${total} 检查全过（82484ab 差分棘轮：未声明身份通道路径字节零漂移）`);
process.exit(0);
