// settleBeforeCapture —— 回放代表步采集断言前的有界静默点（跨阶段静默点的回放变体，CONTEXT.md）。
// 镜像编译侧 quietPoint（lib/compile-atoms.mjs :202-214）：让 SPA（单页应用）路由挂载 /「页面加载中」
// 占位消失后再采断言输入，堵回放侧计时假阴（真机 tc_wf_publish_states intent_1 判 NEEDS_HUMAN/actual=0）。
//
// 铁不变量（plan D1）：纯观察者、有界、fail-safe——
//   · 绝不外抛（helper 自身故障由 bin 侧照现状采）；绝不无限等（每拍 evaluate 套竞速、总走时有预算上界）；
//   · 超预算按现状采（settled:false 放行，不吞步）；条件预算 ≥ 编译期同等（缺省 2500ms，对齐 quietPoint）；
//   · 判据绝不读 expected——静默点不知道要断什么按钮，只看「页面自己说还没稳」（在途请求 / DOM 还在变）。
//
// 复合判据（plan D3）：
//   判据 A（在途前台 API 归零，纯观察）：复用 watchNetworkForensics 的 inFlightApi（只收 XHR/Fetch、denylist
//     背景轮询天然除外）——真机编辑器挂载由详情数据请求驱动，请求在途 = 还没到静默点。
//   判据 B（镜像编译侧）：document.body.innerHTML.length 连续两拍稳定。
//   放行条件：连续两拍长度相等【且】两拍均在判据 A 归零区间内（稳定对不跨零点，给「应答后提交」约两拍缓冲）。
//   兜底（条件化）：预算耗尽时仅在途仍非零才走 networkidle 有界兜底一次（职责=网络尾巴）；判据 A 已归零的
//     DOM 扰动形态直接放行（networkidle 不识 denylist、背景轮询下必烧满超时且无增益）。

const TICK_MS = 120;       // 一拍间隔（逐字镜像编译侧 quietPoint）
const EVAL_RACE_MS = 500;  // 单拍 evaluate 有界竞速（lib/replay-forensics.mjs :8 withTimeout 先例）
const IDLE_MS = 2000;      // networkidle 有界兜底（编译侧 :725 先例，catch 吞超时）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 入参校验：非有限非负数一律回缺省，绝不让 NaN 拖死循环（评审：入参非法回缺省）。
const finiteNonNeg = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dflt);

// 单拍 DOM 长度采集，套 EVAL_RACE_MS 有界竞速。evaluate 抛错（导航中上下文销毁）/永不返回 → null
// （该拍按不稳定计，预算循环照常复查，绝不悬死等全局看门狗）。
async function tickLen(page) {
  try {
    return await Promise.race([
      Promise.resolve(page.evaluate(() => (document.body ? document.body.innerHTML.length : 0))).catch(() => null),
      sleep(EVAL_RACE_MS).then(() => null),
    ]);
  } catch { return null; }
}

export async function settleBeforeCapture(page, opts = {}) {
  const floorMs = finiteNonNeg(opts && opts.floorMs, 250);
  const budgetMs = finiteNonNeg(opts && opts.budgetMs, 2500);
  const inFlight = opts && typeof opts.inFlight === 'function' ? opts.inFlight : () => 0;
  const log = opts && typeof opts.log === 'function' ? opts.log : () => {};
  const t0 = Date.now();

  // 判据 A 读值：inFlight() 抛错则本次静默点内降级为不可用、退化纯判据 B（编译侧同构，评审：inFlight try/catch）。
  let aUsable = true;
  const inFlightZero = () => {
    if (!aUsable) return true; // 降级：判据 A 恒视作已归零，纯靠判据 B
    try {
      const n = inFlight();
      return typeof n === 'number' && Number.isFinite(n) ? n <= 0 : true;
    } catch {
      aUsable = false;
      log('settle inFlight() threw → degrade to DOM-only');
      return true;
    }
  };
  const inFlightNonZero = () => {
    if (!aUsable) return false;
    try {
      const n = inFlight();
      return typeof n === 'number' && Number.isFinite(n) && n > 0;
    } catch { aUsable = false; return false; }
  };

  // 固定下限（plan D2/M1）：给 SPA 路由切换首帧一点起步窗，避免动作刚落一拍就抢采旧 DOM 的假稳定。
  // 定位=条件式静默点的起步垫，绝不承担「等到按钮出现」（那是条件的活）。
  if (floorMs > 0) await sleep(floorMs);

  let prevLen = null;
  let prevZero = false;
  while (Date.now() - t0 < budgetMs) {
    const len = await tickLen(page);
    const zero = inFlightZero();
    // 稳定对：连续两拍长度相等【且】两拍均在归零区间内（不跨零点——占位期在途未归零的稳定拍不计入）。
    if (len != null && prevLen != null && len === prevLen && zero && prevZero) {
      const waitedMs = Date.now() - t0;
      log('settle dom-stable → settled waited=' + waitedMs);
      return { settled: true, waitedMs };
    }
    prevLen = len;
    prevZero = zero;
    await sleep(TICK_MS);
  }

  // 预算耗尽：仅在途仍非零才走 networkidle 有界兜底（职责=网络尾巴）；否则直接放行（扰动形态兜底跳过）。
  if (inFlightNonZero() && typeof page.waitForLoadState === 'function') {
    log('settle budget exhausted, inflight>0 → networkidle bottom');
    try { await page.waitForLoadState('networkidle', { timeout: IDLE_MS }); } catch { /* 超时/无该 API：吞（按现状采）*/ }
  }
  const waitedMs = Date.now() - t0;
  log('settle unsettled → capture as-is waited=' + waitedMs);
  return { settled: false, waitedMs };
}
