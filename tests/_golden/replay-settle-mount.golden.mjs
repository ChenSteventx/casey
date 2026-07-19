#!/usr/bin/env node
// 冻结黄金标准（replay-settle-mount · hermetic）：回放代表步采集断言前补有界静默点。
// 决策依 docs/plans/replay-settle-mount/plan.md（改动 1-8）+ proposed/GRILL.md（D1 方向 / D2 固定下限 /
//   D3 复合判据 A 在途归零 + B 两拍稳定 / 兜底条件化 / 设计评审修订 codex-sol@max 8 findings）。
// 根因：真机 tc_wf_publish_states 的 intent_1 判 NEEDS_HUMAN(SUT_DEFECT_OR_STALE)/actual=0，因回放代表步
//   （isLast）在 SPA 路由挂载/「页面加载中」占位消失前就采 buttonState → 数 0 假阴。修法=采集前镜像编译侧
//   quietPoint 补有界静默点（floor 垫 + 判据 A 在途归零 + 判据 B DOM 两拍稳定，networkidle 仅超预算后条件兜底）。
//
// 红先行（accept 期逐案存证）：U1-U7 对 lib/replay-settle.mjs 动态 import 逐案捕获（缺模块=各自红签名，
//   绝不因静态 import 整体崩塌遮蔽 I/W）；I1/I2/W1 不 import 该模块、直接驱 bin/replay.mjs / casey run 子进程
//   取旧行为红签名（I1 actual=0 真机同签名 / I2 垫零红 / W1 NEEDS_HUMAN 端到端）。I3/I4/I5/I6 冻结时即绿
//   （回归保护，wf-publish-states I0 先例）。铁不变量：bin/verdict.mjs 与 lib/replay-assert.mjs 字节不动。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SETTLE_MOD = join(ROOT, 'lib', 'replay-settle.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-settle-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
}

// ─────────────────────────────────────────────────────────────────────────────
// U 单元向：settleBeforeCapture 纯函数（桩 page + 桩 inFlight，不开浏览器）。
//   动态 import 逐案捕获——缺模块=各自红签名（LOW 采信：绝不静态 import 整体崩塌遮蔽 I/W）。
// ─────────────────────────────────────────────────────────────────────────────
async function loadSettle() {
  const m = await import(pathToFileURL(SETTLE_MOD).href + '?t=' + Date.now());
  if (typeof m.settleBeforeCapture !== 'function') throw new Error('lib/replay-settle.mjs 未导出 settleBeforeCapture');
  return m.settleBeforeCapture;
}
// 桩 page：lenSeq 决定每拍 document.body.innerHTML.length（函数或数组或 'never'/'throw'）。
function stubPage(lenSpec) {
  let i = 0;
  const calls = { evaluate: 0, waitForLoadState: [] };
  return {
    _calls: calls,
    async evaluate() {
      calls.evaluate++;
      const k = i++;
      if (lenSpec === 'never') return new Promise(() => {});           // 永不 resolve（U5）
      if (lenSpec === 'throw') throw new Error('导航中执行上下文销毁');   // evaluate 抛错（U4）
      if (typeof lenSpec === 'function') return lenSpec(k);
      return Array.isArray(lenSpec) ? lenSpec[Math.min(k, lenSpec.length - 1)] : lenSpec;
    },
    async waitForLoadState(state, opts) { calls.waitForLoadState.push({ state, opts }); },
  };
}
// 桩 inFlight：常量 / 数组序列（脚本化）/ 抛错。
function stubInFlight(spec) {
  let j = 0;
  return () => {
    if (spec === 'throw') throw new Error('inFlight boom');
    if (Array.isArray(spec)) return spec[Math.min(j++, spec.length - 1)];
    return spec;
  };
}

await checkAsync('U1 稳定页快速放行：settled true、waitedMs<800（floor 250 + 两拍约 240 + 余量）', async () => {
  const settle = await loadSettle();
  const page = stubPage(4000); // 长度恒定
  const r = await settle(page, { inFlight: stubInFlight(0) });
  if (r.settled !== true) throw new Error(`稳定页应 settled:true，实际 ${r.settled}`);
  if (!(r.waitedMs < 800)) throw new Error(`稳定页应 waitedMs<800（早退），实际 ${r.waitedMs}`);
});

