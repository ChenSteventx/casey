#!/usr/bin/env node
// teachin-cycle 薄别名的参数序结构门：零 browser、零 SUT、零 network。
//
// 钉两件事：
// 1) 别名把 --login-bootstrap 追加在透传参数之后，caseId 保持首位进 record 的位置参数；
// 2) record 的通用解析器行为不变——旧的前插顺序仍然吞掉 caseId。
// 两条一起成立，才能保证「未来有人去改解析器」不会悄悄把别名的修复退回去。
//
// 本门只跑参数校验路径：record 在 `缺 --sut` 处即退，永不到达浏览器启动点。

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-cycle-alias-args';
const CYCLE_ENTRY = resolve(ROOT, 'bin/teachin-cycle.mjs');
const RECORD_ENTRY = resolve(ROOT, 'bin/record.mjs');
// 纯探针 caseId：只用于走参数校验分支，不落任何产物、不指向任何真实用例。
const PROBE_CASE_ID = 'tc_fake_alias_probe';

const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function source(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) throw new Error(`缺文件 ${rel}`);
  return readFileSync(file, 'utf8');
}

// 只 spawn 真实二进制取退出码与 stderr——纯函数模拟会给假绿。
function runEntry(entry, argv) {
  const result = spawnSync(process.execPath, [entry, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1_048_576,
  });
  assert(!result.error, `spawn 失败：${String(result.error?.message || result.error)}`);
  assert(result.signal === null, `子进程被信号终止：${result.signal}`);
  return {
    status: result.status,
    stderr: String(result.stderr || ''),
    stdout: String(result.stdout || ''),
  };
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

check('A1 别名只给 caseId 时，caseId 进位置参数、报缺 --sut 而非缺 caseId', () => {
  const run = runEntry(CYCLE_ENTRY, [PROBE_CASE_ID]);
  const seen = `${run.stderr}\n${run.stdout}`;
  assert(!/缺 caseId/.test(seen),
    `caseId 被 --login-bootstrap 吞成旗标值（参数序回退）：${seen.slice(0, 400)}`);
  assert(/缺 --sut/.test(seen),
    `未走到 --sut 校验，别名透传异常：exit=${run.status} ${seen.slice(0, 400)}`);
  assert(run.status === 64, `用法错须为退出码 64，实得 ${run.status}`);
});

check('A2 record 解析器行为不变：旧的前插顺序仍然吞掉 caseId', () => {
  const run = runEntry(RECORD_ENTRY, ['--login-bootstrap', PROBE_CASE_ID]);
  const seen = `${run.stderr}\n${run.stdout}`;
  assert(/缺 caseId/.test(seen),
    `record 解析器被改动：旧错误顺序不再吞 caseId，别名修复的前提失效：${seen.slice(0, 400)}`);
  assert(run.status === 64, `用法错须为退出码 64，实得 ${run.status}`);
});

check('A3 别名源码把 --login-bootstrap 排在透传参数之后', () => {
  const text = source('bin/teachin-cycle.mjs');
  assert(/\[\s*RECORD_ENTRY\s*,\s*\.\.\.rest\s*,\s*['"]--login-bootstrap['"]\s*,?\s*\]/.test(text),
    '别名 argv 必须是 [RECORD_ENTRY, ...rest, \'--login-bootstrap\']');
  assert(!/\[\s*RECORD_ENTRY\s*,\s*['"]--login-bootstrap['"]\s*,\s*\.\.\.rest/.test(text),
    '禁止把 --login-bootstrap 前插到透传参数之首');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
