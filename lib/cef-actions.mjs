// CEF 四动作身份门。所有动作先过闭合 event 闸；none/ambiguous 零落笔；禁录制坐标兜底。
import { CEF_ACTIONS, validateCefEvent } from './cef-spec.mjs';

export const CEF_ACTION_SPACE = CEF_ACTIONS;
const fail = (code) => new Error(code);
const responseValue = (out) => {
  // Runtime.evaluate 的 JavaScript 异常活在 exceptionDetails，不一定令 CDP 命令 reject。
  // 把它当普通 undefined 会被下游洗成 count=0；固定错误码拒绝且绝不回显页面异常体。
  if (!out || out.exceptionDetails || !out.result || !Object.prototype.hasOwnProperty.call(out.result, 'value')) throw fail('CEF_EVALUATE_FAILED');
  return out.result.value;
};
const result = (resolution, candidateCount, ok = false) => ({
  resolution,
  candidateCount,
  actionPerformed: resolution === 'unique' && ok,
  identityReadback: { ok },
});

function checkedEvent(event) {
  if (!event || !CEF_ACTIONS.includes(event.action)) throw fail('CEF_ACTION_UNSUPPORTED');
  const checked = validateCefEvent(event);
  if (!checked.ok) throw fail('CEF_EVENT_INVALID');
  return event;
}

async function evaluate(cdp, expression) {
  const out = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return responseValue(out);
}

function protocolFrameState(frameTree) {
  if (!frameTree || typeof frameTree !== 'object') return null;
  const children = Array.isArray(frameTree.childFrames) ? frameTree.childFrames : [];
  if (children.length > 0) return true;
  return false;
}

async function actionBinding(cdp, path) {
  const expected = JSON.stringify(path);
  let found;
  try {
    const tree = await cdp.send('Page.getFrameTree');
    const hasFrames = protocolFrameState(tree?.frameTree);
    if (hasFrames === null) return result('action_failed', null);
    if (hasFrames) return result('iframe_unsupported', null);
    found = await evaluate(cdp, `(() => { try { return { iframeUnsupported: window.top !== window || !!document.querySelector('iframe,frame'), pathMatch: location.pathname + location.search === ${expected} }; } catch { return null; } })()`);
  } catch {
    return result('action_failed', null);
  }
  if (found?.iframeUnsupported === true) return result('iframe_unsupported', null);
  if (found?.pathMatch !== true) return result(found?.pathMatch === false ? 'path_mismatch' : 'action_failed', null);
  return null;
}

function queryExpression(selector, path, { focus = false } = {}) {
  const q = JSON.stringify(selector);
  const p = JSON.stringify(path);
  return `(() => { try { if (window.top !== window || document.querySelector('iframe,frame')) return { iframeUnsupported:true, count:null, rect:null, focused:false }; if (location.pathname + location.search !== ${p}) return { pathMatch:false, count:null, rect:null, focused:false }; const nodes = [...document.querySelectorAll(${q})]; if (nodes.length !== 1) return { pathMatch:true, count: nodes.length, rect: null, focused: false }; const el = nodes[0]; ${focus ? 'el.focus({preventScroll:true});' : ''} const r = el.getBoundingClientRect(); const style = getComputedStyle(el); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy); const actionable = el.isConnected && r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.pointerEvents !== 'none' && cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight && !!hit && (hit === el || el.contains(hit)); return { pathMatch:true, count: 1, rect: actionable ? { left:r.left, top:r.top, width:r.width, height:r.height } : null, focused: ${focus ? 'document.activeElement === el' : 'true'} }; } catch { return { count: null, rect: null, focused: false }; } })()`;
}

async function click(cdp, event, twice) {
  let found;
  try { found = await evaluate(cdp, queryExpression(event.selector, event.path)); }
  catch { return result('action_failed', 0); }
  if (found?.iframeUnsupported === true) return result('iframe_unsupported', null);
  if (found?.pathMatch === false) return result('path_mismatch', null);
  if (!found || !Number.isInteger(found.count)) return result('action_failed', 0);
  const count = Number.isInteger(found && found.count) ? found.count : 0;
  if (count === 0) return result('none', 0);
  if (count !== 1) return result('ambiguous', count);
  const r = found.rect;
  if (!r || ![r.left, r.top, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) return result('action_failed', 1);
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const beforePointer = await actionBinding(cdp, event.path);
  if (beforePointer) return beforePointer;
  let pressed = false;
  try {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    const rounds = twice ? 2 : 1;
    for (let i = 1; i <= rounds; i++) {
      const beforePress = await actionBinding(cdp, event.path);
      if (beforePress) return beforePress;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: i });
      pressed = true;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: i });
      pressed = false;
    }
  } catch {
    if (pressed) {
      try { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); } catch { /* 固定失败结果 */ }
    }
    return result('action_failed', 1);
  }
  return result('unique', 1, true);
}

