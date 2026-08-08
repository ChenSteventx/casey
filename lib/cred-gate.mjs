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

// 域定义非凭据世系键（credgate-lineage-keys，Steven 裁 2026-08-08 门学形状豁免）：
// v3 清理取证的批次/唯一名世系字段名含 token 子串，会被关键词包含匹配误伤（第十例
// 「从未走通过」——replay 执行链全通、恒死 axes 落盘门）。键感知中和只作用于【扫描副本】
// 的关键词分支：把合形键值对的【键名】换成不含任何关键词的中性标记，值与其余文本原样
// ——值仍受关键词分支（中和副本里原样在场）与敏感字面量分支（扫原文）全额扫描；
// 值形状不符（走私可疑值）不中和照拦。同族先例：collectSecretLiterals 的 R1-F5
// 键感知+值形状豁免、maskCredentialRoute 的路由段 token 误伤打码。
const NON_CREDENTIAL_JSON_KEYS = ['batchToken', 'uniqueNameToken'];
// 与 replay --unique-name 合法域同构：1-64 位、字母数字起头、仅字母数字/下划线/连字符
//（字符集不含引号与反斜杠，正则对 JSON 文本无转义逃逸面）。
const LINEAGE_VALUE_SOURCE = '[A-Za-z0-9][A-Za-z0-9_-]{0,63}';
function neutralizeDomainLineageKeys(text) {
  let out = String(text);
  for (const key of NON_CREDENTIAL_JSON_KEYS) {
    const pair = new RegExp(`"${key}"(\\s*:\\s*)(null|"${LINEAGE_VALUE_SOURCE}")`, 'g');
    out = out.replace(pair, '"<nc-lineage-key>"$1$2');
  }
  return out;
}

// 落盘前凭据门：扫将写出的产物字符串映射 { 名: 文本 }。命中 → { ok:false, hit }（fail-closed，调用方拒写）。
export function credentialGate(outputs) {
  const secrets = collectSecretLiterals();
  for (const [name, text] of Object.entries(outputs)) {
    const low = neutralizeDomainLineageKeys(String(text)).toLowerCase();
    for (const kw of FORBIDDEN_KEYWORDS) {
      if (low.includes(kw)) return { ok: false, hit: `产物 ${name} 含禁字段关键词「${kw}」` };
    }
    for (const s of secrets) {
      if (String(text).includes(s)) return { ok: false, hit: `产物 ${name} 含凭据文件敏感字面量（已隐去）` };
    }
  }
  return { ok: true };
}

// 凭据路由名源头打码（cred-route-mask，Steven 拍板 2026-07-03）：路径段命中禁字段关键词 →
// <redacted:cred-route>，其余段保留、query/hash 原样不动（query 携凭据仍由门拦，fail-closed 方向不变）。
// 门零弱化：本函数给落盘投影用（observed requestLog / axes network），credentialGate 本体一字不改。
// 真机误伤原型：发送期应用自取临时凭据的路由 /ai-manager/auths/getTempTokenForApi 字面含 token。
export function maskCredentialRoute(url) {
  const s = String(url);
  const cut = (ch) => { const i = s.indexOf(ch); return i >= 0 ? i : s.length; };
  const qi = Math.min(cut('?'), cut('#'));
  const head = s.slice(0, qi);
  const tail = s.slice(qi);
  const masked = head
    .split('/')
    .map((seg) => {
      const low = seg.toLowerCase();
      return FORBIDDEN_KEYWORDS.some((kw) => low.includes(kw.trim())) ? '<redacted:cred-route>' : seg;
    })
    .join('/');
  return masked + tail;
}

// url 剥 query/hash（G5 加固：observed requestLog[].url 落盘前必过——query 串可携 token，layer3-wiring F3 教训）。
// 支持完整 URL 与相对路径；无 query/hash 原样返回。
export function stripUrlQuery(url) {
  const s = String(url);
  const cut = (ch) => { const i = s.indexOf(ch); return i >= 0 ? i : s.length; };
  return s.slice(0, Math.min(cut('?'), cut('#')));
}
