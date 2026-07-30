// formal replay 与 raw source 复现共用的 before/terminal 观察原语。
// 只读页面事实：行数、chat 基线/回复、URL path、toast、文本命中、按钮态。
// 本模块不点击、不导航、不裁定，也不认识 intent → event 的映射；取到什么就如实返回，取不到回 null。

import { replayPathOf, replayRowCount } from './history.mjs';

const TOAST_SELECTOR = '.hr-toast,.hr-message,[role="status"],[role="alert"]';

async function readReplySnapshot(page, replySelector, timeoutMs) {
  try {
    const locator = page.locator(replySelector);
    const count = await locator.count();
    return {
      n: count,
      text: count ? await locator.last().innerText({ timeout: timeoutMs }) : null,
    };
  } catch {
    return null;
  }
}

// 代表步动作发生之前的基线：行数与 chat 回复快照。
export async function captureIntentObservationBaseline({
  page, countSelector, chat, replySelector,
}) {
  const count = await replayRowCount(page, countSelector);
  const replyBaseline = chat ? await readReplySnapshot(page, replySelector, 500) : null;
  return { count, replyBaseline };
}

// 只读观察一律遵守「取到什么如实返回，取不到回退」：页面缺能力或抛错都不向上冒泡。
// 注意回退值的方向：只有「回退不会把证不出洗成判过」的面才准给具体回退值（如 url 回 null）；
// 断言判据面一律走下面的未知读（护栏 #14）。
async function safeRead(read, fallback) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