async function fill(cdp, event) {
  const beforeFill = await actionBinding(cdp, event.path);
  if (beforeFill) return beforeFill;
  const q = JSON.stringify(event.selector);
  const value = JSON.stringify(event.value);
  const path = JSON.stringify(event.path);
  const expression = `(() => { try { if (window.top !== window || document.querySelector('iframe,frame')) return { iframeUnsupported:true, count:null, wrote:false }; if (location.pathname + location.search !== ${path}) return { pathMatch:false, count:null, wrote:false }; const nodes = [...document.querySelectorAll(${q})]; if (nodes.length !== 1) return { pathMatch:true, count:nodes.length, wrote:false }; const el=nodes[0]; const r=el.getBoundingClientRect(); const style=getComputedStyle(el); const eligible=(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.isConnected && !el.disabled && !el.readOnly && r.width>0 && r.height>0 && style.visibility!=='hidden' && style.visibility!=='collapse'; if (!eligible) return { pathMatch:true, count:1, wrote:false, readback:String(el.value ?? '') }; const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set; if (typeof setter !== 'function') return { pathMatch:true, count:1, wrote:false, readback:String(el.value ?? '') }; setter.call(el, ${value}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); const after=[...document.querySelectorAll(${q})]; const same=el.isConnected && after.length===1 && after[0]===el && location.pathname + location.search === ${path}; return { pathMatch:true, count:1, wrote:same, readback:same ? String(el.value ?? '') : null }; } catch { return { count:null, wrote:false }; } })()`;
  let found;
  try { found = await evaluate(cdp, expression); }
  catch { return result('action_failed', 0); }
  if (found?.iframeUnsupported === true) return result('iframe_unsupported', null);
  if (found?.pathMatch === false) return result('path_mismatch', null);
  if (!found || !Number.isInteger(found.count)) return result('action_failed', 0);
  const count = Number.isInteger(found && found.count) ? found.count : 0;
  if (count === 0) return result('none', 0);
  if (count !== 1) return result('ambiguous', count);
  if (!found.wrote || found.readback !== event.value) return result('action_failed', 1);
  return result('unique', 1, true);
}

async function press(cdp, event) {
  let found;
  try { found = await evaluate(cdp, queryExpression(event.selector, event.path, { focus: true })); }
  catch { return result('action_failed', 0); }
  if (found?.iframeUnsupported === true) return result('iframe_unsupported', null);
  if (found?.pathMatch === false) return result('path_mismatch', null);
  if (!found || !Number.isInteger(found.count)) return result('action_failed', 0);
  const count = Number.isInteger(found && found.count) ? found.count : 0;
  if (count === 0) return result('none', 0);
  if (count !== 1) return result('ambiguous', count);
  if (!found.focused) return result('action_failed', 1);
  const beforeKey = await actionBinding(cdp, event.path);
  if (beforeKey) return beforeKey;
  let down = false;
  try {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: event.key });
    down = true;
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: event.key });
    down = false;
  } catch {
    if (down) {
      try { await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: event.key }); } catch { /* 固定失败结果 */ }
    }
    return result('action_failed', 1);
  }
  return result('unique', 1, true);
}

export async function performCefAction(cdp, rawEvent) {
  if (!cdp || typeof cdp.send !== 'function') throw fail('CEF_CDP_INVALID');
  const event = checkedEvent(rawEvent);
  if (event.action === 'click') return click(cdp, event, false);
  if (event.action === 'dblclick') return click(cdp, event, true);
  if (event.action === 'fill') return fill(cdp, event);
  if (event.action === 'press') return press(cdp, event);
  throw fail('CEF_ACTION_UNSUPPORTED');
}
