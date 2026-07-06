// video-login-carry.golden.mjs —— 舞步登录态收割-注入（video-login-carry，full）红金牌。
// 缺陷复现面（真机 2026-07-06 实证）：登录态只活在 sessionStorage（页签级）时，双 page 舞步的 page2
// 拿不到登录态 → 回放全事件 locatorResolution none。夹具 login-sut /app-session 复刻该形态：
// 三键随机值 + 页面壳内嵌期望值校验，三键值全对才渲染受保护 UI（codex R1-F3：钉「全键值快照」语义，
// 硬编码键名/常量值/部分携带都进不了应用页）。
// S1 舞步收割-注入（实现前红）：--login-bootstrap 与 --video-dir 同开对 session 模式 → 步 resolution unique
//    + identityReadback.ok（动作真发生，axes 接缝信号）+ video.webm/video.json 落盘（现状红：resolution none）。
// S3 单 page 零差回归：同 session 模式无 --video-dir → unique + identityReadback.ok 且无视频产物
//    （单 page 天然继承页签存储，修前修后恒绿——锁「修舞步不得破单 page 路径」；codex R1-F4 补回读断言）。
// S4 跨 origin 负向（codex R1-F2 + R2-F2）：B 实例复用 A 的三键值（origin 门成为唯一分界，A/B 键值深等已断）。
//    replay 的 nav 步被机制钉在 --sut 基址（bin/replay.mjs 对 nav 只取路径段重基），跨 origin 转移只能由
//    SUT 自身跳转发生——A 应用页渲「外链」锚点指向 B，click 外链真跨 origin 后（B 命中标记证跳转真落 B），
//    B 上 click 进入必 none（快照不外溢）且 B 从未收到登录 POST。无条件种入实现必红。
// S5 特殊键保真（codex R2-F4）：sessionKeys 含自有 __proto__ 键，舞步收割-注入后 page2 仍渲应用页
//    （intent_1 unique）——证收割用 entries 而非普通对象、__proto__ 等键不被 [[Set]] 吞。旧 {} 实现必红。
// S2 凭据卫生负向（收尾全扫，codex R1-F1 + R2-F3）：递归 Buffer 级扫描全部落盘产物（axes/run-history/
//    run-metrics/video.json/webm 及一切工作目录文件）+ 全轮次 replay stdout/stderr + 全夹具实例 stdout/stderr
//    （capture 管道），不含任何实例键值与假凭据字面量。report 未在本金牌生成：report 是 axes+video.json 的
//    纯渲染（其卫生由 p7-report/report-fidelity/p7-credgate-coverage 持锁），本扫描盖住其全部输入。
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-video-login-carry-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}
function run(args, env) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, env });
}
// 凭据源隔离基座（照 replay-video 房式）：剥环境登录键，再按 check 显式给假值。
function isoEnv(extra = {}) {
  const e = { ...process.env };
  delete e.AT_CREDS_USER; delete e.AT_CREDS_PASS; delete e.AT_SITE_JSON; delete e.AT_CREDS_FILE;
  return { ...e, ...extra };
}
const FAKE_USER = 'u_fake_carry';
const FAKE_PASS = 'p_fake_carry_271';
const NO_CREDS_FILE = join(tmp, 'nonexistent-creds.json');
const RUN_ENV = { AT_CREDS_FILE: NO_CREDS_FILE, AT_SITE_JSON: '', AT_CREDS_USER: FAKE_USER, AT_CREDS_PASS: FAKE_PASS };

const CASE_ID = 'tc_carry_probe';
const SITE_SESSION = join(tmp, 'site-session.json');
writeFileSync(SITE_SESSION, JSON.stringify({ target: { startUrl: 'http://sut.invalid/app-session' } }));
RUN_ENV.AT_SITE_JSON = SITE_SESSION;
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
const EXPECTED_EMPTY = join(tmp, 'expected.empty.json');
writeFileSync(EXPECTED_EMPTY, JSON.stringify({ caseId: CASE_ID, channel: 'web', intents: [], globalAssertions: [] }));

