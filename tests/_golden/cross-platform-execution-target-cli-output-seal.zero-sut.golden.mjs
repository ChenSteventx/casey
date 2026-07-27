#!/usr/bin/env node
// CLI execution-target 失败输出封口：内存 stdout/stderr sink；零 SUT、零 browser、零 network。

const TAG = 'cross-platform-execution-target-cli-output-seal';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

let emitCompileCliFailure;
let emitExecutionTargetCliFailure;
let isExecutionTargetCliFailure;
try {
  ({
    emitCompileCliFailure,
    emitExecutionTargetCliFailure,
    isExecutionTargetCliFailure,
  } = await import('../../lib/execution-target/cli-boundary.mjs'));
} catch (error) {
  console.error(`RED  ${TAG}: 缺共享 CLI 输出封口：${String(error?.code || error?.message || error).slice(-200)}`);
  process.exit(1);
}
assert(typeof emitExecutionTargetCliFailure === 'function',
  'cli-boundary.mjs 必须导出 emitExecutionTargetCliFailure');
assert(typeof emitCompileCliFailure === 'function'
  && typeof isExecutionTargetCliFailure === 'function',
'cli-boundary.mjs 必须导出 compile 分类封口');

const SENTINELS = [
  'https://logical-output.invalid:9443/private/path?token=QUERY_SENTINEL#FRAGMENT_SENTINEL',
  'http://127.0.0.1:15519/transport',
  'https://redirect-output.invalid:7443/login?token=REDIRECT_QUERY#REDIRECT_FRAGMENT',
];
const FRAGMENTS = [
  'logical-output',
  'redirect-output',
  '127.0.0.1',
  '9443',
  '7443',
  '15519',
  '/private/path',
  '/transport',
  'QUERY_SENTINEL',
  'REDIRECT_QUERY',
  'FRAGMENT_SENTINEL',
  'REDIRECT_FRAGMENT',
  '://',
];

function memorySink() {
  let value = '';
  return {
    write(chunk) {
      value += String(chunk);
    },
    text() {
      return value;
    },
  };
}

await check('R11 record/replay/compile 的 URL-bearing 异常只能输出稳定原因码', () => {
  for (const command of ['record', 'replay', 'compile']) {
    for (const reason of [
      'BROWSER_LAUNCH_FAILED',
      'NAVIGATION_FAILED',
      'NAVIGATION_ORIGIN_MISMATCH',
    ]) {
      const stdout = memorySink();
      const stderr = memorySink();
      const error = new Error(`${reason}: ${SENTINELS.join(' ')}`);
      error.code = reason;
      const exitCode = emitExecutionTargetCliFailure({
        command,
        failure: error,
        stdout,
        stderr,
      });
      const output = `${stdout.text()}\n${stderr.text()}`;
      assert(Number.isInteger(exitCode) && exitCode !== 0,
        `${command}/${reason} 必须返回确定性非零退出码`);
      assert(output.includes(reason), `${command}/${reason} 输出必须含稳定 reason`);
      for (const part of FRAGMENTS) {
        assert(!output.includes(part), `${command}/${reason} 输出泄漏片段 ${part}`);
      }
    }
  }
});

await check('R12 compile 普通异常与 execution-target 闭集错误分流且都不泄漏', () => {
  const ordinary = new Error(`ENOTDIR ${SENTINELS.join(' ')}`);
  assert(isExecutionTargetCliFailure(ordinary) === false,
    '普通 compile 异常不得冒充 execution-target 错误');
  for (const [phase, expected] of [
    ['main', 'compile 失败\n'],
    ['execute', 'compile: 执行失败\n'],
  ]) {
    const stderr = memorySink();
    const exitCode = emitCompileCliFailure({ failure: ordinary, phase, stderr });
    assert(exitCode === 1, `普通 ${phase} 异常必须保持 exit 1`);
    assert(stderr.text() === expected, `普通 ${phase} 异常只能输出固定文案`);
  }

  const known = new Error(SENTINELS.join(' '));
  known.code = 'NAVIGATION_ORIGIN_MISMATCH';
  assert(isExecutionTargetCliFailure(known) === true,
    '已知 execution-target reason 必须走共享边界');
  const stderr = memorySink();
  const exitCode = emitCompileCliFailure({ failure: known, stderr });
  assert(exitCode === 1, '导航来源拒绝必须保持 exit 1');
  assert(stderr.text() === 'casey compile: NAVIGATION_ORIGIN_MISMATCH\n',
    '已知 reason 必须保留稳定 reason 码');
  for (const part of FRAGMENTS) {
    assert(!stderr.text().includes(part), `compile 分类封口泄漏片段 ${part}`);
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
