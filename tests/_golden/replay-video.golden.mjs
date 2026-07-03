#!/usr/bin/env node
// 冻结黄金标准（replay-video · hermetic）：回放视频录制——recordVideo 落 runDir + 报告 attachments 接线 + 登录期不入镜。
// 决策依 docs/plans/replay-video/proposed/GRILL.md（D1 同 context 双 page + 登录页视频即删 / D2 装配器直产 attachments /
// D3 渲染升 <video> 可播 / D4 casey run 缺省开启；M1 webm 直出 / M2 case 级单录屏 + 每步 videoAt / M3 --video-dir opt-in /
// M5 缺席容忍 / M7 视频绝不进 verdict、renderJson 零动）；计划依 docs/plans/replay-video/plan.md。
// 零真机零真凭据：假 SUT = tests/fixtures/login-sut/server.mjs；凭据源全程隔离（假 env），绝不读仓里 .auth/。
// 实现前必须红：V1/V3（旗标未识别则无视频产物）/ V4a（装配器不识 --video-meta 不产 attachments）/
// V4c（坏旁件应 fail-closed 非零，未实现时静默 exit 0）/ V5a（渲染器现出 <code> 非 <video>）/
// V5b（渲染器现原样吐 :// 路径）/ V6a（run 编排器未接线无视频）。V2/V4b/V6b 是缺省零行为差回归方向、冻结即绿。
// codex R1 采信重钉（钉红修绿，红实证见 audit）：V5b 扩五形态媒体路径安全门（F2：协议相对/绝对/父目录/URI scheme
// 均曾走私进 src 或路径文本）/ V3b 元数据 :// 零容忍拒写（F3：stepId 源自输入事件曾原样落盘）；
// V7 看门狗清扫为回归方向锁（F1 清扫先行 + F4 测试缝 REPLAY_WATCHDOG_MS 缺省 120s 零变，冻结时即绿）。
// codex R2 采信重钉（双红实证后修绿）：V5b 六形态（N1：内嵌反斜杠曾过门，安全门收窄为拒任意 : 与 \）/
// V3b 预置陈迹（N2：目录复用时旧 video.json/*.webm 曾被当本次产物，起录先清）。
// codex R3 采信重钉（三红实证后修绿）：V5b 七形态（N4：%2e%2e 编码父目录曾过门，安全门改 decode 后逐段白名单）/
// V4c 七形态（N5：装配器曾收任意冒号文件名，收窄纯文件名白名单）/ V8 新增（N6：清扫曾在收敛后过早解除，
// 凭据门 fail-closed 退出曾遗留已收敛 video.webm）。
// 改本文件 = Test Ratchet 判红。
//
// 冻结的 CLI 契约增量：
//   node bin/replay.mjs ... [--video-dir <dir>]   开旗标：context 级录屏，收尾恰余一份 <dir>/video.webm +
//       元数据旁件 <dir>/video.json（{schemaVersion:1,file,startedAt,steps:[{stepId,videoAt}]}，纯相对文件名零 ://）；
//       与 --login-bootstrap 同开时登录期镜头不入镜（登录页视频退出前必删）。缺省行为一字不变。
//   node bin/report-model.mjs ... [--video-meta <f>]   有值：逐步填 attachments{video,videoAt} + 败步 defectTicket.videoAt；
//       缺席零行为差（不产 attachments 键）；坏件 fail-closed 非零退出零落盘。
//   casey run 缺省录屏（--no-video 显式关）；renderReport 的 json 机读旁车恒不投 attachments。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const REPORT_MODEL = join(ROOT, 'bin', 'report-model.mjs');
const LIB_REPORT = join(ROOT, 'lib', 'report.mjs');
const FIX_MODEL = join(HERE, 'fixtures', 'seams', 'report-model.fixture.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-replay-video-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
function run(args, env) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, env });
}
// 凭据源隔离基座（照 replay-login-bootstrap 房式）：剥环境登录键，再按 check 显式给假值。
function isoEnv(extra = {}) {
  const e = { ...process.env };
  delete e.AT_CREDS_USER; delete e.AT_CREDS_PASS; delete e.AT_SITE_JSON; delete e.AT_CREDS_FILE;
  return { ...e, ...extra };
}
const FAKE_USER = 'u_fake_video';
const FAKE_PASS = 'p_fake_video_314';
const NO_CREDS_FILE = join(tmp, 'nonexistent-creds.json');

