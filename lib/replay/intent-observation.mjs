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
async function safeRead(read, fallback) {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function readToasts(page) {
  return safeRead(() => page.evaluate(() => {
    const values = [];
    for (const element of document.querySelectorAll(
      '.hr-toast,.hr-message,[role="status"],[role="alert"]',
    )) {
      const text = (element.textContent || '').trim();
      if (text) values.push(text);
    }
    return [...new Set(values)];
  }), []);
}

async function readTextHits(page, assertions, toasts) {
  const textHits = {};
  for (const assertion of assertions) {
    if (!['textVisible', 'textHidden'].includes(assertion.kind)
      || typeof assertion.value !== 'string') continue;
    const inPage = await safeRead(() => page.getByText(assertion.value).count(), 0);
    const inToast = toasts.filter((text) => text.includes(assertion.value)).length;
    textHits[assertion.value] = inPage + (inPage === 0 ? inToast : 0);
  }
  return textHits;
}

const visibleCount = (elements, name) => elements.filter((element) =>
  (name == null || (element.textContent || '').trim() === name)
  && element.getClientRects().length > 0
  && getComputedStyle(element).visibility !== 'hidden').length;

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
  const toasts = await readToasts(page);
  const textHits = await readTextHits(page, assertions, toasts);
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
