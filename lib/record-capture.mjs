// lib/record-capture.mjs -- teach-in capture package builder.
// A capture is source material for later distillation. It is not signed and not replay-ready.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { credentialGate } from './cred-gate.mjs';
import { isTopologyAction } from './page-topology/topology-events.mjs';

// 允许的动作类（单一事实源；record-intake 复核闸导入复用，勿在别处另立第二份）。
export const ALLOWED_ACTIONS = new Set(['click', 'dblclick', 'fill', 'press', 'nav', 'newpage']);
// sanitizeRecordEvent 可产的全部事件键（单一事实源）：record-intake 据此拒未知键走私（如裸中文敏感键）。
// = seq/action/path + STRING_FIELDS + valueMasked + NUMBER_FIELDS。改本集须同步 sanitizeRecordEvent 输出。
export const ALLOWED_EVENT_KEYS = new Set(['seq', 'action', 'path', 'selector', 'text', 'tagName', 'fieldLabel', 'value', 'valueMasked', 'key', 'x', 'y', 'ox', 'oy']);
const STRING_FIELDS = ['selector', 'text', 'tagName', 'fieldLabel', 'value', 'key'];
const NUMBER_FIELDS = ['x', 'y', 'ox', 'oy'];
// 敏感字段判据（护栏 #7）：中英双语——SUT 为中文中台，纯英文正则漏 密码/验证码/密钥 等，异构评审 A2 实证
// （「新密码」「动态验证码」明文落包）。字段元数据命中即对 value 遮值；凭据卫生优先于可用性（GRILL D5）。
// 导出供 record-intake 复核闸复用（单一事实源；勿在 intake 另立第二份判据）。
export const SENSITIVE_FIELD_RE = /(password|passwd|passcode|pass|pwd|token|secret|credential|authorization|cookie|apikey|api-key|x-api-key|otp|captcha|cvv|\bpin\b|密码|口令|密钥|密保|验证码|校验码|动态码|短信码)/i;

// host 安全 URL 投影（护栏 #7）：镜像 bin/replay.mjs:582 `toPathQuery` 已封接缝 + report-model
// `redactUrlPath`「percent-decode 双判」思路。白名单 http/https/ws/wss 剥 host 只留 pathname+search；
// 非白名单 scheme（blob:/file:/ftp: …）、协议相对 //host、pathname/search 仍内嵌 `://` 或 `%3a%2f%2f`
// （query 走私 ?redirect=https://host 及其百分号编码形）一律脱敏占位。「:// 零容忍，宁失细节不漏 host」，
// 与 replay/output-seal 同口径。注：此为 record 侧局部复制，dedup 进 cred-gate 列 prd observability。
// 导出供 record-intake URL 泄漏判据复用（覆盖裸 :// 与百分号编码 %3a%2f%2f 走私）。
export function hasEmbeddedScheme(str) {
  return String(str).includes('://') || /%3a%2f%2f/i.test(String(str));
}
export function projectUrlSafe(value) {
  const s = String(value == null ? '' : value);
  if (!s) return '/';
  try {
    const u = new URL(s);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) return '<redacted:non-http-url>';
    const out = `${u.pathname || '/'}${u.search || ''}`;
    return hasEmbeddedScheme(out) ? '<redacted:non-http-url>' : out;
  } catch {
    // 协议相对 //host/x 与内嵌 :// 的相对串走私 host——仅放行单斜杠起始、无内嵌 scheme 的纯路径。
    if (s.startsWith('/') && !s.startsWith('//') && !hasEmbeddedScheme(s)) {
      const cut = s.indexOf('#');
      return (cut >= 0 ? s.slice(0, cut) : s) || '/';
    }
    return '<redacted:non-http-url>';
  }
}
// 兼容别名（旧引用）。
export const pathOf = projectUrlSafe;

// 自由文本字段里嵌的 URL 一并 host 安全化：任意 scheme:// 投影剥 host；裸协议相对 //host 脱敏。
function scrubUrlLike(value) {
  return String(value == null ? '' : value)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (m) => projectUrlSafe(m))
    .replace(/(^|[\s"'<>(=])\/\/[A-Za-z0-9.\-]+(?::\d+)?(?:\/[^\s"'<>]*)?/g, (_m, pre) => `${pre}<redacted:non-http-url>`);
}

function cleanString(value, max = 1000) {
  return scrubUrlLike(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

// 导出供 record-intake 复用：事件元数据命中敏感字段判据（护栏 #7 单一事实源）。
export function isSensitiveField(ev) {
  return SENSITIVE_FIELD_RE.test([
    ev.selector,
    ev.fieldLabel,
    ev.name,
    ev.placeholder,
    ev.type,
    ev.tagName,
  ].filter(Boolean).join(' '));
}

export function sanitizeRecordEvent(input, index = 0) {
  const raw = input && typeof input === 'object' ? input : {};
  const action = ALLOWED_ACTIONS.has(raw.action) || isTopologyAction(raw.action)
    ? raw.action
    : 'click';
  const out = {
    seq: index + 1,
    action,
    path: projectUrlSafe(raw.path || raw.url || raw.href || raw.location),
  };
  for (const k of STRING_FIELDS) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (k === 'value' && isSensitiveField(raw)) {
      out.value = '<redacted>';
      out.valueMasked = true;
      continue;
    }
    const v = cleanString(raw[k], k === 'value' ? 1000 : 200);
    if (v) out[k] = v;
  }
  for (const k of NUMBER_FIELDS) {
    const n = Number(raw[k]);
    if (Number.isFinite(n)) out[k] = Math.round(n);
  }
  return out;
}

export function captureOutputPath({ outDir, caseId }) {
  return join(resolve(String(outDir)), String(caseId), 'record-capture', 'teach-in-capture.json');
}

export function buildTeachInCapture({ caseId, startUrl, events, createdAt = new Date().toISOString() }) {
  const safeEvents = (Array.isArray(events) ? events : []).map((ev, i) => sanitizeRecordEvent(ev, i));
  return {
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: String(caseId),
    createdAt,
    startPath: projectUrlSafe(startUrl || safeEvents[0]?.path || '/'),
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events: safeEvents,
  };
}

export function writeTeachInCapture({ caseId, outDir, startUrl, events, createdAt }) {
  const file = captureOutputPath({ outDir, caseId });
  const doc = buildTeachInCapture({ caseId, startUrl, events, createdAt });
  const text = JSON.stringify(doc, null, 2) + '\n';
  const gate = credentialGate({ 'teach-in-capture.json': text });
  if (!gate.ok) {
    const err = new Error(gate.hit);
    err.code = 'CREDENTIAL_GATE';
    throw err;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
  return { file, doc };
}