await checkAsync('U2a 永不稳定 + 在途恒 0：settled false、不抛、waitedMs≥下限+全额预算（条件窗不被下限吃掉）、networkidle 桩不被调（兜底条件化跳过）', async () => {
  const settle = await loadSettle();
  const page = stubPage((k) => 1000 + k * 7); // 每拍递增，永不稳定
  // 下限(400)刻意大于一拍(120)：buggy 下 t0 早记会让条件窗被下限吃掉，总等待落在 budget+一拍≈640ms；
  // 修后条件窗独享全额预算，总等待≈floor+budget≈1040ms——两态用「≥下限+全额预算(1000)」清晰可分。
  const r = await settle(page, { inFlight: stubInFlight(0), floorMs: 400, budgetMs: 600 });
  if (r.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${r.settled}`);
  // 窗口缩水锁（评审 A1）：条件观察窗须独享全额预算——总等待 ≥ 下限 + 全额预算，绝不因 t0 早记而缩水。
  if (!(r.waitedMs >= 400 + 600)) throw new Error(`应 waitedMs≥下限+全额预算(1000)，实际 ${r.waitedMs}（条件窗被下限吃掉=红）`);
  if (!(r.waitedMs < 600 + 400 + 800)) throw new Error(`总耗时应有界(<预算+下限+余量)，实际 ${r.waitedMs}`);
  if (page._calls.waitForLoadState.length !== 0) throw new Error('在途已归零应跳过 networkidle 兜底（条件化），实际被调用');
});

await checkAsync('U8 小预算下条件轮询仍发生（评审 A1）：floor 缺省 250 + budgetMs 100（I5 同参）→ evaluate 调用≥1、settled false（条件循环独享预算、绝非下限吃完直接兜底）', async () => {
  const settle = await loadSettle();
  const page = stubPage((k) => 1000 + k * 7); // 永不稳定
  const r = await settle(page, { inFlight: stubInFlight(0), budgetMs: 100 }); // floorMs 缺省 250
  if (r.settled !== false) throw new Error(`小预算永不稳定应 settled:false，实际 ${r.settled}`);
  if (!(page._calls.evaluate >= 1)) throw new Error(`条件循环须至少跑一拍（evaluate≥1），实际 ${page._calls.evaluate}（下限吃完预算=条件轮询零次=红）`);
});

await checkAsync('U2b 永不稳定 + 在途恒 1：networkidle 桩被调且带有限 timeout（绝不无限等）、总耗时有界', async () => {
  const settle = await loadSettle();
  const page = stubPage((k) => 1000 + k * 7);
  const r = await settle(page, { inFlight: stubInFlight(1), floorMs: 100, budgetMs: 600 });
  if (r.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${r.settled}`);
  const wl = page._calls.waitForLoadState;
  if (wl.length !== 1) throw new Error(`在途非零应走 networkidle 兜底一次，实际 ${wl.length}`);
  if (wl[0].state !== 'networkidle') throw new Error(`兜底应 networkidle，实际 ${wl[0].state}`);
  if (!(wl[0].opts && Number.isFinite(wl[0].opts.timeout) && wl[0].opts.timeout > 0)) {
    throw new Error(`networkidle 必带有限 timeout（绝不无限等），实际 ${JSON.stringify(wl[0].opts)}`);
  }
});

await checkAsync('U3 固定下限可调：floorMs 300 → waitedMs≥300；floorMs 0 → waitedMs<300（垫是垫、条件是条件）', async () => {
  const settle = await loadSettle();
  const a = await settle(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 300 });
  if (!(a.settled === true && a.waitedMs >= 300)) throw new Error(`floor 300 稳定页应 settled:true/waitedMs≥300，实际 ${JSON.stringify(a)}`);
  const b = await settle(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 0 });
  if (!(b.settled === true && b.waitedMs < 300)) throw new Error(`floor 0 稳定页应 settled:true/waitedMs<300，实际 ${JSON.stringify(b)}`);
});

await checkAsync('U4 evaluate 抛错（导航中上下文销毁）：不外抛、照放行（settled false）', async () => {
  const settle = await loadSettle();
  const r = await settle(stubPage('throw'), { inFlight: stubInFlight(0), floorMs: 50, budgetMs: 500 });
  if (r.settled !== false) throw new Error(`evaluate 抛错应 settled:false（该拍不稳定），实际 ${r.settled}`);
  if (typeof r.waitedMs !== 'number') throw new Error('抛错仍须返回 waitedMs（绝不外抛）');
});

await checkAsync('U5 evaluate 永不返回：每拍 500ms 竞速兜住、预算循环照常复查、settled false、总耗时硬上界', async () => {
  const settle = await loadSettle();
  const t0 = Date.now();
  const r = await settle(stubPage('never'), { inFlight: stubInFlight(0), floorMs: 100, budgetMs: 600 });
  const elapsed = Date.now() - t0;
  if (r.settled !== false) throw new Error(`永不返回应 settled:false，实际 ${r.settled}`);
  if (!(elapsed < 600 + 500 + 700)) throw new Error(`总耗时须有界(<预算+单拍竞速+余量)，实际 ${elapsed}（绝不悬死等看门狗）`);
});

