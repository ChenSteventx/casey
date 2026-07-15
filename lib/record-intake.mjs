// lib/record-intake.mjs -- teach-in intake gate + intake ledger (append-only).
// Reviews a teach-in-capture against safety invariants and records accept/reject to a local ledger.
// The intake ledger is NOT the verdict-downstream Failure Ledger (CONTEXT: 失败记录台账)：它绝不进
// bin/verdict.mjs、绝不作自愈输入、绝不改写任何裁定（护栏 #13/#15）。它只是「录制物入蒸馏前置队列」的入账凭据。
import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { credentialGate } from './cred-gate.mjs';
import { ALLOWED_ACTIONS, ALLOWED_EVENT_KEYS, hasEmbeddedScheme, isSensitiveField } from './record-capture.mjs';

// JSON 对象内重复键探测（异构评审 R8）：JSON.parse 静默取最后一个，重复键可把脏内容（URL/凭据）藏在被丢弃
// 的键里绕过 parsed-doc 全部检查。极简 tokenizer（非正则）：跟踪对象作用域键集，遇重复即真——含 \u 编码键名
// 解码后比对。拒重复键后 parsed doc 即完整内容，parse(\u 解码) + normConverge(%HH 解码) 的检查方系统完备。
export function hasDuplicateKeys(text) {
  const s = String(text);
  const n = s.length;
  const stack = [];        // 对象作用域压 Set<string>；数组作用域压 null
  let expectKey = false;   // 下一个字符串是否为对象键
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1, val = '';
      while (j < n) {
        const ch = s[j];
        if (ch === '\\') {
          const e = s[j + 1];
          if (e === 'u') { val += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16) || 0); j += 6; }
          else { val += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' })[e] ?? e; j += 2; }
        } else if (ch === '"') { j++; break; } else { val += ch; j++; }
      }
      const top = stack[stack.length - 1];
      if (top instanceof Set && expectKey) { if (top.has(val)) return true; top.add(val); }
      expectKey = false;
      i = j;
      continue;
    }
    if (c === '{') { stack.push(new Set()); expectKey = true; }
    else if (c === '[') { stack.push(null); expectKey = false; }
    else if (c === '}' || c === ']') { stack.pop(); expectKey = false; }
    else if (c === ',') { expectKey = stack[stack.length - 1] instanceof Set; }
    else if (c === ':') { expectKey = false; }
    i++;
  }
  return false;
}

// 通用 %HH 百分号还原到不动点 + 反斜杠归一为 /（检测用规范化，非落盘）：逐轮把所有合法 %HH 解成字符
// （不整体 decodeURIComponent——那会对合法裸 %「100% done」抛错），故裸 % 原样留存不误判。反斜杠归一因
// WHATWG URL 把 \ 当 /（/\host → //host 协议相对）。返回 { s, converged }：cap 内未到不动点（超深嵌套
// %2525.../ 或超深编码 scheme 字母 %73）即 converged=false，调用方据此 fail-closed（异构评审 R2-F3 + R4 + R5 + R6）。
export function normConverge(text) {
  let s = String(text);
  for (let i = 0; i < 20; i++) {
    const n = s.replace(/%[0-9a-f]{2}/gi, (m) => String.fromCharCode(parseInt(m.slice(1), 16))).replace(/\\/g, '/');
    if (n === s) return { s, converged: true };
    s = n;
  }
  return { s, converged: false };
}

