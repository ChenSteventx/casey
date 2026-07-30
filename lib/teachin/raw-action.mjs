// raw capture event → generic replay 动作请求的固定投影。纯函数、零 browser、零 LLM。
// 投影只有三条：selector → fallbackCss、value → fill value、key → press key。
// 录制包已登记的 text/tagName/fieldLabel/x/y/ox/oy 等采集证据允许出现在输入，但必须从 actionRequest 剥离；
// nav/newpage 是闭合 control，绝不伪装业务动作；未知动作、缺必填与未登记字段统一 fail-closed。

import { ALLOWED_EVENT_KEYS } from '../record-capture.mjs';

const CONTROL_ACTIONS = new Set(['nav', 'newpage']);
const CLICK_ACTIONS = new Set(['click', 'dblclick']);

function frozen(value) {
  return Object.freeze(value);
}

function invalid() {
  return frozen({ ok: false, reason: 'RAW_ACTION_INVALID' });
}

function action(actionRequest) {
  return frozen({
    ok: true,
    kind: 'action',
    actionRequest: frozen(actionRequest),
  });
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export function projectRawReplayAction(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return invalid();
  let keys;
  try {
    keys = Object.keys(event);
  } catch {
    return invalid();
  }
  for (const key of keys) {
    if (!ALLOWED_EVENT_KEYS.has(key)) return invalid();
  }
  const name = event.action;
  if (!nonEmptyString(name)) return invalid();
  if (CONTROL_ACTIONS.has(name)) {
    return frozen({ ok: true, kind: 'control', controlAction: name });
  }
  if (!nonEmptyString(event.selector)) return invalid();
  if (CLICK_ACTIONS.has(name)) {
    return action({ action: name, fallbackCss: event.selector });
  }
  if (name === 'fill') {
    if (typeof event.value !== 'string') return invalid();
    return action({
      action: 'fill',
      fallbackCss: event.selector,
      value: event.value,
    });
  }
  if (name === 'press') {
    if (!nonEmptyString(event.key)) return invalid();
    return action({
      action: 'press',
      fallbackCss: event.selector,
      key: event.key,
    });
  }
  return invalid();
}
