#!/usr/bin/env node
// P6 heal 验收金牌 A0（plan §3 验收表 A0 / GRILL D10「热路径先证」）。
//
// A0 是**两分支**验收，不是单分支：S0 要么证出「词表原子回放 miss → 探针跑出正向证据 →
// axes 落 driftProbe → verdict 判 HARNESS_ERROR」在现役生产接线上真可达，要么诚实出具
// 证据文档、把热路径缺口挂账给后继契约。两分支各有明确产物，绝不虚标可用。
//
// 通过条件（二选一，任一成立即绿）：
//   分支①「可达」：存在可达性证明金牌且其全部绿（退出码 0）——判绿只信退出码，不 grep 标记串。
//   分支②「不可达并挂账」：docs/plans/p6-heal/hotpath-evidence.md 存在，且含「结论」「证据」两节。
// 两者皆无 → 红（S0 既没证也没挂账 = 热路径悬空）。
//
// accept 相冻结的命名约定（plan/GRILL 未逐字给出，本金牌在此冻结，实现须迎合）：
//   分支①的可达性证明金牌文件名形如 tests/_golden/p6-heal-hotpath-<name>.golden.mjs
//   （本 A0 金牌自身 p6-heal-hotpath-evidence.* 除外，避免自证循环）。
//
// 零 SUT：本金牌只读文件系统 + spawn 同仓金牌子进程；零浏览器、零网络、零凭据。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SELF = 'p6-heal-hotpath-evidence.zero-sut.golden.mjs';
const EVIDENCE_DOC = join(ROOT, 'docs', 'plans', 'p6-heal', 'hotpath-evidence.md');
const PROOF_PATTERN = /^p6-heal-hotpath-.*\.golden\.mjs$/;

const notes = [];

// ── 分支①：可达性证明金牌绿证据 ─────────────────────────────────────────────
function reachabilityProofGreen() {
  let files = [];
  try {
    files = readdirSync(HERE).filter((f) => PROOF_PATTERN.test(f) && f !== SELF).sort();
  } catch { files = []; }
  if (files.length === 0) {
    notes.push('分支①不成立：未找到 tests/_golden/p6-heal-hotpath-*.golden.mjs 可达性证明金牌');
    return false;
  }
  for (const f of files) {
    const r = spawnSync(process.execPath, [join(HERE, f)], { cwd: ROOT, encoding: 'utf8' });
    const code = r.status ?? 1;
    if (code !== 0) {
      notes.push(`分支①不成立：可达性证明金牌 ${f} 非绿（exit=${code}）`);
      return false;
    }
    notes.push(`分支①证据：${f} exit=0`);
  }
  return true;
}

// ── 分支②：不可达挂账文档 ───────────────────────────────────────────────────
function evidenceDocComplete() {
  if (!existsSync(EVIDENCE_DOC)) {
    notes.push('分支②不成立：docs/plans/p6-heal/hotpath-evidence.md 不存在');
    return false;
  }
  const text = readFileSync(EVIDENCE_DOC, 'utf8');
  // 「两节」= 两个 markdown 标题行，节标题分别含「结论」与「证据」；正文里顺口提一句不算一节。
  const headings = text.split('\n').filter((l) => /^#{1,6}\s/.test(l));
  const hasConclusion = headings.some((h) => h.includes('结论'));
  const hasEvidence = headings.some((h) => h.includes('证据'));
  if (!hasConclusion) notes.push('分支②不成立：hotpath-evidence.md 缺「结论」节标题');
  if (!hasEvidence) notes.push('分支②不成立：hotpath-evidence.md 缺「证据」节标题');
  if (hasConclusion && hasEvidence) notes.push('分支②证据：hotpath-evidence.md 含「结论」「证据」两节');
  return hasConclusion && hasEvidence;
}

const branchA = reachabilityProofGreen();
const branchB = branchA ? false : evidenceDocComplete();

for (const n of notes) console.log(`info ${n}`);

if (!branchA && !branchB) {
  console.error('FAIL A0 热路径可达性：两分支皆不成立——既无可达性证明金牌绿证据，也无含「结论」「证据」两节的 hotpath-evidence.md');
  console.error('RED  p6-heal-hotpath-evidence: A0 未过（实现前预期红）');
  process.exit(1);
}

console.log(`ok   A0 热路径两分支满足其一（${branchA ? '分支①可达性证明金牌绿' : '分支②挂账证据文档齐备'}）`);
console.log('ok   p6-heal-hotpath-evidence: 1 项全过');
process.exit(0);
