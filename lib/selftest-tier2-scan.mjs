// lib/selftest-tier2-scan.mjs —— tier-2 凭据兜底扫描【采集层】
//   （GRILL D2 v3 扫描时序；联审 r1 H4 + M1 收口）。
// 三条纪律：
//   ① 时序：原始字节先扫（子进程输出 + 每个原始产物文件的字节，解析之前）→ 白名单投影 → 落盘前复扫；
//      阶段只在【真正跑完】才记账（记账器由本模块出，不许硬写三阶段常量冒充跑满）；
//   ② 判据复用共享凭据门（`lib/cred-gate.mjs`）：禁字段关键词 + 凭据文件真实敏感字面量，
//      外加非回环地址形态——不自造第二套敏感判据；
//   ③ 出口零回显：命中只出「阶段 + 规则码」，命中内容一律不出模块；最终渲染文本再过凭据门。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT } from './paths.mjs';
import { FORBIDDEN_KEYWORDS, collectSecretLiterals, credentialGate } from './cred-gate.mjs';
import { TIER2_SCAN_STAGES, isLoopbackBaseUrl } from './selftest-tier2.mjs';

const URL_SHAPE = /https?:\/\/[^\s"'`,)\]}]+/g;

// 凭据文件敏感字面量池：一个进程内取一次（每次重取都要读凭据文件，越少越好）。
// 唯一剔除项 = 【按来源精确认定的那一个值】：站点配置的 target.devProxyUrl（联审 r2 H4 裁读）。
//   为什么要剔除：GRILL D6 已定「隧道回环基址非敏感」（doctor 直接回显回环端口号），
//     而该值会被共享池当敏感字面量收进来——不剔除则凡产物出现回环基址就命中，每次真机跑零证据落盘。
//   为什么只能按来源剔：按「长得像回环 URL」过滤会把恰好是回环形态的【真凭据值】一起放走（r2 驳回的收法）。
//   形态再收紧：带路径/query/fragment 的一律不剔（那种形态即便回环也照扫），端口与主机必须是裸回环源。
export function bareLoopbackOrigin(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  if (u.pathname !== '/' && u.pathname !== '') return null;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(u.hostname)) return null;
  return value;
}
// 剔除面的来源必须与敏感池的来源【逐字对齐】：共享凭据门收池子读的就是这两处 site.json
//   （凭据文件里的值一律不剔）。只取 target.devProxyUrl 一个键，且只认裸回环源形态。
export function carveOutLiterals() {
  const out = new Set();
  for (const p of [join(PROJECT_ROOT, 'site.json'), join(PROJECT_ROOT, '.auth', 'site.json')]) {
    try {
      const doc = JSON.parse(readFileSync(p, 'utf8'));
      const raw = doc && doc.target && typeof doc.target.devProxyUrl === 'string' ? doc.target.devProxyUrl : null;
      const bare = raw === null ? null : bareLoopbackOrigin(raw);
      if (bare) out.add(bare);
    } catch { /* 没有就没有 */ }
  }
  return out;
}
let literalPool = null;
function secretLiterals() {
  if (literalPool === null) {
    try {
      const carve = carveOutLiterals();
      // 字符串全等剔除：其余字面量（含任何含回环子串的长值、恰为回环形态但来源不是 devProxyUrl 的凭据值）照收。
      literalPool = collectSecretLiterals().filter((s) => !carve.has(s));
    } catch { literalPool = []; }
  }
  return literalPool;
}

// 单段文本扫描：命中即返回具名规则（内容绝不带出）。
export function scanTextForSensitive(text, stage, { rule = 'nested-sensitive-value' } = {}) {
  const hits = [];
  const raw = typeof text === 'string' ? text : String(text == null ? '' : text);
  const lower = raw.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (lower.includes(kw)) { hits.push({ stage, rule }); break; }
  }
  for (const lit of secretLiterals()) {
    if (lit && raw.includes(lit)) { hits.push({ stage, rule: 'secret-literal' }); break; }
  }
  for (const found of raw.match(URL_SHAPE) || []) {
    if (!isLoopbackBaseUrl(found)) { hits.push({ stage, rule: 'target-address-shape' }); break; }
  }
  return hits;
}

// 原始产物字节扫描（H4）：解析之前先按字节过一遍——白名单投影会把嵌套敏感值丢掉，
//   若只扫投影后的结果，原始产物里的敏感值就永远看不见了。畸形 JSON 单列具名规则。
export function scanRawArtifactFile(absPath, { stage = 'raw_bytes', rule = 'nested-sensitive-value' } = {}) {
  let text;
  try { text = readFileSync(absPath, 'utf8'); }
  catch { return { read: false, hits: [], json: null }; }
  const hits = scanTextForSensitive(text, stage, { rule });
  let json = null;
  try { json = JSON.parse(text); }
  catch { hits.push({ stage, rule: 'malformed-json' }); }
  return { read: true, hits, json, byteLength: Buffer.byteLength(text, 'utf8') };
}

// 阶段记账器：`complete(stage)` 只在该阶段真跑完时调；未跑的阶段不进账，
//   于是「三阶段有序跑满」这条判据由实际执行产生，不是常量冒充。
export function createScanRecorder() {
  const hits = [];
  const stages = [];
  return {
    add(newHits) { for (const h of newHits || []) hits.push(h); return this; },
    scan(text, stage, opts) { return this.add(scanTextForSensitive(text, stage, opts)); },
    complete(stage) {
      if (!TIER2_SCAN_STAGES.includes(stage)) throw new Error(`未知扫描阶段：${stage}`);
      if (!stages.includes(stage)) stages.push(stage);
      return this;
    },
    snapshot() { return { stages: [...stages], hits: hits.map((h) => ({ ...h })) }; },
    get hitCount() { return hits.length; },
  };
}

// 出口密封（M1）：最终渲染文本过共享凭据门——【逐行】密封。
// 逐行而非整段：整段抹掉会把全部诊断一起烧掉（一个误报就等于没有输出可看），
//   逐行既保住 fail-closed（命中行一个字符都不出去），又不牵连无辜行。
const SEALED_LINE = '[本行经凭据兜底门判命中，已整行抑制（fail-closed，护栏 #7）]';
export function sealTier2Output(text, label = 'tier2-output') {
  const s = typeof text === 'string' ? text : String(text == null ? '' : text);
  const gate = (piece) => {
    try { return credentialGate({ [label]: piece }).ok === true; }
    catch { return false; }
  };
  if (gate(s)) return { ok: true, text: s, sealedLines: 0 };
  let sealedLines = 0;
  const out = s.split('\n').map((line) => {
    if (!line.trim() || gate(line)) return line;
    sealedLines += 1;
    return SEALED_LINE;
  });
  return { ok: false, text: out.join('\n'), sealedLines };
}