await checkAsync('U6 inFlight() 抛错：不外抛、判据 A 降级、纯判据 B 照常 settled true', async () => {
  const settle = await loadSettle();
  const r = await settle(stubPage(4000), { inFlight: stubInFlight('throw') });
  if (r.settled !== true) throw new Error(`inFlight 抛错应降级纯判据 B、稳定页仍 settled:true，实际 ${r.settled}`);
});

await checkAsync('U7 稳定对不跨零点：在途 1,1,0,0 + DOM 恒定 → 放行必在第二个归零拍之后（占位陈稳定不计入稳定对）', async () => {
  const settle = await loadSettle();
  const page = stubPage(4000); // 长度全程恒定
  const r = await settle(page, { inFlight: stubInFlight([1, 1, 0, 0, 0, 0]), floorMs: 50 });
  if (r.settled !== true) throw new Error(`应最终 settled:true，实际 ${r.settled}`);
  // evaluate 每拍一次；放行须在第 4 拍（第二个归零拍）——若忽略归零门会在第 2 拍就误判稳定。
  if (page._calls.evaluate < 4) throw new Error(`放行须在第二个归零拍之后（≥4 拍），实际仅 ${page._calls.evaluate} 拍（稳定对跨了零点=倒退）`);
});

// ─────────────────────────────────────────────────────────────────────────────
// I 集成向：驱 bin/replay.mjs 子进程（不 import settle 模块）。建流事件复刻真机建流拓扑。
// ─────────────────────────────────────────────────────────────────────────────
const CASE_ID = 'tc_settle_replay';
// events 文档为 committed 夹具字节（准入门迁移：锁 eventsSha256 绑该字节；内容语义与迁移前内联版一致）。
// 配套测试签名锁经 loop/prd-tc_settle_replay.json 注册（docs/plans/replay-admission-hermetic-migration/plan.md）。
const EVENTS = join(HERE, 'fixtures/admission-locks/tc_settle_replay/events.document.json');
const LOCKS = join(HERE, 'fixtures/admission-locks/tc_settle_replay/entity-locks.frozen.json');
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({
  background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200,
  routes: { workflowList: '/ai-manager/process/list' },
}));
function expDoc(intent1) {
  return signExpected({
    caseId: CASE_ID, channel: 'web',
    intents: [
      // 3fc0032 起 casey run 退出码绑「裁定全 PASS」；空硬断言步裁判恒 INDETERMINATE（fail-safe §2.1 设计，不发空 PASS）。
      // nav intent 补真可证硬断言使其合法 PASS——不是放宽，是把该 intent 的期望落到可证面。
      { intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list', soft: false }] },
      { intentId: 'intent_1', expected: intent1 },
    ],
    globalAssertions: [],
  });
}
const a = (o) => ({ soft: false, ...o });
// 主案 expected：buttonState present 保存 + textHidden 页面加载中 + textVisible 新增成功 + urlPathname detail。
const EXP_MAIN = join(tmp, 'exp-main.json');
writeFileSync(EXP_MAIN, JSON.stringify(expDoc([
  a({ kind: 'buttonState', op: 'present', value: '保存' }),
  a({ kind: 'textHidden', op: 'absent', value: '页面加载中' }),
  a({ kind: 'textVisible', op: 'appears', value: '新增成功' }),
  a({ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }),
])));
const findPost = (axes, iid) => (axes.steps.find((s) => s.intentId === iid) || {}).postAssertions || [];
const pick = (post, kind, value) => post.find((x) => x.kind === kind && (value == null || x.value === value));
const parseSettle = (stderr, iid) => {
  const m = String(stderr).match(new RegExp('settle intent=' + iid + ' waited=(\\d+) settled=(\\w+)'));
  return m ? { waited: Number(m[1]), settled: m[2] === 'true' } : null;
};

await checkAsync('I1 延迟挂载主案（红先行核心）：mountdelay 采集延后至挂载后 → buttonState present 保存 ok:true/actual≥1、textHidden 页面加载中 ok:true、textVisible 新增成功 ok:true', async () => {
  const srv = await startFakeSut({ scenario: 'mountdelay' }); // 缺省 mountDelayMs 800
  try {
    const OUT = join(tmp, 'i1-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const post = findPost(axes, 'intent_1');
    const bs = pick(post, 'buttonState', '保存');
    if (!bs || bs.ok !== true || !(Number(bs.actual) >= 1)) throw new Error(`buttonState present 保存 应 ok:true/actual≥1（挂载后采到），实际 ${bs && bs.ok}/${bs && bs.actual}（真机事故同签名 actual=0=红）`);
    const th = pick(post, 'textHidden', '页面加载中');
    if (!th || th.ok !== true) throw new Error(`textHidden 页面加载中 应 ok:true（占位已消失），实际 ${th && th.ok}/${th && th.actual}`);
    const tv = pick(post, 'textVisible', '新增成功');
    if (!tv || tv.ok !== true) throw new Error(`textVisible 新增成功 应 ok:true（延采约 1s 仍在 3000ms 典型消隐窗内），实际 ${tv && tv.ok}/${tv && tv.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I2 垫调 0 条件兜住：mountdelay + REPLAY_SETTLE_FLOOR_MS=0 → 修后仍全绿（延迟挂载靠条件而非靠垫、不得加大固定值凑绿）', async () => {
  const srv = await startFakeSut({ scenario: 'mountdelay' });
  try {
    const OUT = join(tmp, 'i2-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT],
      { env: { ...process.env, REPLAY_SETTLE_FLOOR_MS: '0' } });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const post = findPost(axes, 'intent_1');
    const bs = pick(post, 'buttonState', '保存');
    if (!bs || bs.ok !== true || !(Number(bs.actual) >= 1)) throw new Error(`floor=0 时 buttonState present 保存 仍应 ok:true/actual≥1（静态占位期在途 fetch 撑住判据 A），实际 ${bs && bs.ok}/${bs && bs.actual}`);
    const th = pick(post, 'textHidden', '页面加载中');
    if (!th || th.ok !== true) throw new Error(`floor=0 时 textHidden 页面加载中 仍应 ok:true，实际 ${th && th.ok}`);
  } finally { await srv.close(); }
});

await checkAsync('I3 即时渲染回归锁（冻结时即绿）：happy 同事件全绿 + settle 行 waited<1500 且 settled:true + 代表步 quietPointReached:true（固定下限不显著拖慢、不烧满预算）', async () => {
  const srv = await startFakeSut({ scenario: 'happy' });
  try {
    const OUT = join(tmp, 'i3-axes.json');
    const RH = join(tmp, 'i3-rh.jsonl');
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT, '--run-history', RH],
      { env: { ...process.env, REPLAY_DEBUG: '1' } });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '保存');
    if (!bs || bs.ok !== true) throw new Error(`happy 即时渲染 buttonState present 保存 应 ok:true，实际 ${bs && bs.ok}`);
    const st = parseSettle(r.stderr, 'intent_1');
    if (!st) throw new Error('REPLAY_DEBUG 应落 settle 日志行（settle intent=intent_1 waited=.. settled=..）');
    if (st.settled !== true) throw new Error(`即时渲染 settle 应 settled:true，实际 ${st.settled}`);
    if (!(st.waited < 1500)) throw new Error(`即时渲染 settle waited 应<1500（不烧满预算），实际 ${st.waited}`);
    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    const repr = lines.find((l) => l.stepId === 'atstep_3');
    if (!repr || repr.quietPointReached !== true) throw new Error(`代表步 quietPointReached 应 true，实际 ${repr && repr.quietPointReached}`);
  } finally { await srv.close(); }
});

await checkAsync('I4 观察者不是许愿机（冻结时即绿）：mountdelay + buttonState present 幽灵导出（从不出现）→ 修后 ok:false/actual:0 且 settle settled:true（DOM 稳定即放行，绝不承担「等到断言为真」）', async () => {
  const srv = await startFakeSut({ scenario: 'mountdelay' });
  try {
    const OUT = join(tmp, 'i4-axes.json');
    const EXP = join(tmp, 'exp-ghost.json');
    writeFileSync(EXP, JSON.stringify(expDoc([a({ kind: 'buttonState', op: 'present', value: '幽灵导出' })])));
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT],
      { env: { ...process.env, REPLAY_DEBUG: '1' } });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '幽灵导出');
    if (!bs || bs.ok !== false || bs.actual !== 0) throw new Error(`幽灵按钮应 ok:false/actual:0（期望驱动轮询=倒着裁，判据绝不读 expected），实际 ${bs && bs.ok}/${bs && bs.actual}`);
    const st = parseSettle(r.stderr, 'intent_1');
    if (!st || st.settled !== true) throw new Error(`settle 应 settled:true（DOM 稳定即放行、不为幽灵按钮空等），实际 ${st && st.settled}`);
  } finally { await srv.close(); }
});

await checkAsync('I5 超预算照采 fail-safe（冻结时即绿）：mountDelayMs 6000 + REPLAY_SETTLE_BUDGET_MS=100 → replay exit 0、axes 落盘、buttonState 如实红（ok:false/actual:0）、代表步 quietPointReached:false', async () => {
  const srv = await startFakeSut({ scenario: 'mountdelay', mountDelayMs: 6000 });
  try {
    const OUT = join(tmp, 'i5-axes.json');
    const RH = join(tmp, 'i5-rh.jsonl');
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT, '--run-history', RH],
      { env: { ...process.env, REPLAY_SETTLE_BUDGET_MS: '100', REPLAY_DEBUG: '1' } });
    if (r.status !== 0) throw new Error(`超预算仍应 replay exit 0（不因静默点报错吞步），实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    if (!existsSync(OUT)) throw new Error('超预算仍应 axes 落盘');
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '保存');
    if (!bs || bs.ok !== false || bs.actual !== 0) throw new Error(`超预算按现状采（挂载 6s 未完成）应 ok:false/actual:0，实际 ${bs && bs.ok}/${bs && bs.actual}`);
    const st = parseSettle(r.stderr, 'intent_1');
    if (!st || st.settled !== false) throw new Error(`超预算 settle 应 settled:false，实际 ${st && st.settled}`);
    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    const repr = lines.find((l) => l.stepId === 'atstep_3');
    if (!repr || repr.quietPointReached !== false) throw new Error(`超时代表步 quietPointReached 应 false（schema「false=证据可复现性存疑」口径一致），实际 ${repr && repr.quietPointReached}`);
  } finally { await srv.close(); }
});

await checkAsync('I6 扰动走时上界回归锁（冻结时即绿）：churn 场景 → replay exit 0、settle settled:false、waited<4000（判据 A 归零故 networkidle 兜底跳过、绝不靠 REPLAY_WATCHDOG_MS 收尸）', async () => {
  const srv = await startFakeSut({ scenario: 'churn' });
  try {
    const OUT = join(tmp, 'i6-axes.json');
    const EXP = join(tmp, 'exp-churn.json');
    writeFileSync(EXP, JSON.stringify(expDoc([a({ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' })])));
    const r = run([REPLAY, '--events', EVENTS, '--entity-locks', LOCKS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT],
      { env: { ...process.env, REPLAY_DEBUG: '1' } });
    if (r.status !== 0) throw new Error(`churn 应 replay exit 0，实际 ${r.status}`);
    const st = parseSettle(r.stderr, 'intent_1');
    if (!st || st.settled !== false) throw new Error(`churn（DOM 永不稳定）应 settled:false，实际 ${st && st.settled}`);
    if (!(st.waited < 4000)) throw new Error(`churn settle waited 应<4000（判据 A 归零→兜底条件化跳过 2000ms 燃烧），实际 ${st.waited}`);
  } finally { await srv.close(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// W 接线向：casey run 端到端裁定翻正。
// ─────────────────────────────────────────────────────────────────────────────
await checkAsync('W1 端到端裁定翻正：casey run 对 mountdelay → intent_1 PASS + 报告三件落盘（verdict.mjs 零改动前提下纯靠采集时机修正翻正）', async () => {
  const srv = await startFakeSut({ scenario: 'mountdelay' });
  try {
    const runDir = join(tmp, 'w1-run');
    mkdirSync(runDir, { recursive: true });
    const r = run([CASEY, 'run', CASE_ID, '--sut', srv.url, '--events', EVENTS, '--entity-locks', LOCKS, '--expected', EXP_MAIN, '--profile', PROFILE,
      '--run-dir', runDir, '--generated-at', '2026-07-14T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
    const v = (verdict.steps || []).find((s) => s.intentId === 'intent_1');
    if (!v || v.verdict !== 'PASS') throw new Error(`intent_1 应 PASS（真机事故端到端翻正），实际 ${v && v.verdict}（reason=${v && v.reason}）`);
    for (const ext of ['html', 'md', 'json']) {
      if (!existsSync(join(runDir, `${CASE_ID}.report.${ext}`))) throw new Error(`缺 report.${ext}`);
    }
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  replay-settle-mount: ${f}`);
  console.error(`RED  replay-settle-mount: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   replay-settle-mount: ${pass}/${pass} 全过（静默点单元 U1-U7 + 延迟挂载 I1/I2 + 回归锁 I3/I4/I5/I6 + 端到端 W1）`);
process.exit(0);
