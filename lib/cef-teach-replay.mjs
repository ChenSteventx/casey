// CEF 真人示教与机械回放内核。零 LLM、零 verdict；正式裁定资格固定为 false。
import { performCefAction } from './cef-actions.mjs';
import { validateCefReplaySpec } from './cef-spec.mjs';

const fail = (code) => new Error(code);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recorderSource() {
  return `(() => {
    if (window.__caseyCefRecordInstalled) return;
    window.__caseyCefRecordInstalled = true;
    const clean = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
    const emit = (payload) => { try { window.__caseyCefRecord(JSON.stringify(payload)); } catch {} };
    const path = () => location.pathname + location.search;
    let iframeRejected = false;
    const rejectIframe = () => {
      if (iframeRejected) return true;
      if (window.top !== window || document.querySelector('iframe,frame')) {
        iframeRejected = true;
        emit({ type:'unsupported', reason:'iframe' });
        return true;
      }
      return false;
    };
    const css = (el) => {
      if (!el || el.nodeType !== 1) return '';
      if (el.id && !/\\d{4,}|[0-9a-f]{8}-/i.test(el.id)) return '#' + CSS.escape(el.id);
      const testId = el.getAttribute('data-testid');
      if (testId) return '[data-testid=' + JSON.stringify(testId) + ']';
      const aria = el.getAttribute('aria-label');
      if (aria) return el.tagName.toLowerCase() + '[aria-label=' + JSON.stringify(aria) + ']';
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) return el.tagName.toLowerCase() + '[placeholder=' + JSON.stringify(placeholder) + ']';
      const parts = [];
      let cur = el;
      for (let depth = 0; cur && cur !== document.body && depth < 5; depth++, cur = cur.parentElement) {
        let part = cur.tagName.toLowerCase();
        const parent = cur.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((x) => x.tagName === cur.tagName);
          if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
        }
        parts.unshift(part);
      }
      return parts.join(' > ');
    };
    const target = (event) => event.target?.closest?.('button,a,[role="button"],input,select,textarea,label,[class*="btn"],[class*="item"],[class*="card"]') || event.target;
    const pointer = (event, action) => {
      if (rejectIframe()) return;
      const el = target(event);
      if (!el) return;
      emit({ type:'event', event:{ action, path:path(), selector:css(el), text:clean(el.innerText || el.value || '').slice(0,80), tagName:String(el.tagName || '').toLowerCase() } });
    };
    document.addEventListener('click', (event) => pointer(event, 'click'), true);
    document.addEventListener('dblclick', (event) => pointer(event, 'dblclick'), true);
    document.addEventListener('input', (event) => {
      if (rejectIframe()) return;
      const el = event.target;
      if (!el || !('value' in el)) return;
      emit({ type:'event', event:{ action:'fill', path:path(), selector:css(el), tagName:String(el.tagName || '').toLowerCase(), fieldLabel:clean(el.labels?.[0]?.innerText || el.getAttribute?.('aria-label') || el.getAttribute?.('placeholder') || '').slice(0,80), value:String(el.value || '').slice(0,1000) } });
    }, true);
    document.addEventListener('keydown', (event) => {
      if (rejectIframe()) return;
      if (event.key === 'F8') { event.preventDefault(); event.stopPropagation(); emit({ type:'stop' }); return; }
      if (event.key === 'Enter' && !event.shiftKey) emit({ type:'event', event:{ action:'press', path:path(), selector:css(event.target), key:'Enter' } });
    }, true);
    // 路由变化是点击的页面副作用。本轮 CEF action space 没有 nav，故不额外录 nav；
    // 否则一次正常点击会多出不可回放的伪步骤。真实导航结果留给后续已签断言判断。
    if (rejectIframe()) return;
    const watchFrames = () => {
      if (!document.documentElement || rejectIframe()) return;
      new MutationObserver(() => rejectIframe()).observe(document.documentElement, { childList:true, subtree:true });
    };
    if (document.documentElement) watchFrames();
    else document.addEventListener('DOMContentLoaded', watchFrames, { once:true });
  })()`;
}

const sameTarget = (left, right) => left?.path === right?.path && left?.selector === right?.selector;

