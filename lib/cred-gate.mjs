// lib/cred-gate.mjs —— 凭据兜底门共享件（护栏 #7，G5 取 B：单源、所有落盘口统一过门）。
// 从 bin/report.mjs 抽出（p7-credgate-coverage.golden 语义一字不变）；bin/report.mjs 保留 re-export。
// 消费方：相6 报告落盘（bin/report.mjs）、相1 编译产物落盘（bin/compile.mjs：flow/events/observed/compile-report）。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AUTH_DIR, CREDS_FILE, PROJECT_ROOT } from './paths.mjs';

// 凭据/禁字段关键词（与 seams-freeze.golden 同源，护栏 #7；token/cookie 为 p3 异构评审 R1-F5 补强）。
export const FORBIDDEN_KEYWORDS = ['authorization', 'set-cookie', 'password', 'apikey', 'x-api-key', 'bearer ', 'secret', 'credential', 'token', 'cookie'];

// 收集凭据文件里的敏感字面量值（若存在），用于精确比对——防真凭据被合成进产物后随落盘外泄。
// 两类键的值不收集（皆为域定义的非凭据、且必然合法出现在产物里，收了全是假阳性）：
//   - role：ARIA 角色是 W3C 公共词表枚举（button/textbox/...），events 语义定位器必含；
//   - successField/successValue/background：通道剖面三件（CONTEXT 定义 = 非凭据配置、tier-2 由 site.json
//     非凭据子集投影），observed 的 errorEnvelope.field 与背景轮询 URL 必含。
// R1-F5 收紧（评审建议「取消跳过」违反通道剖面接缝定义，修正采纳为形状校验，audit 留案）：
// 跳过只对「值形状确属该键语义」成立——role 须 ∈ ARIA 角色枚举、successField/Value 须短标识符、
// background 须以 / 开头的路径段；形状不符（可疑走私值）照收进敏感池。
const ARIA_ROLES = new Set(['button', 'textbox', 'combobox', 'menuitem', 'checkbox', 'radiogroup', 'radio', 'listbox', 'option', 'dialog', 'status', 'alert', 'link', 'heading', 'gridcell', 'searchbox', 'switch', 'tab', 'tabpanel', 'toolbar', 'tooltip', 'treeitem']);
const IDENT_RE = /^[A-Za-z0-9_.-]{1,32}$/;
function isNonCredentialShaped(key, v) {
  if (key === 'role') return ARIA_ROLES.has(v);
  if (key === 'successField' || key === 'successValue') return IDENT_RE.test(v);
  if (key === 'background') return v.startsWith('/');
  return false;
}
export function collectSecretLiterals() {
  const lits = new Set();
  const files = [CREDS_FILE, join(PROJECT_ROOT, 'site.json'), join(AUTH_DIR, 'site.json')];
  for (const f of files) {
    if (!existsSync(f)) continue;
    let j;
    try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    (function walk(n, key) {
      if (Array.isArray(n)) { n.forEach((x) => walk(x, key)); return; }
      if (n && typeof n === 'object') { for (const [k, v] of Object.entries(n)) walk(v, k); return; }
      if (typeof n === 'string' && n.length >= 6 && !isNonCredentialShaped(key, n)) lits.add(n);
    })(j, null);
  }
  return [...lits];
}

// 落盘前凭据门：扫将写出的产物字符串映射 { 名: 文本 }。命中 → { ok:false, hit }（fail-closed，调用方拒写）。
export function credentialGate(outputs) {
  const secrets = collectSecretLiterals();
  for (const [name, text] of Object.entries(outputs)) {
    const low = String(text).toLowerCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
      if (low.includes(kw)) return { ok: false, hit: `产物 ${name} 含禁字段关键词「${kw}」` };
    }
    for (const s of secrets) {
      if (String(text).includes(s)) return { ok: false, hit: `产物 ${name} 含凭据文件敏感字面量（已隐去）` };
    }
  }
  return { ok: true };
}

// url 剥 query/hash（G5 加固：observed requestLog[].url 落盘前必过——query 串可携 token，layer3-wiring F3 教训）。
// 支持完整 URL 与相对路径；无 query/hash 原样返回。
export function stripUrlQuery(url) {
  const s = String(url);
  const cut = (ch) => { const i = s.indexOf(ch); return i >= 0 ? i : s.length; };
  return s.slice(0, Math.min(cut('?'), cut('#')));
}