function eventsDoc(events) {
  return JSON.stringify({
    schemaVersion: 2, channel: 'web', caseId: CASE_ID,
    url: '{{baseUrl}}/app-session', recordedAt: '2026-07-06T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false, events,
  }, null, 2);
}
const NAV0 = { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', action: 'nav', url: '{{baseUrl}}/app-session' };
const CLICK_ENTER = (n) => ({ stepId: `atstep_${n}`, intentId: `intent_${n}`, atom: 'workflow.create', action: 'click', semantic: { kind: 'role', role: 'button', name: '进入', exact: true } });
const EVENTS_SESSION = join(tmp, 'events-session.json');
writeFileSync(EVENTS_SESSION, eventsDoc([NAV0, CLICK_ENTER(1)]));

const webms = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.webm')) : []);
const stepOf = (axes, iid) => (axes.steps || []).find((s) => s.intentId === iid);
const actedOk = (st) => !!(st && st.action && st.action.resolution === 'unique' && st.action.identityReadback && st.action.identityReadback.ok === true);

const SECRETS = []; // 全部实例键值 + 假凭据：收尾 S2 全扫的黑名单
const OUTS = [];    // 全轮次 replay stdout/stderr
const SUTS = [];    // 全夹具实例（capture 模式）：收尾 S2 扫其 stdout/stderr
function collectRun(r) { OUTS.push(r.stdout || '', r.stderr || ''); return r; }
// 统一起夹具：capture 管道（S2 扫夹具输出）+ 登记键值黑名单。
async function startSut(opts) {
  const srv = await startLoginSut({ ...opts, capture: true });
  SUTS.push(srv);
  SECRETS.push(...Object.values(srv.sessionKeys));
  return srv;
}
// 自有 __proto__ 键（S5）：计算属性/赋值都进不了普通对象，只能 defineProperty 造自有可枚举数据属性。
function withProtoKey(base, protoVal) {
  const o = { ...base };
  Object.defineProperty(o, '__proto__', { value: protoVal, enumerable: true, writable: true, configurable: true });
  return o;
}

// ---------- S1 舞步收割-注入（实现前红：page2 无 sessionStorage → resolution none） ----------
await checkAsync('S1 舞步下 session 登录态须继承：步 unique + identityReadback.ok + 视频产物落盘', async () => {
  const srv = await startSut({ markerFile: join(tmp, 'marker-s1') });
  try {
    const vdir = join(tmp, 'v-s1');
    const axesOut = join(tmp, 'axes-s1.json');
    const r = collectRun(run([REPLAY, '--events', EVENTS_SESSION, '--sut', srv.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut,
      '--run-history', join(tmp, 'hist-s1.jsonl'), '--run-metrics', join(tmp, 'metr-s1.json'), '--run-id', 'run_s1', '--login-bootstrap', '--video-dir', vdir],
      isoEnv(RUN_ENV)));
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const st = stepOf(JSON.parse(readFileSync(axesOut, 'utf8')), 'intent_1');
    if (!st) throw new Error('axes 缺 intent_1 步');
    const resolution = st.action && st.action.resolution;
    if (resolution !== 'unique') throw new Error(`「进入」步应 unique（登录态须继承到 page2），实际 ${resolution}`);
    // 动作真发生按冻结接缝断：axes 动作轴无 actionPerformed 字段（那是 verdict 衍生概念），
    // 等强度信号 = identityReadback.ok（doAct 真实成功回读，replay-actions 唯一写者）。
    if (!actedOk(st)) throw new Error('「进入」步应 identityReadback.ok=true（动作真发生）');
    if (webms(vdir).length !== 1) throw new Error(`视频目录应恰 1 份 webm，实际 ${webms(vdir).length}`);
    if (!existsSync(join(vdir, 'video.json'))) throw new Error('video.json 应落盘');
    const marker = readFileSync(join(tmp, 'marker-s1'), 'utf8');
    if (marker.trim() !== '1') throw new Error('登录标记应为 1（登录 POST 应到达 /api/login-session）');
  } finally {
    await srv.close(); // 各 check 内即关（await 'close' 保 capture 输出全落），S2 扫描前全部 SUT 已收口（codex R3-F1）
  }
});

// ---------- S3 单 page 零差回归：无 --video-dir 的 session 模式恒绿 ----------
await checkAsync('S3 单 page 路径零差：session 模式无录像 → unique + identityReadback.ok 且无视频产物', async () => {
  const srv = await startSut({ markerFile: join(tmp, 'marker-s3') });
  try {
    const axesOut = join(tmp, 'axes-s3.json');
    const r = collectRun(run([REPLAY, '--events', EVENTS_SESSION, '--sut', srv.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut, '--login-bootstrap'],
      isoEnv(RUN_ENV)));
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const st = stepOf(JSON.parse(readFileSync(axesOut, 'utf8')), 'intent_1');
    if (!st) throw new Error('axes 缺 intent_1 步');
    if (!actedOk(st)) throw new Error(`单 page 路径「进入」步应 unique 且 identityReadback.ok，实际 ${JSON.stringify(st.action)}`);
    if (webms(tmp).length !== 0) throw new Error('无 --video-dir 不得产 webm（缺省零行为差）');
  } finally {
    await srv.close();
  }
});

// ---------- S4 跨 origin 负向：B 实例同三键值，origin 门是唯一分界（无条件种入实现必红） ----------
await checkAsync('S4 异 origin 不种入：SUT 自身跳转到 B（命中已证）后 click 必 none 且 B 无登录 POST', async () => {
  // 127.0.0.1:portA 与 127.0.0.1:portB 是不同 origin；B 页面壳期望值与 A 完全相同（键值深等已断）——
  // 若实现不做 location.origin 恒等校验（无条件种入），B 将渲染应用页、click 变 unique，本检查即红。
  // 跳转形态：replay 的 nav 步被钉在 --sut 基址（机制），跨 origin 只能由 SUT 自身跳转（外链锚点）发生。
  const hitB = join(tmp, 'hit-s4b');
  const srvB = await startSut({ markerFile: join(tmp, 'marker-s4b'), hitMarkerFile: hitB });
  const srvA = await startSut({ markerFile: join(tmp, 'marker-s4a'), sessionKeys: srvB.sessionKeys, crossLink: srvB.url + '/app-session' });
  try {
    // 前提锁（codex R2-F2）：A 复用 B 键值成功 → origin 门是唯一分界，否则 none 可能因键值不符假绿。
    if (JSON.stringify(srvA.sessionKeys) !== JSON.stringify(srvB.sessionKeys)) throw new Error('A/B 三键值应深等（A 复用 B 键值失败则 S4 前提不成立）');
    const EVENTS_XORIGIN = join(tmp, 'events-xorigin.json');
    writeFileSync(EVENTS_XORIGIN, eventsDoc([
      NAV0, CLICK_ENTER(1),
      { stepId: 'atstep_2', intentId: 'intent_2', atom: 'workflow.create', action: 'click', semantic: { kind: 'role', role: 'link', name: '外链', exact: true } },
      CLICK_ENTER(3),
    ]));
    const axesOut = join(tmp, 'axes-s4.json');
    const r = collectRun(run([REPLAY, '--events', EVENTS_XORIGIN, '--sut', srvA.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut,
      '--login-bootstrap', '--video-dir', join(tmp, 'v-s4')],
      isoEnv(RUN_ENV)));
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const axes = JSON.parse(readFileSync(axesOut, 'utf8'));
    if (!actedOk(stepOf(axes, 'intent_1'))) throw new Error('A 应用页「进入」步应 unique（登录态已继承，S4 前提）');
    if (!actedOk(stepOf(axes, 'intent_2'))) throw new Error('「外链」步应 unique（SUT 自身跳转须真发生）');
    if (!existsSync(hitB)) throw new Error('B 命中标记应在（跨 origin 跳转须真落到 B，否则 none 无意义）');
    const stB = stepOf(axes, 'intent_3');
    const resB = stB && stB.action && stB.action.resolution;
    if (resB !== 'none') throw new Error(`异 origin「进入」步应 none（快照不得外溢种入），实际 ${resB}`);
    if (existsSync(join(tmp, 'marker-s4b'))) throw new Error('B 实例不应收到任何登录 POST（异 origin 无登录动作）');
  } finally {
    await srvA.close();
    await srvB.close();
  }
});

// ---------- S5 特殊键保真：sessionKeys 含自有 __proto__，舞步收割须原样带到 page2 ----------
await checkAsync('S5 __proto__ 键保真：含 __proto__ 的 session 态舞步继承 → intent_1 unique', async () => {
  const srv = await startSut({ markerFile: join(tmp, 'marker-s5'), sessionKeys: withProtoKey({ sid: 's5d_fixedkey', uid: 'u5d_fixedkey' }, 'p5r_protoval') });
  try {
    const vdir = join(tmp, 'v-s5');
    const axesOut = join(tmp, 'axes-s5.json');
    const r = collectRun(run([REPLAY, '--events', EVENTS_SESSION, '--sut', srv.url, '--expected', EXPECTED_EMPTY, '--profile', PROFILE, '--out', axesOut,
      '--login-bootstrap', '--video-dir', vdir],
      isoEnv(RUN_ENV)));
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-300)}`);
    const st = stepOf(JSON.parse(readFileSync(axesOut, 'utf8')), 'intent_1');
    // 旧 {} 收割会吞掉 __proto__ → page2 期望值不全 → 登录页 → intent_1 none（本检查红）。
    if (!actedOk(st)) throw new Error(`含 __proto__ 键时「进入」步应 unique（entries 收割须原样带 __proto__），实际 ${JSON.stringify(st && st.action)}`);
  } finally {
    await srv.close();
  }
});

// ---------- S2 凭据卫生负向（收尾全扫）：任何实例键值与假凭据不得进任何落盘产物与输出 ----------
await checkAsync('S2 收割快照仅内存：工作目录递归全扫 + replay/夹具全轮次 stdout/stderr 无键值/凭据字面量', async () => {
  if (!SECRETS.length) throw new Error('未收集到任何实例键值（前置全败）');
  const files = [];
  (function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p); else files.push(p);
    }
  })(tmp);
  const needles = [...SECRETS, FAKE_USER, FAKE_PASS];
  for (const f of files) {
    const buf = readFileSync(f); // Buffer 级扫描：webm 等二进制一并盖住
    for (const n of needles) {
      if (buf.includes(n)) throw new Error(`${f.slice(tmp.length + 1)} 含机密字面量（收割快照泄漏，护栏 #7）`);
    }
  }
  for (let i = 0; i < OUTS.length; i++) {
    for (const n of needles) {
      if (OUTS[i].includes(n)) throw new Error(`replay 第 ${Math.floor(i / 2) + 1} 轮 ${i % 2 ? 'stderr' : 'stdout'} 含机密字面量（护栏 #7）`);
    }
  }
  // 夹具输出扫描确定性（codex R3-F1）：全部 SUT 已在各自 check 的 finally 里 await close（等 'close'
  // 事件 = stdio EOF，capture 的 data 全落 outChunks），故此刻 output() 完整、非竞态。
  for (const srv of SUTS) {
    const out = srv.output ? srv.output() : '';
    for (const n of needles) {
      if (out.includes(n)) throw new Error(`夹具实例 stdout/stderr 含机密字面量（护栏 #7）`);
    }
  }
});

console.log(`video-login-carry golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
