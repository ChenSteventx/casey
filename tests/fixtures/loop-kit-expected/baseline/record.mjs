#!/usr/bin/env node
// record.mjs —— 切换前观测基线的共享驱动（plan.md D7 C2、GRILL D4/D5 R2-H4）。
// 被两处复用：① 本次录制（一次性，冻结 raw/ + normalized/）；② C2 金牌的实时复跑（post-switch，
// 用现树 loop-kit/ 内容重跑同一命令矩阵，与冻结 normalized/ 比对）。两处必须共用同一驱动逻辑，
// 否则「录制协议」与「复跑协议」各自漂移即失去比对意义。
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixture');
export const COMMANDS_PATH = join(HERE, 'commands.json');

export function loadCommands() {
  return JSON.parse(readFileSync(COMMANDS_PATH, 'utf8'));
}

// 建隔离测试树：mkdtemp + 递归拷贝夹具 + 把「当前 loop-kit 源」（bin/ 及可能的 lib/、kit-lock.json）
// 铺进 <tree>/loop-kit/——保证「脚本自身位置=树根」的锚定语义在隔离树内继续成立（切换前/后均然）。
export function buildIsolatedTree(loopKitSourceDir, { baseDir = tmpdir() } = {}) {
  const tree = mkdtempSync(join(baseDir, 'loop-kit-baseline-'));
  cpSync(FIXTURE_DIR, tree, { recursive: true });
  mkdirSync(join(tree, 'loop-kit'), { recursive: true });
  cpSync(loopKitSourceDir, join(tree, 'loop-kit'), { recursive: true });
  return tree;
}

export function destroyIsolatedTree(tree) {
  try { rmSync(tree, { recursive: true, force: true }); } catch { /* ignore */ }
}

function applyResets(tree, resets) {
  for (const r of resets || []) {
    if (r.op === 'rm') {
      try { unlinkSync(join(tree, r.path)); } catch { /* 不存在即忽略——重置是幂等的 */ }
    }
  }
}

function substitutePlaceholders(text, tree) {
  if (typeof text !== 'string') return text;
  return text.split('{{TREE_ROOT}}').join(tree);
}

// 全清单快照：hashes 覆盖树内全部文件（含 loop-kit/，捕捉 boot 在树内任何位置的意外副作用）；
// contents 只收 loop-kit/ 之外的文件全文（loop-kit/ 引擎件不预期自变，全文快照对空间无意义）。
export function snapshotTree(tree) {
  const hashes = {};
  const contents = {};
  function walk(cur, relPrefix) {
    for (const ent of readdirSync(cur, { withFileTypes: true })) {
      if (ent.name === '.git') continue;
      const abs = join(cur, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(abs, rel); continue; }
      if (!ent.isFile()) continue;
      const buf = readFileSync(abs);
      hashes[rel] = createHash('sha256').update(buf).digest('hex');
      if (!rel.startsWith('loop-kit/')) contents[rel] = buf.toString('utf8');
    }
  }
  walk(tree, '');
  return { hashes, contents };
}

// 单案执行：cwd 固定树根；env 只含 PATH + case.env（值相对树根解析为绝对路径）+ 调用方额外覆盖
// （如 LOOP_KIT_PKG，供 C2 转发证明/后续复跑注入）；stdin 支持 {{TREE_ROOT}} 占位替换。
export function runCase(tree, caseDef, { extraEnv = {} } = {}) {
  applyResets(tree, caseDef.reset);
  const script = join(tree, 'loop-kit', 'bin', caseDef.script);
  const args = caseDef.args || [];
  const env = { PATH: process.env.PATH };
  for (const [k, v] of Object.entries(caseDef.env || {})) {
    env[k] = resolve(tree, v);
  }
  Object.assign(env, extraEnv);
  const input = caseDef.stdin !== undefined ? substitutePlaceholders(caseDef.stdin, tree) : undefined;
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: tree,
    env,
    input,
    encoding: 'utf8',
  });
  const snapshot = snapshotTree(tree);
  return {
    caseId: caseDef.id,
    exitCode: r.status,
    signal: r.signal,
    error: r.error ? String(r.error.message) : null,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    tree: snapshot,
  };
}

export function runAllCases(tree, cases, opts = {}) {
  const out = [];
  for (const c of cases) out.push(runCase(tree, c, opts));
  return out;
}
