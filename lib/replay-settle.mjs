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
//   判据 B（镜像编译侧）：document.body.innerHTML.length 连续稳定。
//   放行条件：通道剖面配置 loading 时，连续两拍长度相等、两拍均归零且两拍均证实加载占位已消失；
//     未配置时走三拍静止窗兜底。占位探测证不出（抛错/超时）按不稳定计，绝不当成「已消失」。
//   兜底（条件化）：预算耗尽时仅在途仍非零才走 networkidle 有界兜底一次（职责=网络尾巴）；判据 A 已归零的
//     DOM 扰动形态直接放行（networkidle 不识 denylist、背景轮询下必烧满超时且无增益）。

const TICK_MS = 120;       // 一拍间隔（逐字镜像编译侧 quietPoint）
const EVAL_RACE_MS = 500;  // 单拍 evaluate 有界竞速（lib/replay-forensics.mjs :8 withTimeout 先例）
const IDLE_MS = 2000;      // networkidle 有界兜底（编译侧 :725 先例，catch 吞超时）

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 入参校验：非有限非负数一律回缺省，绝不让 NaN 拖死循环（评审：入参非法回缺省）。
const finiteNonNeg = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dflt);

const isPlainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

// 通道剖面 loading 子集的唯一归一化入口。不存在时返回 null（启用无配置静止窗）；在场则严格闭合形状，
// 让错误配置在浏览器启动前 fail-closed，而不是运行时悄悄失效。
export function normalizeLoadingProfile(profile) {
  if (!isPlainObject(profile)) throw new Error('profile 须为对象');
  if (profile.loading == null) return null;
  const loading = profile.loading;
  if (!isPlainObject(loading)) throw new Error('profile.loading 须为对象');
  const unknown = Object.keys(loading).filter((key) => !['selectors', 'text'].includes(key));
  if (unknown.length) throw new Error('profile.loading 含未知字段');

  let selectors = [];
  if (loading.selectors != null) {
    if (!Array.isArray(loading.selectors) || loading.selectors.length > 32) {
      throw new Error('profile.loading.selectors 须为至多 32 项的数组');
    }
    selectors = loading.selectors.map((selector) => {
      if (typeof selector !== 'string' || !selector.trim() || selector.length > 256) {
        throw new Error('profile.loading.selectors 每项须为非空短字符串');
      }
      return selector.trim();
    });
  }
  let text = null;
  if (loading.text != null) {
    if (typeof loading.text !== 'string' || !loading.text.trim() || loading.text.length > 256) {
      throw new Error('profile.loading.text 须为非空短字符串');
    }
    text = loading.text.trim();
  }
  if (selectors.length === 0 && text == null) throw new Error('profile.loading 至少须配置 selectors 或 text');
  return Object.freeze({ selectors: Object.freeze([...selectors]), text });
}

// 单拍 DOM + 占位同刻快照，套 EVAL_RACE_MS 有界竞速。evaluate 抛错（导航中上下文销毁）/永不返回 → null
// （该拍按不稳定计，预算循环照常复查，绝不悬死等全局看门狗）。
async function tickSnapshot(page, loadingGate) {
  const input = {
    loadingSelectors: loadingGate ? loadingGate.selectors : [],
    loadingText: loadingGate ? loadingGate.text : null,
  };
  try {
    const raw = await Promise.race([
      Promise.resolve(page.evaluate(({ loadingSelectors, loadingText }) => {
        const body = document.body;
        const len = body ? body.innerHTML.length : 0;
        let placeholderPresent = false;
        for (const selector of loadingSelectors) {
          if (document.querySelector(selector)) { placeholderPresent = true; break; }
        }
        if (!placeholderPresent && loadingText && body && body.innerText.includes(loadingText)) placeholderPresent = true;
        return { len, placeholderGone: !placeholderPresent };
      }, input)).catch(() => null),
      sleep(EVAL_RACE_MS).then(() => null),
    ]);
    // 兼容既有无配置 zero-SUT 桩只返回长度；配置了占位门时裸数字证不出占位状态，必须按 unknown 计。
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return loadingGate ? null : { len: raw, placeholderGone: true };
    }
    if (!isPlainObject(raw) || typeof raw.len !== 'number' || !Number.isFinite(raw.len)
      || typeof raw.placeholderGone !== 'boolean') return null;
    return raw;
  } catch { return null; }
}

export async function settleBeforeCapture(page, opts = {}) {
  const floorMs = finiteNonNeg(opts && opts.floorMs, 250);
  const budgetMs = finiteNonNeg(opts && opts.budgetMs, 2500);
  const inFlight = opts && typeof opts.inFlight === 'function' ? opts.inFlight : () => 0;
  const log = opts && typeof opts.log === 'function' ? opts.log : () => {};
  let loadingGate = null;
  let loadingInvalid = false;
  try { loadingGate = normalizeLoadingProfile((opts && opts.profile) || {}); }
  catch {
    // CLI 会在启动浏览器前拒绝；库调用仍守「绝不外抛」，并让每拍 unknown、最终 settled:false。
    loadingInvalid = true;
    log('settle loading profile invalid → keep unsettled');
  }
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

  // 条件循环独享全额预算（评审 A1）：deadline 建在下限睡完之后（另起循环起点 loopStart），绝不用总起点 t0——
  // 否则下限会吃掉条件观察窗（floorMs=250/budgetMs=2500 时条件窗仅约 2250ms），违反「条件预算 ≥ 编译期同等
  // 2500ms」铁不变量，页面在下限后 2250-2500ms 才挂载即产生原真机事故同类计时假阴。对外 waitedMs 仍以 t0 计。
  const loopStart = Date.now();
  let prevLen = null;
  let prevZero = false;
  let prevPlaceholderGone = false;
  let stableSamples = 0;
  while (Date.now() - loopStart < budgetMs) {
    const snapshot = loadingInvalid ? null : await tickSnapshot(page, loadingGate);
    const len = snapshot && snapshot.len;
    const placeholderGone = !!(snapshot && snapshot.placeholderGone);
    const zero = inFlightZero();
    const continues = len != null && prevLen != null && len === prevLen && zero && prevZero;
    stableSamples = continues ? stableSamples + 1 : (len != null && zero ? 1 : 0);
    // 配置错误或 selector 从未命中时也不得比无配置三拍窗更早放；占位门只能加严，不能削弱静止窗。
    const loadingReady = loadingGate && stableSamples >= 3 && placeholderGone && prevPlaceholderGone;
    const stillWindowReady = !loadingGate && stableSamples >= 3;
    if (loadingReady || stillWindowReady) {
      const waitedMs = Date.now() - t0;
      log(`settle ${loadingGate ? 'loading-gate' : 'still-window'} → settled waited=${waitedMs}`);
      return { settled: true, waitedMs };
    }
    prevLen = len;
    prevZero = zero;
    prevPlaceholderGone = placeholderGone;
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