// 浏览器的 dblclick 会先派发 click、click、dblclick；input 也会逐字派发。
// 录制包与回放 spec 共用这份确定性归一化，避免三击与逐字重填。
export function normalizeCefRecordedEvents(rawEvents) {
  const out = [];
  for (const raw of Array.isArray(rawEvents) ? rawEvents : []) {
    const event = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : raw;
    if (event?.action === 'fill' && out.at(-1)?.action === 'fill' && sameTarget(out.at(-1), event)) {
      out[out.length - 1] = event;
      continue;
    }
    if (event?.action === 'dblclick') {
      let removed = 0;
      while (removed < 2 && out.at(-1)?.action === 'click' && sameTarget(out.at(-1), event)) {
        out.pop();
        removed += 1;
      }
    }
    out.push(event);
  }
  return out;
}

export function classifyCefPageBinding({ expectedPath, observedPath, topLevel, frameCount }) {
  if (topLevel !== true || !Number.isInteger(frameCount) || frameCount !== 0) return 'iframe_unsupported';
  if (typeof observedPath !== 'string') return 'context_unavailable';
  if (expectedPath === null) return 'bound';
  if (typeof expectedPath !== 'string') return 'context_unavailable';
  return observedPath === expectedPath ? 'bound' : 'path_mismatch';
}

function childFrameCount(frameTree) {
  if (!frameTree || typeof frameTree !== 'object') return null;
  const children = Array.isArray(frameTree.childFrames) ? frameTree.childFrames : [];
  let count = children.length;
  for (const child of children) {
    const nested = childFrameCount(child);
    if (!Number.isInteger(nested)) return null;
    count += nested;
  }
  return count;
}

async function inspectCefPageBinding(cdp, expectedPath) {
  let tree;
  let context;
  try {
    tree = await cdp.send('Page.getFrameTree');
    const expression = `(() => ({ path: location.pathname + location.search, topLevel: window.top === window, domFrameCount: document.querySelectorAll('iframe,frame').length }))()`;
    const out = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    context = out && !out.exceptionDetails && out.result && out.result.value;
  } catch {
    return 'context_unavailable';
  }
  const protocolFrames = childFrameCount(tree?.frameTree);
  if (!context || !Number.isInteger(context.domFrameCount) || !Number.isInteger(protocolFrames)) return 'context_unavailable';
  return classifyCefPageBinding({
    expectedPath,
    observedPath: context.path,
    topLevel: context.topLevel,
    frameCount: Math.max(context.domFrameCount, protocolFrames),
  });
}

export async function installCefTeachRecorder(cdp, { maxMs, onEvent } = {}) {
  if (!cdp || typeof cdp.send !== 'function' || typeof cdp.on !== 'function') throw fail('CEF_RECORD_CDP_INVALID');
  if (!Number.isInteger(maxMs) || maxMs < 1000 || maxMs > 3600000) throw fail('CEF_RECORD_MAX_INVALID');
  if (typeof onEvent !== 'function') throw fail('CEF_RECORD_SINK_INVALID');
  let done = false;
  let timer = null;
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const finish = (reason) => {
    if (done) return;
    done = true;
    if (timer) clearTimeout(timer);
    resolveFinished(reason);
  };
  const off = cdp.on('Runtime.bindingCalled', (params) => {
    if (params?.name !== '__caseyCefRecord' || typeof params.payload !== 'string' || params.payload.length > 8192) return;
    let message;
    try { message = JSON.parse(params.payload); } catch { return; }
    if (done) return;
    if (message?.type === 'unsupported' && message.reason === 'iframe') { finish('iframe_unsupported'); return; }
    if (message?.type === 'stop') { finish('manual'); return; }
    if (message?.type === 'event' && message.event && typeof message.event === 'object' && !Array.isArray(message.event)) onEvent(message.event);
  });
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Runtime.addBinding', { name: '__caseyCefRecord' });
    const initialBinding = await inspectCefPageBinding(cdp, null);
    if (initialBinding === 'iframe_unsupported') throw fail('CEF_RECORD_IFRAME_UNSUPPORTED');
    if (initialBinding === 'context_unavailable') throw fail('CEF_RECORD_PAGE_CONTEXT_UNAVAILABLE');
    const source = recorderSource();
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
    timer = setTimeout(() => finish('timeout'), maxMs);
    await cdp.send('Runtime.evaluate', { expression: source, awaitPromise: true, returnByValue: true });
  } catch (error) {
    off();
    finish('install_failed');
    throw error;
  }
  return {
    finished,
    stop: () => finish('caller'),
    dispose: () => { off(); finish('disposed'); },
  };
}