// 已知危险 scheme（无 // 也算走私：blob:/javascript:/data:/file: 等）——用于**自由文本字段**扫描（text/value）：
// 黑名单式避免误伤合法散文里的 Note:/see: 冒号；须以非 scheme 字符或串首起头，防 myblob: 误命中（异构评审 R5）。
const DANGER_SCHEME = /(?:^|[^a-z0-9.+-])(?:blob|data|file|javascript|vbscript|ftp|ftps|sftp|scp|smb|ssh|telnet|ldap|ldaps|rtsp|rtmp|gopher|git|svn|nfs|afp|vnc|rdp|tftp|mailto|about|intent|ws|wss|http|https):/i;
// 自由文本字段（event.text/fieldLabel/selector 等单值）里的**任意** scheme-URL：scheme-shaped token 后跟含 URL 结构
// 字符（/ @ [）的非空 payload——覆盖 smb:/ssh:/telnet: 等非白名单 scheme 携内网 host（record scrubUrlLike 采集期
// 本就剥净，intake 拒之属一致纵深防御）。要求 payload 含 /@[ 以免误伤合法散文冒号 Price:100 / Note:done（异构评审 R9）。
// 只用于**单值**扫描（不用于 JSON.stringify 全文——否则 "startPath":"/x" 类 键:"/值 会假命中）。
const FREE_TEXT_SCHEME = /(?:^|[^a-z0-9+.\-])[a-z][a-z0-9+.\-]*:[^\s"']*[/@[]/i;
// path 字段专用 scheme 判据（保守边界，非枚举 wrapper）：任何 scheme-shaped token（非 scheme 字符或串首后
// 的 [a-z][a-z0-9+.-]*:）皆非法——一举覆盖 smb/ssh/telnet/… 全部遗漏 scheme、任意 wrapper（!@*()[]、全角等，
// 皆非 scheme 字符）、编码后还原出的 scheme。数字起头冒号（12:00 时间）不命中（scheme 须 [a-z] 起）；冒号在
// path 段（/a/b:c、matrix !room:server）会命中拒——Heren 路由无冒号段故不误伤，真有业务冒号路径再显式白名单
// （异构评审 R6 + R8：从补 wrapper 字符表改保守边界，不再逐个补漏）。
const PATH_SCHEME = /(?:^|[^a-z0-9+.\-])[a-z][a-z0-9+.\-]*:/i;

// path 字段（startPath / event.path）须 path-only 形态：拒裸反斜杠，基于**规范化后**结果判——单 / 起始、
// 非 //、无内嵌 scheme（:// 或任何 PATH_SCHEME）——拒裸 host、任意 scheme（blob:/smb:/编码 java%73cript:）、
// query 内嵌 URL、编码/反斜杠后 //host 旁路（异构评审 R3-#2 + R4 + R5 + R6）。还原不收敛 fail-closed。
function isPathOnly(s) {
  if (typeof s !== 'string' || !s.startsWith('/') || s.includes('\\')) return false;
  const { s: n, converged } = normConverge(s);
  if (!converged) return false;
  return n.startsWith('/') && !n.startsWith('//') && !hasEmbeddedScheme(n) && !PATH_SCHEME.test(n);
}

// 事件字段类型硬校验键集（异构评审 R3-#1）：防 value:{密码:...} 类嵌套 object/array 走私绕过字符串扫描。
const STR_KEYS = ['action', 'path', 'selector', 'text', 'tagName', 'fieldLabel', 'value', 'key'];
const NUM_KEYS = ['seq', 'x', 'y', 'ox', 'oy'];
// v1 顶层与 source 键闭合白名单（异构评审 R4）：拒未知键（防顶层/source 携中文敏感内容走私，凭据门只扫英文）。
const ALLOWED_TOP_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'createdAt', 'startPath', 'source', 'events']);
const ALLOWED_SOURCE_KEYS = new Set(['kind', 'signed', 'replayReady', 'distillRequired']);
// source.kind 枚举（record-capture 唯一产 'manual'）+ createdAt 严格 ISO——标量元数据不留自由文本口（异构评审 R5）。
const ALLOWED_SOURCE_KIND = new Set(['manual']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/;

// URL 泄漏判据（护栏 #7，纵深防御）：定向还原到不动点后判任意 scheme://（含 %3a%2f%2f 走私）、危险裸 scheme、
// 或多斜杠 //host。合法 capture 已由 record 侧 projectUrlSafe 剥净，此处只兜篡改/异源包把真 host 带进蒸馏队列。
// //host 判据放宽到 //+<非空白非斜杠>——覆盖 IPv6 bracket、多斜杠 ///host、反斜杠 /\host、Unicode host 等；
// 还原不收敛即 fail-closed 判泄漏（异构评审 F3 + R2-F3 + R3-#2 + R4 + R5）。
export function hasUrlLeak(text) {
  const { s, converged } = normConverge(text);
  if (!converged) return true;
  if (hasEmbeddedScheme(s) || DANGER_SCHEME.test(s)) return true;
  return /\/\/[^\s/]/.test(s);
}

// fail-closed 复核闸（GRILL D4）：逐条判，命中即 { ok:false, reason:<类别码> }；全过 accepted。
// reason 只回类别码，绝不回原始脏内容（防二次泄漏）。类别码刻意避开 cred-gate 禁字段子串（防台账行自触门）。
export function reviewCapture(doc, { caseId } = {}) {
  const eventCount = Array.isArray(doc?.events) ? doc.events.length : null;
  const rej = (reason) => ({ ok: false, status: 'rejected', reason, eventCount });

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return rej('ARTIFACT_KIND');
  if (doc.artifactKind !== 'teach-in-capture') return rej('ARTIFACT_KIND');
  // v1 顶层键闭合（异构评审 R4）：拒未知顶层键（防携中文敏感内容走私）；createdAt 若在须 string（防 object 携内容）。
  for (const k of Object.keys(doc)) if (!ALLOWED_TOP_KEYS.has(k)) return rej('UNKNOWN_FIELD');
  // createdAt 若在须严格 ISO（异构评审 R5）：不留自由文本口携中文敏感内容（如 createdAt:"密码=..."）。
  if (doc.createdAt !== undefined && (typeof doc.createdAt !== 'string' || !ISO_RE.test(doc.createdAt))) return rej('UNKNOWN_FIELD');
  const src = doc.source;
  if (!src || typeof src !== 'object' || Array.isArray(src) || src.signed !== false || src.replayReady !== false || src.distillRequired !== true) return rej('SIGNED_FLAG');
  // source 键闭合 + kind 须 string（异构评审 R4）：拒 source 未知键 / kind 携 object 内容。
  for (const k of Object.keys(src)) if (!ALLOWED_SOURCE_KEYS.has(k)) return rej('UNKNOWN_FIELD');
  if (!ALLOWED_SOURCE_KIND.has(src.kind)) return rej('SIGNED_FLAG');
  if (doc.schemaVersion !== 1) return rej('SCHEMA_VERSION');
  // 严格类型 + 全等（非 String() 宽松比较——防包内 caseId:['x'] 类型戏法过闸，异构评审 F4）。
  if (typeof doc.caseId !== 'string' || doc.caseId !== String(caseId)) return rej('CASEID_MISMATCH');
  // startPath 须 path-only（异构评审 R3-#2）：防裸 host / 非白名单 scheme / query 内嵌 URL 入账。
  if (!isPathOnly(doc.startPath)) return rej('URL_LEAK');
  if (!Array.isArray(doc.events) || doc.events.length === 0) return rej('EMPTY_EVENTS');
  for (const ev of doc.events) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev) || !ALLOWED_ACTIONS.has(ev.action)) return rej('DIRTY_EVENT');
    if (!isPathOnly(ev.path)) return rej('DIRTY_EVENT');
    // 事件键须 ⊆ record 输出白名单——拒未知键走私（如裸中文敏感键 密码，isSensitiveField 只看命名字段扫不到）（异构评审 R2-F2）。
    for (const k of Object.keys(ev)) if (!ALLOWED_EVENT_KEYS.has(k)) return rej('DIRTY_EVENT');
    // 敏感字段只接受 value===<redacted> 或缺席——valueMasked 是包内自声明、不可信；非 string value 也拒
    // （复用 record-capture 判据单一事实源，异构评审 F2 + R2-F2）。判据仅**字段命名级**：命中的是 fieldLabel/
    // selector/name/placeholder/type/tagName 命名口（如 新密码/验证码），拦的是这类命名字段带明文值。
    // **明示局限**（同族兜底评审 F1）：自由文本**值/文本内容**里的非英文密文、裸内网 host、非白名单 scheme
    // 裸 host 不由本闸内容级扫描兜——结构上无法区分凭据与合法文案（会过拒），由录制侧字段脱敏 + 下游人签负责；
    // 见 learn 明示残留，勿把金牌 GREEN 读成「全类中文凭据/host 已覆盖」。
    // 敏感判据先于通用类型校验——非 string 敏感 value（如 命名字段带 123456）归 SENSITIVE_FIELD 而非 DIRTY_EVENT。
    if (isSensitiveField(ev) && ev.value !== undefined && ev.value !== '<redacted>') return rej('SENSITIVE_FIELD');
    // 字段类型硬校验（异构评审 R3-#1）：string 字段须 string（拒 value:{密码:...} 嵌套 object/array 走私）、
    // number 字段须 finite、valueMasked 须 boolean。
    for (const k of STR_KEYS) if (ev[k] !== undefined && typeof ev[k] !== 'string') return rej('DIRTY_EVENT');
    for (const k of NUM_KEYS) if (ev[k] !== undefined && !Number.isFinite(ev[k])) return rej('DIRTY_EVENT');
    if (ev.valueMasked !== undefined && typeof ev.valueMasked !== 'boolean') return rej('DIRTY_EVENT');
    for (const v of Object.values(ev)) {
      if (typeof v !== 'string') continue;
      if (hasUrlLeak(v) || FREE_TEXT_SCHEME.test(normConverge(v).s)) return rej('DIRTY_EVENT');
    }
  }
  // 非事件字段（如 startPath）内嵌 URL 的兜底——事件字段已由上面逐条判掉。
  if (hasUrlLeak(JSON.stringify(doc))) return rej('URL_LEAK');
  return { ok: true, status: 'accepted', reason: null, eventCount };
}

