#!/usr/bin/env node
// 冻结黄金标准（replay-login-bootstrap · hermetic）：回放器登录预备动作，opt-in 旗标 --login-bootstrap。
// 决策依 docs/plans/replay-login-bootstrap/proposed/GRILL.md（G1 人签 2026-07-02 取「replay 登录预备动作」）；
// 计划依 docs/plans/replay-login-bootstrap/plan.md。
// 零真机零真凭据：假 SUT = tests/fixtures/login-sut/server.mjs（服务端 cookie 会话、登录标记只落布尔）；
// 凭据源全程隔离（AT_CREDS_FILE 指假路径 + env 假凭据），绝不读仓里 .auth/。
// 实现前必须红：C2（旗标未识别会静默 exit 0）/ C3（不登录则无标记）/ C5（verify 不透传则无标记）。
// 改本文件 = Test Ratchet 判红。
//
// 冻结的 CLI 契约增量：
//   node bin/replay.mjs ... [--login-bootstrap]   开旗标：回放前执行登录预备动作（不产 event、不进 axes、
//       凭据只进内存）；凭据/站点配置前置加载失败或登录失败 → exit 65、不落 axes。缺省行为一字不变。
//   casey compile <caseId> --verify ... [--login-bootstrap]   透传给子 replay。
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-login-bs-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
function run(args, env) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, env });
}
// 凭据源隔离基座：剥掉环境里所有登录相关键，再按 check 需要显式给。
function isoEnv(extra = {}) {
  const e = { ...process.env };
  delete e.AT_CREDS_USER; delete e.AT_CREDS_PASS; delete e.AT_SITE_JSON; delete e.AT_CREDS_FILE;
  return { ...e, ...extra };
}

// 假凭据（显式假 token，只进 env 内存；断言方向：绝不出现在 axes）。
const FAKE_USER = 'u_fake_login';
const FAKE_PASS = 'p_fake_login_927';
const NO_CREDS_FILE = join(tmp, 'nonexistent-creds.json');

// 站点配置（登录入口 = startUrl 路径段；host 无意义占位）。
const SITE_APP = join(tmp, 'site-app.json');
writeFileSync(SITE_APP, JSON.stringify({ target: { startUrl: 'http://sut.invalid/app' } }));
const SITE_PLAIN = join(tmp, 'site-plain.json');
writeFileSync(SITE_PLAIN, JSON.stringify({ target: { startUrl: 'http://sut.invalid/plain' } }));

const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
const EXPECTED_EMPTY = join(tmp, 'expected.empty.json');
writeFileSync(EXPECTED_EMPTY, JSON.stringify({ caseId: 'tc_login_probe', channel: 'web', intents: [], globalAssertions: [] }));