export function buildCefSpecFromCapture(capture, { recordedAt = new Date().toISOString() } = {}) {
  if (!capture || capture.artifactKind !== 'teach-in-capture' || !/^tc_[a-z0-9_]+$/.test(capture.caseId || '') || !Array.isArray(capture.events) || capture.events.length === 0) throw fail('CEF_CAPTURE_INVALID');
  const normalized = normalizeCefRecordedEvents(capture.events);
  const events = normalized.map((event, index) => {
    if (!['click', 'dblclick', 'fill', 'press'].includes(event?.action)) throw fail('CEF_CAPTURE_EVENT_UNSUPPORTED');
    if (typeof event.selector !== 'string' || !event.selector.trim()) throw fail('CEF_CAPTURE_SELECTOR_MISSING');
    const out = {
      stepId: `atstep_${index + 1}`,
      intentId: `intent_${index + 1}`,
      action: event.action,
      path: event.path,
      selector: event.selector,
    };
    if (event.action === 'fill') {
      if (event.valueMasked === true || event.value === '<redacted>') throw fail('CEF_CAPTURE_VALUE_REDACTED');
      if (typeof event.value !== 'string') throw fail('CEF_CAPTURE_VALUE_MISSING');
      out.value = event.value;
    }
    if (event.action === 'press') {
      if (typeof event.key !== 'string' || !event.key.trim()) throw fail('CEF_CAPTURE_KEY_MISSING');
      out.key = event.key;
    }
    return out;
  });
  const spec = { schemaVersion: 1, channel: 'cef', caseId: capture.caseId, recordedAt, authored: false, startPath: capture.startPath, events };
  if (!validateCefReplaySpec(spec).ok) throw fail('CEF_CAPTURE_SPEC_INVALID');
  return spec;
}

export async function replayCefSpec(cdp, spec, { actionQuietMs = 500, screencast = null } = {}) {
  const checked = validateCefReplaySpec(spec);
  if (!checked.ok) throw fail('CEF_REPLAY_SPEC_INVALID');
  const steps = [];
  const refuseContext = (binding) => {
    if (binding === 'iframe_unsupported') throw fail('CEF_REPLAY_IFRAME_UNSUPPORTED');
    if (binding === 'context_unavailable') throw fail('CEF_REPLAY_PAGE_CONTEXT_UNAVAILABLE');
  };
  const initial = await inspectCefPageBinding(cdp, spec.startPath);
  refuseContext(initial);
  if (initial !== 'bound') {
    const event = spec.events[0];
    return [{
      stepId: event.stepId,
      intentId: event.intentId,
      action: event.action,
      locatorResolution: 'start_path_mismatch',
      candidateCount: null,
      actionPerformed: false,
      identityReadback: { ok: false },
    }];
  }
  for (const event of spec.events) {
    if (screencast) screencast.markStep(event.stepId);
    const binding = await inspectCefPageBinding(cdp, event.path);
    refuseContext(binding);
    if (binding !== 'bound') {
      steps.push({
        stepId: event.stepId,
        intentId: event.intentId,
        action: event.action,
        locatorResolution: 'path_mismatch',
        candidateCount: null,
        actionPerformed: false,
        identityReadback: { ok: false },
      });
      break;
    }
    let observed;
    try { observed = await performCefAction(cdp, event); }
    catch { observed = { resolution: 'action_failed', candidateCount: null, actionPerformed: false, identityReadback: { ok: false } }; }
    if (observed?.resolution === 'iframe_unsupported') throw fail('CEF_REPLAY_IFRAME_UNSUPPORTED');
    steps.push({
      stepId: event.stepId,
      intentId: event.intentId,
      action: event.action,
      locatorResolution: observed.resolution,
      candidateCount: Number.isInteger(observed.candidateCount) ? observed.candidateCount : null,
      actionPerformed: observed.actionPerformed === true,
      identityReadback: { ok: observed.identityReadback?.ok === true },
    });
    if (observed.actionPerformed !== true || observed.identityReadback?.ok !== true) break;
    if (actionQuietMs > 0) await sleep(actionQuietMs);
  }
  return steps;
}

