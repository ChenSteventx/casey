#!/usr/bin/env node
// loop-kit/bin/contract.mjs — Loop Contract 阶段台账：接力棒 + 前置互锁的事实源 + 唯一写入口。
// 纯函数确定性可测；CLI（init/advance/check/show）做 fs 校验 + 读写 loop/active-contract.json（runtime，gitignored）。
// 台账 done 只能经 advance 翻、且翻前校验交付物（照 gate.mjs 独占 passes 先例）——人和实现者只读。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAGES = ['grill', 'plan', 'accept', 'loop', 'review', 'learn'];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ACTIVE = () => process.env.LOOP_CONTRACT_FILE || join(ROOT, 'loop', 'active-contract.json');

// 仓库相对路径锚定（评审 #5 修 overmatch）：只认顶层 lib/bin/web 与 kit 的 loop-kit/bin·loop-kit/lib；
// docs/lib、vendor/bin、仓库外绝对路径都不算实现。
// 大小写不敏感文件系统（Windows/macOS）上 LIB===lib：归一时折叠大小写，否则 IMPL/PRD（小写）会漏判 LIB/Loop-Kit（评审round11）。
const CI_FS = process.platform === 'win32' || process.platform === 'darwin';
const norm = (p) => { const s = String(p || '').replace(/\\/g, '/').replace(/^\.\//, ''); return CI_FS ? s.toLowerCase() : s; };
const IMPL = /^(?:lib|bin|web)(?:\/|$)|^loop-kit\/(?:bin|lib)(?:\/|$)/;
const PRD = /^loop\/prd-[^/]*\.json$/;
export function touchesImpl(paths) { return (paths || []).some((p) => IMPL.test(norm(p))); }

export function initContract({ slug, lane, reason }) {
  if (!slug) throw new Error('init 需 slug');
  if (!['direct', 'light', 'full'].includes(lane)) throw new Error('lane 须为 direct|light|full');
  if (!reason || !String(reason).trim()) throw new Error('init 需非空 --reason（地板：contract 存在 + 一句理由，评审 #6）');
  const stages = {};
  for (const s of STAGES) stages[s] = { done: false };
  return { slug, lane, laneReason: String(reason).trim(), stages };
}

// 前置互锁：阶段 X 只在前一阶段 done 时可进。
export function canAdvance(contract, stage) {
  const i = STAGES.indexOf(stage);
  if (i < 0) return { ok: false, missing: 'unknown' };
  if (i === 0) return { ok: true };
  const prev = STAGES[i - 1];
  return contract?.stages?.[prev]?.done ? { ok: true } : { ok: false, missing: prev };
}

export function advanceStage(contract, stage, opts = {}) {
  if (!STAGES.includes(stage)) throw new Error(`未知阶段 ${stage}`);
  const pre = canAdvance(contract, stage);
  if (!pre.ok) throw new Error(`阶段 ${stage} 前置缺失：${pre.missing}（缺上一阶段交付物，不能进下一轮）`);
  if (!opts.artifactValid) throw new Error(`阶段 ${stage} 交付物无效/缺失`);
  if (stage === 'grill' && !opts.userConfirmed) throw new Error('grill 阶段需用户确认（半硬：机器验不了真被 grill 过）');
  if (stage === 'accept' && !opts.redVerified) throw new Error('accept 阶段需红基线已验证（--red-verified；半硬，评审 #3）');
  contract.stages[stage] = { done: true };
  if (opts.artifact) contract.stages[stage].artifact = opts.artifact;
  return contract;
}

// 传递链（评审 #4）：到 stage（含）为止全部 done，才算「过到这一阶段」——防被篡改的孤立 done 标志放行。
export function doneThrough(contract, stage) {
  const i = STAGES.indexOf(stage);
  if (i < 0) return false;
  for (let k = 0; k <= i; k++) if (!contract?.stages?.[STAGES[k]]?.done) return false;
  return true;
}

// 判定矩阵：lane=direct 只剩地板（全放行）；light 加 plan 门；full 全链；均按传递链判。
// push（落地/触达）需 review.done——让阶段4 异构评审真正有牙（评审#新-MEDIUM：此前 review/learn 无任何动作要求）。
export function checkAction(contract, action) {
  const lane = contract?.lane || 'full';
  if (lane === 'direct') return { allow: true };
  const need = {
    'write-prd': 'plan',
    'edit-impl': lane === 'light' ? 'plan' : 'accept',
    'commit-impl': lane === 'light' ? 'plan' : 'loop',
    'push': lane === 'light' ? 'loop' : 'review',
  }[action];
  if (!need) return { allow: true };
  return doneThrough(contract, need) ? { allow: true } : { allow: false, missing: need };
}

// shell 分词（尊重 '...' / "..." 引号 + 分隔符）——比正则更稳地识别 git 子命令（评审 round7：含引号空格的全局选项值）。
function shellTokens(command) {
  const toks = []; let cur = ''; let q = null; let has = false; let esc = false;
  for (const ch of String(command || '')) {
    if (esc) { cur += ch; has = true; esc = false; continue; }      // 反斜杠转义下一字符（评审 round8：A\ B 不再被拆开）
    if (q === "'") { if (ch === "'") q = null; else cur += ch; has = true; continue; } // 单引号内无转义
    if (ch === '\\' && q === null) { esc = true; has = true; continue; } // 引号外反斜杠转义
    if (q === '"') { if (ch === '"') q = null; else cur += ch; has = true; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch)) { if (has) { toks.push(cur); cur = ''; has = false; } continue; }
    if (ch === ';' || ch === '|' || ch === '&') { if (has) { toks.push(cur); cur = ''; has = false; } toks.push(ch); continue; }
    cur += ch; has = true;
  }
  if (has) toks.push(cur);
  return toks;
}
const GLOBAL_OPT_WITH_ARG = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
// git 子命令识别：跳过全局选项（含独立值）后看第一个子命令 token。var-alias/eval/$IFS 等 shell 元编程为文档化残留（plan §2.1#5）。
export function gitSub(command) {
  const toks = shellTokens(command);
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] !== 'git') continue;
    let j = i + 1;
    while (j < toks.length) {
      const t = toks[j];
      if (t === ';' || t === '|' || t === '&') break;
      if (t.startsWith('-')) { j += (!t.includes('=') && GLOBAL_OPT_WITH_ARG.has(t)) ? 2 : 1; continue; }
      if (t === 'commit') return 'commit';
      if (t === 'push') return 'push';
      break;
    }
  }
  return null;
}
// 写能力指示（评审 #1 + 再评审）：重定向 / 原地编辑器（sed/perl -i 任意位置）/ 文件搬运删建 / 解释器内联写。
// 注：静态分类任意 Bash 写不可判定（停机问题级）；此为尽力覆盖常见模式，exotic 写为文档化残留（plan §2.1）。
const WRITE_CAP = /(>>?|>\||\btee\b|\bsed\b[^|;&]*\s-[a-zA-Z]*i|\bperl\b[^|;&]*\s-[a-zA-Z]*i|\b(?:cp|mv|dd|install|rsync|truncate|rm|rmdir|touch|mkdir|ln|chmod|chown)\b|\bnode\s+-[ep]\b|\b(?:python3?|ruby|perl)\s+-[ec]\b)/;
const IMPL_TOK = /(^|[\s'"=>(:])(?:\.\/)?(?:lib|bin|web|loop-kit\/(?:bin|lib))(?=[/\s'"|&;()<>]|$)/; // 边界 lookahead 含全部 shell 词终止符：认裸目录 rm -rf lib / lib;true，又不误命中 library/binary（评审round9/10）
const PRD_TOK = /(^|[\s'"=>(:])(?:\.\/)?loop\/prd-[^\s'"]*\.json/;

// Bash 命令 → 受守卫动作。读类（cat/grep/node --check）不命中 WRITE_CAP → 放行。
export function bashAction(command) {
  const c = CI_FS ? String(command || '').toLowerCase() : String(command || ''); // 同 norm：CI 文件系统折叠大小写
  const g = gitSub(c);
  if (g) return g; // 'commit' | 'push'
  if (!WRITE_CAP.test(c)) return null;
  if (PRD_TOK.test(c)) return 'write-prd';
  if (IMPL_TOK.test(c)) return 'edit-impl';
  return null;
}

// 归一 pathspec：去 git magic 前缀 :(top)/:/ /:! 与引号、前导 ./——仅供 git 不可用时的 fallback 分类。
// 正常路径：原样 pathspec 交给 git diff 自己展开（git 才是 pathspec magic 的权威，含 :!排除/:(glob) 等）。
export const stripPathspec = (t) => t.replace(/^['"]|['"]$/g, '').replace(/^:\([^)]*\)/, '').replace(/^:[/!]+/, '').replace(/^\/+/, '').replace(/^\.\//, '');

// 解析 git commit 的 -a/--all 与 pathspec（评审 #2 + 再评审：magic pathspec / --pathspec-from-file 不再绕过）。
export function commitArgs(command) {
  const c = String(command || '');
  const m = c.search(/\bcommit\b/);
  const after = m < 0 ? '' : c.slice(m + 'commit'.length).trim();
  const toks = after.length ? after.split(/\s+/).filter(Boolean) : [];
  const pathspecs = []; let all = false; let sepSeen = false; let fromFile = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--') { sepSeen = true; continue; }
    if (!sepSeen && /^--pathspec-from-file(=|$)/.test(t)) { fromFile = true; if (t === '--pathspec-from-file') i++; continue; }
    if (!sepSeen && (t === '--all' || /^-[a-z]*a[a-z]*$/.test(t))) { all = true; continue; }
    if (!sepSeen && ['-m', '--message', '-F', '--file', '-c', '--author', '--date', '-C', '--reuse-message'].includes(t)) { i++; continue; }
    if (!sepSeen && t.startsWith('-')) continue;
    pathspecs.push(t.replace(/^['"]|['"]$/g, '')); // 原样保留 magic（交 git 展开）；仅去引号
  }
  return { all, pathspecs, fromFile };
}

export function actionFromTool(toolName, toolInput = {}) {
  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
    const fp = norm(toolInput.file_path);
    if (PRD.test(fp)) return { kind: 'write-prd' };
    if (IMPL.test(fp)) return { kind: 'edit-impl' };
    return { kind: null };
  }
  if (toolName === 'Bash') return { kind: bashAction(toolInput.command) };
  return { kind: null };
}

// ---- CLI ----
function load() { const f = ACTIVE(); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; }
function save(c) { const f = ACTIVE(); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(c, null, 2) + '\n'); }

function artifactValidFor(stage, artifact, slug) {
  const abs = artifact ? resolve(ROOT, artifact) : null;
  const rrel = abs ? norm(relative(ROOT, abs)) : ''; // 仓库根相对（再评审 HIGH：绑规范路径、拒仓库外）
  const txt = abs && existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (rrel.startsWith('..')) return false;
  if (stage === 'grill') return !!txt && txt.trim().length > 0;
  // 交付物绑【仓库根相对规范路径】：plan = docs/plans/<x>/plan.md；accept = loop/prd-<slug>.json（精确，非 substring/basename）。
  if (stage === 'plan') return !!txt && /验收/.test(txt) && rrel === `docs/plans/${slug}/plan.md`; // 绑 slug（评审round12）：plan 目录须 = slug

  if (stage === 'accept') {
    if (rrel !== `loop/prd-${slug}.json`) return false;
    try { const j = JSON.parse(txt); return !!j.testChecksums && Object.keys(j.testChecksums).length > 0; } catch { return false; }
  }
  if (stage === 'loop') { // 同 accept：绑 loop/prd-<slug>.json，passes===true 即 gate 写入的绿证据（gate 独占 passes）
    if (rrel !== `loop/prd-${slug}.json`) return false;
    try { const j = JSON.parse(txt); return Array.isArray(j.stories) && j.stories.length > 0 && j.stories.every((s) => s.passes === true); } catch { return false; }
  }
  if (stage === 'review') { // 评审round13：解析 JSONL、精确 slug 字段（substring 会把 x2/prefix-x 误判为 x）
    const a = join(ROOT, 'loop', 'audit.jsonl');
    if (!existsSync(a)) return false;
    return readFileSync(a, 'utf8').split('\n').filter(Boolean).some((l) => {
      try { const j = JSON.parse(l); return j && j.slug === slug && /review/i.test(j.kind || '') && /pass/i.test(String(j.verdict || j.result || '')); } catch { return false; }
    });
  }
  if (stage === 'learn') return true;
  return false;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = {}; const pos = [];
  for (let i = 0; i < rest.length; i++) { const a = rest[i]; if (a.startsWith('--')) { const k = a.slice(2); if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) opts[k] = rest[++i]; else opts[k] = true; } else pos.push(a); }
  if (cmd === 'init') {
    let c; try { c = initContract({ slug: pos[0] || opts.slug, lane: opts.lane, reason: opts.reason }); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
    save(c); console.log(`✓ Loop Contract 建立：${c.slug}（lane=${c.lane}）→ ${ACTIVE()}`); return;
  }
  if (cmd === 'advance') {
    const c = load(); if (!c) { console.error('无活动 contract，先 contract init'); process.exit(1); }
    const stage = pos[0];
    const av = artifactValidFor(stage, opts.artifact, c.slug);
    try { advanceStage(c, stage, { artifactValid: av, userConfirmed: opts['user-confirmed'] === true, redVerified: opts['red-verified'] === true, artifact: opts.artifact }); }
    catch (e) { console.error('✗ ' + e.message); process.exit(1); }
    save(c); console.log(`✓ 阶段推进：${stage} done（lane=${c.lane}）`); return;
  }
  if (cmd === 'check') {
    const c = load(); const action = pos[0];
    if (!c) { console.log(JSON.stringify({ allow: false, missing: 'contract' })); process.exit(2); }
    const d = checkAction(c, action); console.log(JSON.stringify(d)); process.exit(d.allow ? 0 : 2);
  }
  if (cmd === 'show') { console.log(JSON.stringify(load(), null, 2)); return; }
  console.error('用法: contract <init|advance|check|show> [slug] [--lane ..] [--reason ..] [--artifact ..] [--user-confirmed] [--red-verified]'); process.exit(2);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