function eventsDoc(entry, clickName) {
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_login_probe',
    url: `{{baseUrl}}${entry}`, recordedAt: '2026-07-02T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
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

const MARKER_A = join(tmp, 'login-marker-a');
const MARKER_B = join(tmp, 'login-marker-b');
const MARKER_C = join(tmp, 'login-marker-c');
let srvApp = null, srvPlain = null, srvVerify = null;

// ---------- C1 旗标缺省零行为差：无旗标（且无任何凭据源）纯页回放照常 ----------
await checkAsync('C1 无旗标零行为差', async () => {
  srvPlain = await startLoginSut({ markerFile: MARKER_B });
  const axesOut = join(tmp, 'axes-c1.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN }));
  if (r.status !== 0) throw new Error(`无旗标应 exit 0（凭据缺席不相干），实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  if (!existsSync(axesOut)) throw new Error('无旗标应照常落 axes');
  const eas = collectEventActions(JSON.parse(readFileSync(axesOut, 'utf8')));
  if (eas.length !== 2 || eas.some((ea) => !ea.action || ea.action.resolution !== 'unique')) throw new Error('纯页两事件应全 unique 回放');
});

// ---------- C2 开旗标缺凭据 fail-closed：exit 65、不落 axes ----------
await checkAsync('C2 缺凭据 fail-closed', async () => {
  const axesOut = join(tmp, 'axes-c2.json');
  const r = run([REPLAY, '--events', EVENTS_APP, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP }));
  if (r.status !== 65) throw new Error(`开旗标缺凭据应 exit 65（fail-closed），实际 ${r.status}`);
  if (existsSync(axesOut)) throw new Error('fail-closed 不得落 axes');
  const errText = String(r.stderr || '');
  if (errText.includes(FAKE_PASS) || errText.includes(FAKE_USER)) throw new Error('错误输出不得回显凭据值');
});

// ---------- C2b 坏凭据文件不回显（codex R1-F1）：JSON.parse 报错自带内容片段，必须消毒 ----------
await checkAsync('C2b 坏凭据文件报错不回显内容', async () => {
  const badCreds = join(tmp, 'bad-creds.json');
  // 故意畸形（值未加引号）：V8 报错形如 Unexpected token 'p', ..."pass":p_fake... —— 原样外印即凭据泄漏。
  writeFileSync(badCreds, '{"user":"u_fake_login","pass":' + FAKE_PASS + '}');
  const axesOut = join(tmp, 'axes-c2b.json');
  const r = run([REPLAY, '--events', EVENTS_APP, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
    isoEnv({ AT_CREDS_FILE: badCreds, AT_SITE_JSON: SITE_APP }));
  if (r.status !== 65) throw new Error(`坏凭据文件应 exit 65（fail-closed），实际 ${r.status}`);
  if (existsSync(axesOut)) throw new Error('fail-closed 不得落 axes');
  // V8 片段截断长口令（实测只露 p_fake_log…）——按片段抓，任何字节外漏都算泄漏。
  if (String(r.stderr || '').includes('p_fake')) throw new Error('stderr 回显了凭据文件内容片段（护栏 #7 红线）');
});

// ---------- C2c 坏站点配置 fail-closed（codex R1-F2）：开旗标不许静默回落默认 ----------
await checkAsync('C2c 坏站点配置 fail-closed 且不回显', async () => {
  const badSite = join(tmp, 'bad-site.json');
  // 畸形 JSON 且内容带站点标记——既验 fail-closed 也验报错不回显文件内容（site.json 同属敏感位）。
  writeFileSync(badSite, '{target:{startUrl:"http://site-secret.invalid/app"}');
  const axesOut = join(tmp, 'axes-c2c.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
    isoEnv({ AT_SITE_JSON: badSite, AT_CREDS_FILE: NO_CREDS_FILE, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
  if (r.status !== 65) throw new Error(`坏站点配置开旗标应 exit 65（拒绝静默回落默认），实际 ${r.status}`);
  if (existsSync(axesOut)) throw new Error('fail-closed 不得落 axes');
  if (String(r.stderr || '').includes('site-secret.invalid')) throw new Error('stderr 回显了站点配置内容（护栏 #7 红线）');
});

// ---------- C3 登录真发生：标记出现 + 事件步全 unique + axes 无登录步无凭据值 ----------
await checkAsync('C3 登录预备动作真发生', async () => {
  srvApp = await startLoginSut({ markerFile: MARKER_A });
  const axesOut = join(tmp, 'axes-c3.json');
  const r = run([REPLAY, '--events', EVENTS_APP, '--sut', srvApp.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
  if (r.status !== 0) throw new Error(`登录后回放应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
  if (!existsSync(MARKER_A)) throw new Error('登录标记缺席——登录预备动作未发生');
  const axesText = readFileSync(axesOut, 'utf8');
  if (axesText.includes(FAKE_PASS) || axesText.includes(FAKE_USER)) throw new Error('axes 含凭据值（护栏 #7 红线）');
  const axes = JSON.parse(axesText);
  const eas = collectEventActions(axes);
  if (eas.length !== 2) throw new Error(`axes 事件动作须恰 2（无登录步混入），实际 ${eas.length}`);
  for (const ea of eas) {
    if (!['atstep_0', 'atstep_1'].includes(ea.stepId)) throw new Error(`axes 混入非 events 步：${ea.stepId}`);
    if (!ea.action || ea.action.resolution !== 'unique') throw new Error(`${ea.stepId} 未过点击身份门（登录墙未解则「进入」必 0）`);
  }
});

// ---------- C4 已登录态幂等：入口无登录表单 → SPA 判据直通、不 POST 登录 ----------
await checkAsync('C4 无表单直通幂等', async () => {
  const axesOut = join(tmp, 'axes-c4.json');
  const r = run([REPLAY, '--events', EVENTS_PLAIN, '--sut', srvPlain.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_PLAIN, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
  if (r.status !== 0) throw new Error(`无表单入口应视作已登录直通 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  if (existsSync(MARKER_B)) throw new Error('无表单不得发生登录 POST');
  const eas = collectEventActions(JSON.parse(readFileSync(axesOut, 'utf8')));
  if (eas.length !== 2 || eas.some((ea) => !ea.action || ea.action.resolution !== 'unique')) throw new Error('直通后两事件应全 unique');
});

// ---------- C5 verify 透传：casey compile --verify --login-bootstrap → 子 replay 登录 ----------
await checkAsync('C5 verify 透传登录旗标', async () => {
  srvVerify = await startLoginSut({ markerFile: MARKER_C });
  const outDir = join(tmp, 'verify-out');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'events.json'), JSON.stringify(eventsDoc('/app', '进入'), null, 2));
  const r = run([CASEY, 'compile', 'tc_login_probe', '--verify', '--sut', srvVerify.url, '--out-dir', outDir, '--profile', PROFILE, '--login-bootstrap'],
    isoEnv({ AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: SITE_APP, AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS }));
  if (r.status !== 0) throw new Error(`verify 带旗标应 exit 0（登录后全 unique），实际 ${r.status}：${(r.stderr || r.stdout || '').slice(-300)}`);
  if (!existsSync(MARKER_C)) throw new Error('登录标记缺席——verify 未把 --login-bootstrap 透传给子 replay');
});

if (srvApp) await srvApp.close();
if (srvPlain) await srvPlain.close();
if (srvVerify) await srvVerify.close();

if (fails.length) {
  for (const f of fails) console.error(`RED  replay-login-bootstrap: ${f}`);
  console.error(`RED  replay-login-bootstrap: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   replay-login-bootstrap: ${pass}/${pass} 全过（opt-in 零行为差+缺凭据 fail-closed+登录真发生+幂等直通+verify 透传）`);
process.exit(0);