// 入账台账落 capture 同目录（其入账事实与该录制包同处一档）。
export function intakeLedgerPath({ capturePath }) {
  return join(dirname(String(capturePath)), 'intake-ledger.jsonl');
}

export function buildIntakeRecord({ caseId, status, reason = null, eventCount = null, captureName, captureSha256 = null, intakedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    event: 'intake',
    intakeStatus: status,
    caseId: String(caseId),
    intakedAt,
    eventCount: Number.isInteger(eventCount) ? eventCount : null,
    reason: status === 'accepted' ? null : (reason || null),
    captureName: String(captureName || ''),
    // capture 字节 sha256：accept 条目绑此哈希，distill 消费前须校验当前 capture 未被换包（TOCTOU 防线，异构评审 F1）。
    captureSha256: typeof captureSha256 === 'string' ? captureSha256 : null,
  };
}

// append-only 落台账：序列化单行过凭据门（命中抛 CREDENTIAL_GATE，绝不写），追加不改（会计台账血缘）。
export function appendIntakeLedger({ ledgerPath, record }) {
  const line = JSON.stringify(record) + '\n';
  const gate = credentialGate({ 'intake-ledger.jsonl': line });
  if (!gate.ok) { const e = new Error(gate.hit); e.code = 'CREDENTIAL_GATE'; throw e; }
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, line, 'utf8');
  return { ledgerPath, record };
}
