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
//   残余义务如实声明：plan §6 面②的「动作轴/axes/report JSON 字节」依赖浏览器执行产物，零 SUT
//     不可达——须 plan 权威修正或随真机链义务处置（修单挂账，不静默消灭）。
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

const { faces } = await runRecorder();
faces['sign-v1-cli.json'] = signV1Face;
faces['cli-early-reject.json'] = earlyRejectFace;
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

// ── 收口 ──────────────────────────────────────────────────────────────────────────
const total = passes + failures;
if (failures > 0) {
  console.error(`RED  ${TAG}: ${failures}/${total} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${total}/${total} 检查全过（82484ab 差分棘轮：未声明身份通道路径字节零漂移）`);
process.exit(0);