const CASE_ID = 'tc_video_probe';
const SITE_APP = join(tmp, 'site-app.json');
writeFileSync(SITE_APP, JSON.stringify({ target: { startUrl: 'http://sut.invalid/app' } }));
const SITE_PLAIN = join(tmp, 'site-plain.json');
writeFileSync(SITE_PLAIN, JSON.stringify({ target: { startUrl: 'http://sut.invalid/plain' } }));
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
const EXPECTED_EMPTY = join(tmp, 'expected.empty.json');
writeFileSync(EXPECTED_EMPTY, JSON.stringify({ caseId: CASE_ID, channel: 'web', intents: [], globalAssertions: [] }));

function eventsDoc(entry, clickName) {
  return {
    schemaVersion: 2, channel: 'web', caseId: CASE_ID,
    url: `{{baseUrl}}${entry}`, recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', action: 'nav', url: `{{baseUrl}}${entry}` },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'click', semantic: { kind: 'role', role: 'button', name: clickName, exact: true } },
    ],
  };
}
const EVENTS_APP = join(tmp, 'events-app.json');
writeFileSync(EVENTS_APP, JSON.stringify(eventsDoc('/app', '进入'), null, 2));
const EVENTS_PLAIN = join(tmp, 'events-plain.json');
writeFileSync(EVENTS_PLAIN, JSON.stringify(eventsDoc('/plain', '直达'), null, 2));

function collectEventActions(axes) {
  const out = [];
  for (const s of axes.steps || []) for (const ea of s.eventActions || []) out.push(ea);
  return out;
}
const webms = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webm')) : []);

// 视频元数据旁件形状自守（冻结形状：schemaVersion 1 / file 纯相对文件名零 :// / steps 逐事件步偏移）。
function assertVideoJson(p, expectStepIds) {
  const text = readFileSync(p, 'utf8');
  if (text.includes(FAKE_PASS) || text.includes(FAKE_USER)) throw new Error('video.json 含凭据值（护栏 #7 红线）');
  if (text.includes('://')) throw new Error('video.json 含 ://（应纯相对文件名，零容忍）');
  const v = JSON.parse(text);
  if (v.schemaVersion !== 1) throw new Error(`video.json schemaVersion 须 1，实际 ${v.schemaVersion}`);
  if (v.file !== 'video.webm') throw new Error(`video.json file 须语义名 video.webm，实际 ${v.file}`);
  if (typeof v.startedAt !== 'number' || !(v.startedAt > 0)) throw new Error('video.json startedAt 须正数毫秒时刻');
  if (!Array.isArray(v.steps)) throw new Error('video.json steps 须数组');
  const ids = v.steps.map((s) => s.stepId);
  if (JSON.stringify(ids) !== JSON.stringify(expectStepIds)) throw new Error(`video.json steps 步序须 ${expectStepIds.join(',')}，实际 ${ids.join(',')}`);
  let prev = -1;
  for (const s of v.steps) {
    if (typeof s.videoAt !== 'number' || !Number.isFinite(s.videoAt) || s.videoAt < 0) throw new Error(`步 ${s.stepId} videoAt 须非负有限数`);
    if (s.videoAt < prev) throw new Error('videoAt 须随步单调不减（case 级单录屏偏移）');
    prev = s.videoAt;
  }
  return v;
}

let srvApp = null, srvPlain = null;