// 判据面的未知读：采不到就是未知（undefined），绝不回退成计数——负向断言下 0 回退会让
// hits===0 判过，是 fail-open（assert-visibility-semantics GRILL D2 第 1 条，护栏 #14）。
async function readAssertionCount(read) {
  try {
    const value = await read();
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

const visibleCount = (elements, name) => elements.filter((element) =>
  (name == null || (element.textContent || '').trim() === name)
  && element.getClientRects().length > 0
  && getComputedStyle(element).visibility !== 'hidden').length;

// 提示快照：全量与可见两份**在同一次 evaluate 里同刻派生**，不是两次采样。
//
// 为什么必须同刻（codex 异构评审 2026-07-31 逮到的 Critical）：兜底的全部价值是**时间**——
// 抓短命提示在两次读取之间消失的窗口（GRILL D3）。若可见那份晚一步单独再读，短命提示可能已经
// 谢幕，第二次合法返回空数组，于是 textHidden 拿到 0 判过——正是兜底本该防的那个假绿。
// 实测复现过：toasts=["操作失败"] → textHits={"操作失败":0} → textHidden ok:true actual:0 → PASS。
//
// 过滤语义分工不变（GRILL D3）：终端 toasts 仍输出全量那份（noErrorToast 的词表判「在场即错」
// 依赖不过滤读取），textHidden 通道消费可见那份。可见谓词与 visibleCount 同源，只此一处，
// 不再有第二份复制可漂移。
// 失败路径：整次采不到则两份都是 null（未知），绝不回 []——空数组会让 noErrorToast 的
// bad.length===0 判过，是与文本命中同类的孪生 fail-open 缝（GRILL D2 第 2 条，护栏 #14）。
// 下游 lib/replay-assert.mjs 对非数组一律证不出（ok:false actual:null → NEEDS_HUMAN）。
async function readToastSnapshot(page) {
  try {
    // 选择器**必须字面写在回调体内**，不许改成传参：金牌固定语料靠正则匹配回调源码来判别
    // 「这是不是提示查询」（提示采集不可用情景据此触发），挪成参数会让判别失效、V6 那枚
    // 孪生缝钉当场失去判别力。与模块顶部 TOAST_SELECTOR 同值，改一处必须同步改另一处。
    const snapshot = await page.evaluate(() => {
      const all = [];
      const visible = [];
      for (const element of document.querySelectorAll(
        '.hr-toast,.hr-message,[role="status"],[role="alert"]',
      )) {
        const text = (element.textContent || '').trim();
        if (!text) continue;
        all.push(text);
        if (element.getClientRects().length > 0
          && getComputedStyle(element).visibility !== 'hidden') visible.push(text);
      }
      return { all: [...new Set(all)], visible: [...new Set(visible)] };
    });
    return Array.isArray(snapshot?.all) && Array.isArray(snapshot?.visible)
      ? snapshot
      : { all: null, visible: null };
  } catch {
    return { all: null, visible: null };
  }
}

// 按文本值归并两向断言请求：textHits 是「文本 → 一个数字」的平铺 map，同值只可能有一个口径。
function groupTextRequests(assertions) {
  const requests = new Map();
  for (const assertion of assertions) {
    if (!['textVisible', 'textHidden'].includes(assertion.kind)
      || typeof assertion.value !== 'string') continue;
    const request = requests.get(assertion.value) || { hidden: false, visible: false };
    if (assertion.kind === 'textHidden') request.hidden = true;
    else request.visible = true;
    requests.set(assertion.value, request);
  }
  return requests;
}

// 文本命中采集（assert-visibility-semantics）。三条口径规则，都是随用例演进随时引爆的静默切换面，
// 故逐条写死在这里：
// 1. 被 textHidden 请求的文本值数【可见命中】——作者层注册表把 assert.textHidden 定义为
//    「toBeHidden，含未挂载」，签字时的契约本来就是可见性；数 DOM 命中会把「浮层视觉关闭但节点
//    不卸载」判红（真机实测 DOM 1 / 可见 0）。textVisible 独有值保持现行 DOM 命中口径
//    （其命名与实现的背离另行挂账，GRILL D7）。
// 2. 冲突裁决（GRILL D4）：同一 intent 内同一文本值被 textVisible 与 textHidden 同时请求时，
//    textHits[value] 只有一个数字、两种口径无法共存——取可见计数（严者优先）。可见命中恒 ≤ DOM 命中，
//    严者只会让正向断言更难判过，不会把假过洗绿。
// 3. 采集失败裁决（主会话 plan §5 M4）：可见计数与 DOM 计数任一采不到，就省该键，正反两向断言
//    一律落未知（ok:false actual:null → NEEDS_HUMAN）。两向共用同一 textHits 键空间，fail-safe
//    方向唯一自洽——证不出就别判，宁可要人看，不可两向各判各的。
async function readTextHits(page, assertions, toastSnapshot) {
  const requests = groupTextRequests(assertions);
  const textHits = {};
  if (!requests.size) return textHits;
  // 两份兜底都来自同一次快照（同刻派生，不再二次采样）：正向独有值消费全量那份（现行口径），
  // 负向值消费可见那份。任一为 null 即整次采集失败，落到下面的省键分支。
  const { all: allToasts, visible: visibleToasts } = toastSnapshot;
  for (const [value, request] of requests) {
    // DOM 命中恒采：正向独有值直接用它；负向值用它兑现 M4 的「任一采不到就省键」。
    const inPage = await readAssertionCount(() => page.getByText(value).count());
    if (inPage == null) continue;
    let hits = inPage;
    if (request.hidden) {
      const inView = await readAssertionCount(
        () => page.getByText(value).evaluateAll(visibleCount, null),
      );
      if (inView == null) continue;
      hits = inView;
    }
    if (hits === 0) {
      const fallback = request.hidden ? visibleToasts : allToasts;
      if (!Array.isArray(fallback)) continue; // 兜底也采不到 → 未知，省该键（不拿 0 顶）
      hits = fallback.filter((text) => String(text).includes(value)).length;
    }
    textHits[value] = hits;
  }
  return textHits;
}

const disabledCount = (elements, options) => elements.filter((element) => {
  if (options.name != null
    && (element.textContent || '').trim() !== options.name) return false;
  if (options.vis
    && !(element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== 'hidden')) return false;
  return element.disabled === true
    || element.getAttribute('aria-disabled') === 'true'
    || (options.cls ? element.classList.contains(options.cls) : false);
}).length;

async function readButtonObservation(page, assertions, buttons) {
  const buttonValues = [...new Set(assertions
    .filter((assertion) => assertion.kind === 'buttonState'
      && typeof assertion.value === 'string')
    .map((assertion) => assertion.value))];
  if (!buttonValues.length) return null;
  let roleTotal = null;
  try {
    roleTotal = await page.getByRole('button').count();
  } catch {
    roleTotal = null;
  }
  let extraTotal = 0;
  if (buttons) {
    try {
      extraTotal = await page.locator(buttons.extraSelector).evaluateAll(visibleCount, null);
    } catch {
      extraTotal = null;
    }
  }
  const disabledClass = buttons ? buttons.disabledClass : null;
  const buttonHits = {};
  const buttonDisabledHits = {};
  for (const value of buttonValues) {
    let roleCount = null;
    let roleDisabledCount = null;
    try {
      roleCount = await page.getByRole('button', { name: value, exact: true }).count();
    } catch {
      roleCount = null;
    }
    try {
      roleDisabledCount = await page.getByRole('button', { name: value, exact: true })
        .evaluateAll(disabledCount, { name: null, vis: false, cls: disabledClass });
    } catch {
      roleDisabledCount = null;
    }
    let extraCount = 0;
    let extraDisabledCount = 0;
    if (buttons) {
      try {
        extraCount = await page.locator(buttons.extraSelector)
          .evaluateAll(visibleCount, value);
      } catch {
        extraCount = null;
      }
      try {
        extraDisabledCount = await page.locator(buttons.extraSelector)
          .evaluateAll(disabledCount, { name: value, vis: true, cls: disabledClass });
      } catch {
        extraDisabledCount = null;
      }
    }
    if (roleCount == null || extraCount == null) continue;
    buttonHits[value] = roleCount + extraCount;
    if (roleDisabledCount != null && extraDisabledCount != null) {
      buttonDisabledHits[value] = roleDisabledCount + extraDisabledCount;
    }
  }
  return {
    buttonHits,
    buttonDisabledHits,
    buttonSeen: roleTotal != null && extraTotal != null ? roleTotal + extraTotal : null,
  };
}

// 代表步取证：URL、行数、toast、文本命中、按钮态与 chat 回复。
export async function captureIntentObservationTerminal({
  page, countSelector, chat, replySelector, replyBaseline, assertions = [], buttons,
}) {
  const url = replayPathOf(await safeRead(() => page.url(), null));
  const count = await replayRowCount(page, countSelector);
  // 一次快照两份用途：终端 toasts 输出全量那份（口径不变），textHidden 兜底消费同刻的可见那份。
  const toastSnapshot = await readToastSnapshot(page);
  const toasts = toastSnapshot.all;
  const textHits = await readTextHits(page, assertions, toastSnapshot);
  const buttonObservation = await readButtonObservation(page, assertions, buttons);
  let reply;
  if (chat) {
    const snapshot = await readReplySnapshot(page, replySelector, 1000);
    reply = replyBaseline != null && snapshot != null && snapshot.text != null
      && (snapshot.n > replyBaseline.n || snapshot.text !== replyBaseline.text)
      ? snapshot.text
      : undefined;
  }
  return {
    url, count, toasts, textHits, buttonObservation, reply,
  };
}

export const INTENT_OBSERVATION_TOAST_SELECTOR = TOAST_SELECTOR;
