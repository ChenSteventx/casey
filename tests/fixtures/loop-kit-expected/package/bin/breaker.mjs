#!/usr/bin/env node
// Circuit Breaker（熔断器）—— 护栏 #3 的执行者。loop 每轮迭代结束时调用一次。
// 判定（任一越限即熔断）：迭代上限 / 连续零 commit / 同错重复 / 总时长。
// 熔断动作：写 Inbox（升级路径）+ exit 2。状态存 loop/.breaker-state.json（gitignored）。
//
// 用法：
//   node loop-kit/bin/breaker.mjs --reset                 loop 开始时清零
//   node loop-kit/bin/breaker.mjs --round [--error "..."]  每轮结束时记账（gate 红时把错误摘要传入）
// 退出码：0 继续；2 熔断（调用方必须停止循环）。

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRoot } from '../lib/root.mjs';

const ROOT = resolveRoot();
const STATE_PATH = join(ROOT, 'loop', '.breaker-state.json');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'loop', 'config.json'), 'utf8'));
const CB = CONFIG.circuitBreaker;
const INBOX = join(ROOT, CONFIG.escalation.inbox);

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: 'pipe' }).toString().trim();
  } catch {
    return '(no-git)';
  }
}

function trip(state, reason) {
  const entry = `\n## ${new Date().toISOString()} 熔断\n- 原因：${reason}\n- 迭代：${state.iterations}；零commit连击：${state.zeroCommitStreak}；同错连击：${state.sameErrorStreak}\n- 处置：loop 已停。人工查看后 --reset 再续。\n`;
  appendFileSync(INBOX, entry, 'utf8');
  console.error(`breaker: 熔断 —— ${reason}（已写 ${CONFIG.escalation.inbox}）`);
  process.exit(2);
}

const args = process.argv.slice(2);

if (args[0] === '--reset') {
  writeFileSync(STATE_PATH, JSON.stringify({
    startedAt: new Date().toISOString(),
    iterations: 0,
    lastHead: gitHead(),
    zeroCommitStreak: 0,
    lastErrorHash: '',
    sameErrorStreak: 0,
  }, null, 2), 'utf8');
  console.log('breaker: 已清零');
  process.exit(0);
}

if (args[0] !== '--round') {
  console.error('用法: breaker.mjs --reset | --round [--error "<错误摘要>"]');
  process.exit(64);
}

if (!existsSync(STATE_PATH)) {
  console.error('breaker: 无状态文件——loop 开始时先 --reset');
  process.exit(64);
}
const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));

state.iterations += 1;

const head = gitHead();
if (head === state.lastHead) state.zeroCommitStreak += 1;
else { state.zeroCommitStreak = 0; state.lastHead = head; }

const errIdx = args.indexOf('--error');
const errText = errIdx >= 0 ? (args[errIdx + 1] ?? '') : '';
if (errText) {
  const h = createHash('sha256').update(errText).digest('hex');
  if (h === state.lastErrorHash) state.sameErrorStreak += 1;
  else { state.sameErrorStreak = 1; state.lastErrorHash = h; }
} else {
  state.sameErrorStreak = 0;
  state.lastErrorHash = '';
}

const hours = (Date.now() - Date.parse(state.startedAt)) / 3.6e6;

writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');

if (state.iterations >= CB.maxIterations) trip(state, `迭代数达上限 ${CB.maxIterations}`);
if (state.zeroCommitStreak >= CB.zeroCommitRounds) trip(state, `连续 ${state.zeroCommitStreak} 轮零 commit（空转）`);
if (state.sameErrorStreak >= CB.sameErrorRounds) trip(state, `同一错误连续 ${state.sameErrorStreak} 轮（卡死）`);
if (hours >= CB.maxHours) trip(state, `运行时长达上限 ${CB.maxHours}h`);

console.log(`breaker: 继续（迭代 ${state.iterations}/${CB.maxIterations}，零commit ${state.zeroCommitStreak}/${CB.zeroCommitRounds}，同错 ${state.sameErrorStreak}/${CB.sameErrorRounds}，${hours.toFixed(1)}h/${CB.maxHours}h）`);
process.exit(0);