// ---------- V1 登录舞步 + 卫生：--login-bootstrap 与 --video-dir 同开，登录期镜头不入镜 ----------
await checkAsync('V1 登录舞步录屏且登录页视频必删', async () => {
  srvApp = await startLoginSut({ markerFile: join(tmp, 'marker-v1') });
  const vdir = join(tmp, 'v1-video'); mkdirSync(vdir, { recursive: true });
  const axesOut = join(tmp, 'axes-v1.json');
  const r = run([REPLAY, '--events', EVENTS_APP, '--sut', srvApp.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap', '--video-dir', vdir],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
  if (r.status !== 0) throw new Error(`登录+录屏回放应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const vs = webms(vdir);
  if (vs.length !== 1 || vs[0] !== 'video.webm') throw new Error(`录屏目录须恰余一份 video.webm（登录页视频必删、回放页收敛语义名），实际 [${vs.join(',')}]`);
  if (!(statSync(join(vdir, 'video.webm')).size > 0)) throw new Error('video.webm 空文件');
  assertVideoJson(join(vdir, 'video.json'), ['atstep_0', 'atstep_1']);
  // 双 page 舞步不得弱化既有回放语义：事件步全 unique、登录期流量与凭据值不进 axes。
  const axesText = readFileSync(axesOut, 'utf8');
  if (axesText.includes(FAKE_PASS) || axesText.includes(FAKE_USER)) throw new Error('axes 含凭据值（护栏 #7 红线）');
  if (axesText.includes('/api/login')) throw new Error('axes 含登录期请求（login-traffic-drop 不变量被舞步弱化）');
  const eas = collectEventActions(JSON.parse(axesText));
  if (eas.length !== 2 || eas.some((ea) => !ea.action || ea.action.resolution !== 'unique')) throw new Error('登录墙后两事件应全 unique（舞步须先过登录再回放）');
});

// ---------- V2 缺省零行为差：不带 --video-dir 无任何视频产物 ----------
await checkAsync('V2 缺省零行为差', async () => {
  srvPlain = await startLoginSut({ markerFile: join(tmp, 'marker-v2') });
  const outDir = join(tmp, 'v2-out'); mkdirSync(outDir, { recursive: true });
  const axesOut = join(outDir, 'axes.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN }));
  if (r.status !== 0) throw new Error(`无旗标应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  if (webms(outDir).length !== 0) throw new Error('缺省不得产视频文件');
  if (existsSync(join(outDir, 'video.json'))) throw new Error('缺省不得产 video.json');
});

// ---------- V3 无登录单 page 录屏 ----------
await checkAsync('V3 无登录单 page 录屏', async () => {
  const vdir = join(tmp, 'v3-video'); mkdirSync(vdir, { recursive: true });
  const axesOut = join(tmp, 'axes-v3.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--video-dir', vdir],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN }));
  if (r.status !== 0) throw new Error(`录屏回放应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const vs = webms(vdir);
  if (vs.length !== 1 || vs[0] !== 'video.webm') throw new Error(`须恰一份 video.webm，实际 [${vs.join(',')}]`);
  assertVideoJson(join(vdir, 'video.json'), ['atstep_0', 'atstep_1']);
  const eas = collectEventActions(JSON.parse(readFileSync(axesOut, 'utf8')));
  if (eas.length !== 2 || eas.some((ea) => !ea.action || ea.action.resolution !== 'unique')) throw new Error('录屏开启不得改变回放语义（两事件全 unique）');
});

// ---------- V3b 元数据 :// 零容忍拒写（codex R1-F3）：stepId 源自输入事件、可走私 URL 形态 ----------
await checkAsync('V3b 元数据 :// 零容忍拒写（缺席容忍）+ 陈迹起录必清', async () => {
  const vdir = join(tmp, 'v3b-video'); mkdirSync(vdir, { recursive: true });
  // 陈迹预置（codex R2-N2）：复用目录里的旧旁件/旧镜头不得被当成本次产物——起录必清。
  writeFileSync(join(vdir, 'video.json'), JSON.stringify({ schemaVersion: 1, file: 'stale.webm', startedAt: 1, steps: [] }) + '\n');
  writeFileSync(join(vdir, 'stale.webm'), 'not-a-real-video');
  const evil = join(tmp, 'events-evil-stepid.json');
  const doc = eventsDoc('/plain', '直达');
  doc.events[1] = { ...doc.events[1], stepId: 'atstep_1://smuggle' };
  writeFileSync(evil, JSON.stringify(doc, null, 2));
  const axesOut = join(tmp, 'axes-v3b.json');
  const r = run([REPLAY, '--events', evil, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--video-dir', vdir],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN }));
  if (r.status !== 0) throw new Error(`回放应照常 exit 0（旁件拒写是缺席容忍、不翻回放结果），实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  if (existsSync(join(vdir, 'video.json'))) throw new Error('video.json 应缺席（陈迹起录必清 + 本次走私 :// 拒写）');
  const vs = webms(vdir);
  if (vs.length !== 1 || vs[0] !== 'video.webm') throw new Error(`目录须恰余本次 video.webm（陈迹 stale.webm 必清），实际 [${vs.join(',')}]`);
});

// ---------- V4 装配器：--video-meta 直产 attachments；缺席零行为差；坏件 fail-closed ----------
// 手工构造 verdict⋈axes 一致对（镜像 decide()）：atstep_0 PASS、atstep_1 SUT_DEFECT（失败硬断言 + 500 归因背书）。
const V4DIR = join(tmp, 'v4'); mkdirSync(V4DIR, { recursive: true });
const AXES_V4 = join(V4DIR, 'axes.json');
writeFileSync(AXES_V4, JSON.stringify({
  caseId: CASE_ID,
  steps: [
    { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', action: { resolution: 'unique' },
      postAssertions: [{ kind: 'textVisible', op: 'contains', value: '列表', actual: '列表', ok: true, soft: false }],
      forensics: { network: [], lifecycle: {} } },
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.publish', action: { resolution: 'unique' },
      postAssertions: [{ kind: 'textVisible', op: 'contains', value: '已发布', actual: null, ok: false, soft: false }],
      forensics: { network: [{ url: '/api/publish', status: 500, initiator: 'fetch', attributedStepId: 'atstep_1' }], lifecycle: {} } },
  ],
}, null, 2));
const VERDICT_V4 = join(V4DIR, 'verdict.json');
writeFileSync(VERDICT_V4, JSON.stringify({
  caseId: CASE_ID,
  steps: [
    { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', verdict: 'PASS', reason: null },
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.publish', verdict: 'SUT_DEFECT', reason: null },
  ],
}, null, 2));
const META_OK = join(V4DIR, 'video.json');
writeFileSync(META_OK, JSON.stringify({ schemaVersion: 1, file: 'video.webm', startedAt: 1783000000000, steps: [
  { stepId: 'atstep_0', videoAt: 0 }, { stepId: 'atstep_1', videoAt: 4200 },
] }, null, 2));
const GEN_AT = '2026-07-03T00:00:00.000Z';
const rmArgs = (out, extra = []) => [REPORT_MODEL, '--verdict', VERDICT_V4, '--axes', AXES_V4, '--generated-at', GEN_AT, '--out', out, ...extra];

await checkAsync('V4a 装配器直产 attachments 与败步 videoAt', async () => {
  const out = join(V4DIR, 'model-with-video.json');
  const r = run(rmArgs(out, ['--video-meta', META_OK]));
  if (r.status !== 0) throw new Error(`带 --video-meta 装配应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const model = JSON.parse(readFileSync(out, 'utf8'));
  const s0 = model.steps.find((s) => s.stepId === 'atstep_0');
  const s1 = model.steps.find((s) => s.stepId === 'atstep_1');
  if (!s0.attachments || s0.attachments.video !== 'video.webm' || s0.attachments.videoAt !== 0) throw new Error(`atstep_0 attachments 须 {video:video.webm, videoAt:0}，实际 ${JSON.stringify(s0.attachments)}`);
  if (!s1.attachments || s1.attachments.video !== 'video.webm' || s1.attachments.videoAt !== 4200) throw new Error(`atstep_1 attachments 须 {video:video.webm, videoAt:4200}，实际 ${JSON.stringify(s1.attachments)}`);
  if (!s1.defectTicket || s1.defectTicket.videoAt !== 4200) throw new Error(`败步缺陷单 videoAt 须 4200（据此跳转录屏），实际 ${JSON.stringify(s1.defectTicket && s1.defectTicket.videoAt)}`);
});

await checkAsync('V4b 缺席零行为差（不产 attachments 键）', async () => {
  const out = join(V4DIR, 'model-no-video.json');
  const r = run(rmArgs(out));
  if (r.status !== 0) throw new Error(`无 --video-meta 装配应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  const text = readFileSync(out, 'utf8');
  if (text.includes('"attachments"')) throw new Error('无旁件不得产 attachments 键（缺省零行为差）');
  const model = JSON.parse(text);
  const s1 = model.steps.find((s) => s.stepId === 'atstep_1');
  if (s1.defectTicket.videoAt !== null) throw new Error('无旁件缺陷单 videoAt 须 null');
});

await checkAsync('V4c 坏旁件 fail-closed 非零退出零落盘', async () => {
  const bads = [
    ['坏 JSON', '{file:'],
    ['非对象', '[1,2]'],
    ['file 带 ://', JSON.stringify({ schemaVersion: 1, file: 'http://x.example/v.webm', startedAt: 1, steps: [] })],
    ['file 带路径段', JSON.stringify({ schemaVersion: 1, file: '../escape/video.webm', startedAt: 1, steps: [] })],
    ['file 带冒号', JSON.stringify({ schemaVersion: 1, file: 'javascript:evil.webm', startedAt: 1, steps: [] })],
    ['steps 行缺 stepId', JSON.stringify({ schemaVersion: 1, file: 'video.webm', startedAt: 1, steps: [{ videoAt: 3 }] })],
    ['videoAt 非数', JSON.stringify({ schemaVersion: 1, file: 'video.webm', startedAt: 1, steps: [{ stepId: 'atstep_0', videoAt: 'x' }] })],
  ];
  for (const [label, content] of bads) {
    const badPath = join(V4DIR, `bad-${label.replace(/[^a-z0-9一-龥]/gi, '_')}.json`);
    writeFileSync(badPath, content);
    const out = join(V4DIR, `model-bad-${Math.random().toString(36).slice(2)}.json`);
    const r = run(rmArgs(out, ['--video-meta', badPath]));
    if (r.status === 0) throw new Error(`坏旁件（${label}）应 fail-closed 非零退出，实际 exit 0`);
    if (existsSync(out)) throw new Error(`坏旁件（${label}）fail-closed 不得落盘 model`);
  }
});

// ---------- V5 渲染器：<video> 可播 + :// 零容忍 + json 机读旁车零动 ----------
let renderReport;
await checkAsync('V5a 渲染 <video> 可播且自包含', async () => {
  ({ renderReport } = await import(`file://${LIB_REPORT.replace(/\\/g, '/')}`));
  const model = JSON.parse(readFileSync(FIX_MODEL, 'utf8'));
  const withVideo = model.steps.filter((s) => s.attachments && s.attachments.video);
  if (!withVideo.length) throw new Error('fixture 异常：无带 attachments.video 的步');
  const { html, json } = renderReport(model);
  for (const s of withVideo) {
    const marker = `data-step-id="${s.stepId}"`;
    const i = html.indexOf(marker);
    if (i < 0) throw new Error(`HTML 缺步 ${s.stepId} 容器`);
    const rest = html.slice(i); const next = rest.indexOf('data-step-id="', marker.length);
    const sec = next < 0 ? rest : rest.slice(0, next + marker.length);
    if (!/<video[^>]*\scontrols/i.test(sec)) throw new Error(`步 ${s.stepId} 须渲染 <video controls>（内联可播）`);
    if (!sec.includes(`src="${s.attachments.video}"`)) throw new Error(`步 ${s.stepId} <video> 须相对路径 src="${s.attachments.video}"`);
  }
  if (/https?:\/\//i.test(html)) throw new Error('HTML 含外链——自包含被破坏');
  if (json.includes('"attachments"')) throw new Error('json 机读旁车不得投 attachments（守恒零动先例）');
});

await checkAsync('V5b 渲染器媒体路径安全门（codex R1-F2/R2-N1/R3-N4 七形态）', async () => {
  const bads = [
    ['http://x.example/v.webm', 'x.example'],
    ['//x.example/v.webm', 'x.example'],
    ['/abs/leak.webm', 'leak.webm'],
    ['../escape.webm', 'escape.webm'],
    ['data:video/webm;base64,QUFB', 'data:video'],
    ['foo\\bar.webm', 'bar.webm'],
    ['%2e%2e/escape.webm', 'escape.webm'],
  ];
  for (const [bad, marker] of bads) {
    const model = JSON.parse(readFileSync(FIX_MODEL, 'utf8'));
    for (const s of model.steps) if (s.attachments && s.attachments.video) s.attachments.video = bad;
    const { html } = renderReport(model);
    if (html.includes(marker)) throw new Error(`渲染器吐出非安全媒体路径（${bad}）——应整值脱敏占位（宁失细节不漏形态）`);
    if (/<video[\s>]/i.test(html)) throw new Error(`非安全媒体路径（${bad}）不得渲染 <video> 标签`);
  }
});

// ---------- V6 run 编排器：缺省录屏接线全管线 + --no-video 显式关 ----------
await checkAsync('V6a run 缺省录屏至报告可播', async () => {
  const srvRun = await startLoginSut({ markerFile: join(tmp, 'marker-v6a') });
  try {
    const runDir = join(tmp, 'v6a-run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', srvRun.url, '--events', EVENTS_APP, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--run-dir', runDir, '--login-bootstrap'],
      isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
    if (r.status !== 0) throw new Error(`run 应 exit 0，实际 ${r.status}：${(r.stderr || r.stdout || '').slice(-300)}`);
    const vs = webms(runDir);
    if (vs.length !== 1 || vs[0] !== 'video.webm') throw new Error(`runDir 须恰一份 video.webm（缺省开启 + 登录页视频必删），实际 [${vs.join(',')}]`);
    assertVideoJson(join(runDir, 'video.json'), ['atstep_0', 'atstep_1']);
    const modelText = readFileSync(join(runDir, 'report-model.json'), 'utf8');
    if (!modelText.includes('"attachments"') || !modelText.includes('"video.webm"')) throw new Error('report-model.json 未接线 attachments（编排器未把 video.json 传给装配 stage）');
    const html = readFileSync(join(runDir, `${CASE_ID}.report.html`), 'utf8');
    if (!/<video[^>]*\scontrols/i.test(html)) throw new Error('报告 HTML 无 <video controls>（录屏未内联可播）');
    if (/https?:\/\//i.test(html)) throw new Error('报告 HTML 含外链——自包含被破坏');
  } finally { await srvRun.close(); }
});

await checkAsync('V6b run --no-video 显式关', async () => {
  const srvRun = await startLoginSut({ markerFile: join(tmp, 'marker-v6b') });
  try {
    const runDir = join(tmp, 'v6b-run');
    const r = run([CASEY, 'run', CASE_ID, '--sut', srvRun.url, '--events', EVENTS_APP, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--run-dir', runDir, '--login-bootstrap', '--no-video'],
      isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
    if (r.status !== 0) throw new Error(`run --no-video 应 exit 0，实际 ${r.status}：${(r.stderr || r.stdout || '').slice(-300)}`);
    if (webms(runDir).length !== 0) throw new Error('--no-video 不得产视频文件');
    if (existsSync(join(runDir, 'video.json'))) throw new Error('--no-video 不得产 video.json');
    if (readFileSync(join(runDir, 'report-model.json'), 'utf8').includes('"attachments"')) throw new Error('--no-video 的 report-model 不得产 attachments 键');
  } finally { await srvRun.close(); }
});

// ---------- V8 已收敛录像遇凭据门失败必清（codex R3-N6）：fail-closed 退出不留任何录像产物 ----------
await checkAsync('V8 凭据门拦截后不得遗留已收敛录像', async () => {
  const vdir = join(tmp, 'v8-video'); mkdirSync(vdir, { recursive: true });
  // 断言值携敏感词（password-wall）→ axes 文本命中凭据兜底门关键词 → 落盘拒写 exit 1；
  // 此刻录像已收敛（video.webm 已改名落盘）——fail-closed 退出必须连它一起清，不许半干净。
  const expectedHot = join(tmp, 'expected.credword.json');
  writeFileSync(expectedHot, JSON.stringify({ caseId: CASE_ID, channel: 'web', intents: [], globalAssertions: [
    { assertionId: 'ga_1', kind: 'textVisible', op: 'contains', value: 'password-wall', soft: false },
  ] }));
  const axesOut = join(tmp, 'axes-v8.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', expectedHot, '--profile', PROFILE, '--out', axesOut, '--video-dir', vdir],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN }));
  if (r.status === 0) throw new Error('断言值携敏感词应触发凭据兜底门非零退出');
  if (existsSync(axesOut)) throw new Error('凭据门命中不得落 axes');
  if (webms(vdir).length !== 0) throw new Error(`凭据门命中不得遗留已收敛录像：[${webms(vdir).join(',')}]`);
  if (existsSync(join(vdir, 'video.json'))) throw new Error('凭据门命中不得遗留 video.json');
});

// ---------- V7 看门狗清扫（codex R1-F1/F4）：挂死 SUT 强触看门狗，镜头残件必清 ----------
// REPLAY_WATCHDOG_MS 是缺省零变（120s）的测试缝；本检查是回归方向锁（清扫先行语义），冻结时即绿。
await checkAsync('V7 看门狗强退不留镜头残件', async () => {
  const hangSrv = createServer(() => { /* 永不响应：nav 卡死到看门狗 */ });
  await new Promise((res) => hangSrv.listen(0, '127.0.0.1', res));
  try {
    const vdir = join(tmp, 'v7-video'); mkdirSync(vdir, { recursive: true });
    const axesOut = join(tmp, 'axes-v7.json');
    const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', `http://127.0.0.1:${hangSrv.address().port}`, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--video-dir', vdir],
      isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN, REPLAY_WATCHDOG_MS: '6000' }));
    if (r.status === 0) throw new Error('挂死 SUT 应看门狗强退非零');
    if (webms(vdir).length !== 0) throw new Error(`看门狗强退遗留镜头残件：[${webms(vdir).join(',')}]`);
    if (existsSync(join(vdir, 'video.json'))) throw new Error('看门狗强退不得落 video.json');
    if (existsSync(axesOut)) throw new Error('看门狗强退不得落 axes');
  } finally {
    if (hangSrv.closeAllConnections) hangSrv.closeAllConnections();
    hangSrv.close();
  }
});

if (srvApp) await srvApp.close();
if (srvPlain) await srvPlain.close();

if (fails.length) {
  for (const f of fails) console.error(`RED  replay-video: ${f}`);
  console.error(`RED  replay-video: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   replay-video: ${pass}/${pass} 全过（登录不入镜舞步+缺省零行为差+装配直产+渲染可播+run 缺省接线）`);
process.exit(0);