export function buildReplayReceipt({ caseId, profileSha256, captureSha256, steps, expectedStepCount = null, video = null, generatedAt = new Date().toISOString() }) {
  const safeSteps = Array.isArray(steps) ? steps.map((step) => ({
    stepId: String(step.stepId || ''),
    intentId: String(step.intentId || ''),
    action: String(step.action || ''),
    locatorResolution: String(step.locatorResolution || 'unknown'),
    candidateCount: Number.isInteger(step.candidateCount) ? step.candidateCount : null,
    actionPerformed: step.actionPerformed === true,
    identityReadback: { ok: step.identityReadback?.ok === true },
  })) : [];
  return {
    schemaVersion: 1,
    artifactKind: 'cef-replay-receipt',
    caseId: String(caseId),
    generatedAt,
    profileSha256: String(profileSha256 || ''),
    captureSha256: String(captureSha256 || ''),
    steps: safeSteps,
    allActionsPerformed: safeSteps.length > 0
      && (!Number.isInteger(expectedStepCount) || safeSteps.length === expectedStepCount)
      && safeSteps.every((step) => step.actionPerformed && step.identityReadback.ok),
    formalVerdictEligible: false,
    verdict: null,
    video,
    note: '机械回放收据：没有已签断言/三轴/确定性 verdict，不是正式测试 PASS。',
  };
}

export function buildVisualReviewRequest({ caseId, replayReceipt, frameIndex, generatedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    artifactKind: 'visual-review-request',
    caseId: String(caseId),
    generatedAt,
    replayReceipt: String(replayReceipt),
    frameIndex: String(frameIndex),
    allowedResult: ['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE'],
    instruction: '逐步查看真实回放帧，只复核操作是否与示教意图一致；证不出选 INDETERMINATE。',
    affectsVerdict: false,
    verdictAuthority: 'none',
  };
}

const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function renderCefReplayHtml({ caseId, spec, receipt, attachments, testCaseText = null }) {
  const rows = (Array.isArray(receipt?.steps) ? receipt.steps : []).map((step, index) => {
    const action = String(step.action || 'unknown');
    const description = {
      click: '点击已录制目标',
      dblclick: '双击已录制目标',
      fill: '填入已录制测试数据（值不显示）',
      press: '向已录制目标发送按键',
    }[action] || '执行已录制动作';
    const mechanical = step.actionPerformed === true && step.identityReadback?.ok === true ? '已派发并回读' : '未能确证';
    return `<tr><td>${index + 1}</td><td>${htmlEscape(step.stepId)}</td><td>${htmlEscape(step.intentId)}</td><td>${htmlEscape(action)}</td><td>${htmlEscape(description)}</td><td>${htmlEscape(mechanical)}</td></tr>`;
  }).join('');
  const links = (Array.isArray(attachments) ? attachments : []).map((file) => `<li><a href="${htmlEscape(file)}">${htmlEscape(file)}</a></li>`).join('');
  const natural = typeof testCaseText === 'string' && testCaseText.trim()
    ? htmlEscape(testCaseText.trim())
    : '缺失/待补：示教录制包未包含已签 TestCase 自然语言；Casey 未根据动作编造。';
  const recordedCount = Array.isArray(spec?.events) ? spec.events.length : 0;
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>Casey CEF 机械回放收据报告（非正式 PASS）</title>
<style>body{font:15px/1.55 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#18202a}.warning{border:2px solid #b45309;background:#fff7ed;padding:1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd2d8;padding:.45rem;text-align:left}iframe{width:100%;height:600px;border:1px solid #ccd2d8}code{background:#eef1f4;padding:.1rem .25rem}</style>
<h1>Casey CEF 机械回放收据报告（非正式 PASS）</h1>
<div class="warning"><strong>不是正式测试结论。</strong> <code>formalVerdictEligible=false</code>，没有已签断言、三轴或确定性 verdict；即使动作全部派发，也不得称为 PASS。</div>
<h2>测试用例（自然语言描述）</h2><p>${natural}</p>
<h2>分解后的原子操作</h2><p>caseId：<code>${htmlEscape(caseId)}</code>；录制规格 ${recordedCount} 步。</p>
<table><thead><tr><th>#</th><th>stepId</th><th>intentId</th><th>动作</th><th>原子描述</th><th>机械回读</th></tr></thead><tbody>${rows}</tbody></table>
<h2>录屏</h2><p><a href="cef-screencast/recording.html">打开可播放录屏</a></p><iframe src="cef-screencast/recording.html" title="CEF 机械回放录屏"></iframe>
<h2>附件</h2><ul>${links}</ul>
</html>`;
}
