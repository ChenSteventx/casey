#!/usr/bin/env node
// intent-plan-known-atom-foundation：compile-gate 状态机只能有一套语义；trace 是旧 problems 的可审计展开。
// 本文件是冻结验收，不得由实现 agent 修改。
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (message) => {
  console.error(`RED  intent-state-trace: ${message}`);
  process.exit(1);
};

let traceStateMachine;
let checkStateMachine;
try {
  ({ traceStateMachine, checkStateMachine } = await import(pathToFileURL(join(ROOT, 'lib', 'compile-gate.mjs')).href));
} catch (error) {
  fail(`导入 compile-gate 失败：${String(error.message).slice(-240)}`);
}
if (typeof traceStateMachine !== 'function') fail('lib/compile-gate.mjs 未导出 traceStateMachine（实现前预期红）');

const registry = {
  states: {
    logged: {},
    modal: {},
    list: {},
    detail: {},
    ready: {},
    done: {},
  },
  exclusiveGroups: [['list', 'detail']],
  atoms: {
    enterList: {
      params: {},
      requires: ['logged'],
      provides: ['list'],
      removes: ['modal'],
    },
    openDetail: {
      params: {},
      requires: ['list'],
      provides: ['detail'],
    },
    provideReady: {
      params: {},
      provides: ['ready'],
    },
    consumeReady: {
      params: {},
      requires: ['ready'],
      provides: ['done'],
    },
    missingRequirement: {
      params: {},
      requires: ['absent'],
      provides: ['done'],
    },
  },
};

const flow = (...atoms) => ({
  id: 'trace_flow',
  name: 'trace flow',
  category: 'normal',
  steps: atoms.map((atom) => ({ atom, params: {} })),
});
const failures = [];
let passes = 0;
function check(name, fn) {
  try {
    fn();
    passes++;
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-500)}`);
  }
}
function exact(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} 不符；want=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`);
  }
}

check('T1 导出面', () => {
  if (typeof traceStateMachine !== 'function') throw new Error('未导出 traceStateMachine');
  if (typeof checkStateMachine !== 'function') throw new Error('旧 checkStateMachine 导出消失');
});

check('T2 初态/requires/provides/removes/exclusive/finalStates 全量可复现', () => {
  const trace = traceStateMachine(flow('enterList', 'openDetail'), registry, ['logged', 'modal']);
  exact(trace.steps, [
    {
      index: 0,
      atom: 'enterList',
      before: ['logged', 'modal'],
      requires: ['logged'],
      missing: [],
      provides: ['list'],
      removes: ['modal'],
      after: ['list', 'logged'],
    },
    {
      index: 1,
      atom: 'openDetail',
      before: ['list', 'logged'],
      requires: ['list'],
      missing: [],
      provides: ['detail'],
      removes: [],
      after: ['detail', 'logged'],
    },
  ], 'trace.steps');
  exact(trace.finalStates, ['detail', 'logged'], 'finalStates');
  exact(trace.problems, [], 'problems');
});

check('T3 missing 精确点名，且 problems 与旧 API 字节等价', () => {
  const target = flow('missingRequirement');
  const trace = traceStateMachine(target, registry, []);
  exact(trace.steps[0].missing, ['absent'], 'missing');
  exact(trace.steps[0].before, [], 'before');
  // 旧状态机为防连锁误报，会把 missing 视为已满足后继续模拟；trace 必须忠实暴露这件事。
  exact(trace.steps[0].after, ['absent', 'done'], 'after');
  exact(trace.problems, checkStateMachine(target, registry, []), '旧/新 problems');
  if (trace.problems.length !== 1 || !trace.problems[0].includes('需要〈absent〉')) {
    throw new Error(`missing problem 不精确：${JSON.stringify(trace.problems)}`);
  }
});

check('T4 provider 在前时 missing 消失', () => {
  const target = flow('provideReady', 'consumeReady');
  const trace = traceStateMachine(target, registry, []);
  exact(trace.steps[1].requires, ['ready'], 'requires');
  exact(trace.steps[1].missing, [], 'missing');
  exact(trace.problems, [], 'problems');
  exact(trace.finalStates, ['done', 'ready'], 'finalStates');
});

check('T5 initialStates 清洗并排序，输入数组不被修改', () => {
  const initial = ['modal', null, 'logged', 'logged', 7];
  const snapshot = structuredClone(initial);
  const trace = traceStateMachine(flow('enterList'), registry, initial);
  exact(initial, snapshot, 'initialStates 输入');
  exact(trace.steps[0].before, ['logged', 'modal'], '清洗后 before');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  intent-state-trace: ${failure}`);
  console.error(`RED  intent-state-trace: ${passes} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   intent-state-trace: ${passes}/${passes}（单一状态机 + trace + 旧 problems 字节兼容）`);
process.exit(0);
