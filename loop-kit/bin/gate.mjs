#!/usr/bin/env node
// Quality Gate（质量门禁）—— loop 每轮迭代的确定性裁判。护栏 #1 #2 #4 的执行者。
// 默认 FAIL，凭证据翻绿；passes 字段只由本脚本写入，任何模型无权直接改。
//
// 检查序（任一红即整体红）：
//   1. Test Ratchet：prd.json.testChecksums 的文件 sha256 校验——验收测试被改动=红
//   2. term-lint：术语表完整性 + 契约文档术语违例
//   3. 可执行规格：逐 story 逐条跑 acceptance 命令，全部 exit 0 才算该 story 过
//
// 用法：node loop-kit/bin/gate.mjs [--prd <path>] [--story <id>] [--dry]
// 退出码：0 全绿；1 有红；64 用法/契约缺失。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRegistry, lintFiles } from './term-lint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = join(ROOT, 'loop', 'config.json');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function loadJson(path, what) {
  if (!existsSync(path)) {
    console.error(`gate: 缺 ${what}（${path}）。契约在循环之前——先走 acceptance-gate 工序。`);
    process.exit(64);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const args = process.argv.slice(2);
const onlyStory = args.includes('--story') ? args[args.indexOf('--story') + 1] : null;
const dry = args.includes('--dry');

const config = loadJson(CONFIG_PATH, 'loop/config.json');
// --prd <path> 让门禁对指定契约跑（如需求3 的 loop/prd-req3.json），不改 config、不与需求2 主 prd 混用。
const prdArg = args.includes('--prd') ? args[args.indexOf('--prd') + 1] : null;
const prdPath = prdArg ? resolve(ROOT, prdArg) : join(ROOT, config.qualityGate.prd);
const prd = loadJson(prdPath, '任务契约 prd.json');
const timeoutMs = config.qualityGate.commandTimeoutMs ?? 300000;

let red = false;
const report = [];

// ── 1. Test Ratchet ──────────────────────────────────────────
const checksums = prd.testChecksums ?? {};
for (const [file, expected] of Object.entries(checksums)) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) {
    red = true;
    report.push(`RED   ratchet  ${file} 被删除——验收测试冻结期内不可消失`);
    continue;
  }
  const actual = sha256(abs);
  if (actual !== expected) {
    red = true;
    report.push(`RED   ratchet  ${file} 被改动（checksum 不符）——护栏#1：验收测试冻结`);
  } else {
    report.push(`ok    ratchet  ${file}`);
  }
}

// ── 2. term-lint ─────────────────────────────────────────────
if (config.qualityGate.termLint) {
  const registry = parseRegistry();
  const targets = [join(ROOT, 'loop', 'GUARDRAILS.md')];
  if (prd.specPath && existsSync(join(ROOT, prd.specPath))) targets.push(join(ROOT, prd.specPath));
  const { errors } = lintFiles(targets, { registry });
  errors.push(...registry.registryErrors.map((e) => `CONTEXT.md:${e.line}  ${e.msg}`));
  if (errors.length) {
    red = true;
    errors.forEach((e) => report.push(`RED   term     ${e}`));
  } else {
    report.push(`ok    term     术语检查通过`);
  }
}

// ── 3. 可执行规格 ─────────────────────────────────────────────
const stories = prd.stories.filter((s) => !onlyStory || s.id === onlyStory);
if (onlyStory && stories.length === 0) {
  console.error(`gate: 契约里没有 story「${onlyStory}」`);
  process.exit(64);
}
for (const story of stories) {
  let storyGreen = true;
  for (const cmd of story.acceptance) {
    if (dry) {
      report.push(`dry   ${story.id}  ${cmd}`);
      continue;
    }
    try {
      execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: timeoutMs, shell: true });
      report.push(`ok    ${story.id}  ${cmd}`);
    } catch (err) {
      storyGreen = false;
      red = true;
      const out = [err.stdout, err.stderr].filter(Boolean).map(String).join('\n').trim().slice(-800);
      report.push(`RED   ${story.id}  ${cmd}\n${out.split('\n').map((l) => `        | ${l}`).join('\n')}`);
    }
  }
  if (!dry) {
    const was = story.passes;
    story.passes = storyGreen && story.passes !== undefined ? storyGreen : storyGreen;
    story.evidence = storyGreen
      ? `gate@${new Date().toISOString()} 全部 acceptance exit 0`
      : '';
    if (was !== story.passes) report.push(`flip  ${story.id}  passes: ${was} → ${story.passes}（由 gate 写入）`);
  }
}

// passes 回写（确定性裁判是唯一写入者）
if (!dry) writeFileSync(prdPath, JSON.stringify(prd, null, 2) + '\n', 'utf8');

console.log(report.join('\n'));
const total = prd.stories.length;
const green = prd.stories.filter((s) => s.passes).length;
console.log(`\ngate: ${red ? 'RED' : 'GREEN'} —— story ${green}/${total} 过${onlyStory ? `（本次只跑 ${onlyStory}）` : ''}`);
process.exit(red ? 1 : 0);
