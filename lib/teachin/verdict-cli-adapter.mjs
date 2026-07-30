// 现役 frozen 裁判 bin/verdict.mjs 的唯一子进程边界（显式 impure boundary，不属纯核心）。
// 本模块不修改、不复制、不 import 裁判逻辑：只把 exact axes bytes 写进独占临时目录，
// 以参数数组 + shell:false 启动现役裁判，再把产物做闭合形状与 identity/顺序绑定校验。
// stderr、临时路径、输入内容与子进程异常原文永不进入返回值（护栏 #14 fail-safe）。

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JUDGE_PATH = resolve(fileURLToPath(new URL('../../bin/verdict.mjs', import.meta.url)));
// 冻结锚与 loop/prd-gen-prompts.json 的 testChecksums 一致；漂移即拒执行。
const FROZEN_JUDGE_SHA256 = 'ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53';
const EXEC_OPTIONS = Object.freeze({
  shell: false,
  windowsHide: true,
  timeout: 30_000,
  maxBuffer: 1_048_576,
});
const VERDICT_STATES = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const VERDICT_STEP_KEYS = ['atom', 'intentId', 'reason', 'stepId', 'verdict'];
const DEPENDENCY_KEYS = [
  'createWorkspace',
  'writeWorkspaceFile',
  'readWorkspaceFile',
  'removeWorkspace',
  'readJudgeBytes',
  'executeJudge',
];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

// 输入只做闭合形状检查：不复算动作、断言或取证，也不复制裁判枚举树。
function parseAxesInput(bytes) {
  let doc;
  try {
    doc = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  if (typeof doc.caseId !== 'string' || !doc.caseId) return null;
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) return null;
  for (const step of doc.steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
    if (typeof step.stepId !== 'string' || !step.stepId) return null;
  }
  return doc;
}

// 只证明产物确实对应本次输入：未知键、步数变化、乱序、identity 换绑与非 canonical 结论均拒。
function verdictMatchesInput(axesInput, doc) {
  if (!exactKeys(doc, ['caseId', 'steps'])) return false;
  if (doc.caseId !== axesInput.caseId) return false;
  if (!Array.isArray(doc.steps) || doc.steps.length !== axesInput.steps.length) return false;
  for (let index = 0; index < doc.steps.length; index += 1) {
    const step = doc.steps[index];
    const source = axesInput.steps[index];
    if (!exactKeys(step, VERDICT_STEP_KEYS)) return false;
    if (step.stepId !== source.stepId) return false;
    if (step.intentId !== source.intentId) return false;
    if (step.atom !== source.atom) return false;
    if (!VERDICT_STATES.has(step.verdict)) return false;
    if (step.reason !== null && typeof step.reason !== 'string') return false;
  }
  return true;
}

// 冻结锚校验：judge 字节必须与 FROZEN_JUDGE_SHA256 完全一致，读不到/漂移一律拒执行。
function judgeBytesAnchored(dependencies) {
  let judgeBytes;
  try {
    judgeBytes = dependencies.readJudgeBytes();
  } catch {
    return false;
  }
  if (!Buffer.isBuffer(judgeBytes)) return false;
  return createHash('sha256').update(judgeBytes).digest('hex') === FROZEN_JUDGE_SHA256;
}

async function executeInWorkspace(dependencies, workspace, axesBytes, axesInput) {
  if (!judgeBytesAnchored(dependencies)) return denied('VERDICT_EXECUTION_FAILED');
  try {
    dependencies.writeWorkspaceFile(workspace.axesPath, axesBytes);
  } catch {
    return denied('VERDICT_EXECUTION_FAILED');
  }
  let executed;
  try {
    executed = await dependencies.executeJudge({
      command: process.execPath,
      argv: [JUDGE_PATH, '--axes', workspace.axesPath, '--out', workspace.verdictPath],
      options: EXEC_OPTIONS,
      axesPath: workspace.axesPath,
      verdictPath: workspace.verdictPath,
    });
  } catch {
    return denied('VERDICT_EXECUTION_FAILED');
  }
  // 校验与执行之间的 TOCTOU 窗口收口：execFile 的 argv 由 golden 冻死为固定 judge path
  // （不能改指只读临时副本），因此执行结束后立即复核同一路径的字节仍是冻结锚——
  // 执行窗口内被掉包再换回之外的任何漂移都在此拒绝，且不发布任何 verdict 字节。
  if (!judgeBytesAnchored(dependencies)) return denied('VERDICT_EXECUTION_FAILED');
  const exitCode = executed && typeof executed === 'object' ? executed.exitCode : undefined;
  // 现役裁判把「坏数据」固定为 exit 65，与内部错误的非零退出分流。
  if (exitCode === 65) return denied('VERDICT_INPUT_INVALID');
  if (exitCode !== 0) return denied('VERDICT_EXECUTION_FAILED');
  let verdictBytes;
  try {
    verdictBytes = dependencies.readWorkspaceFile(workspace.verdictPath);
  } catch {
    return denied('VERDICT_EXECUTION_FAILED');
  }
  if (!Buffer.isBuffer(verdictBytes) || verdictBytes.length === 0) {
    return denied('VERDICT_EXECUTION_FAILED');
  }
  let doc;
  try {
    doc = JSON.parse(verdictBytes.toString('utf8'));
  } catch {
    return denied('VERDICT_EXECUTION_FAILED');
  }
  if (!verdictMatchesInput(axesInput, doc)) return denied('VERDICT_EXECUTION_FAILED');
  return frozen({ ok: true, verdictBytes: Buffer.from(verdictBytes) });
}

// 工厂只供本模块 canonical 装配与 zero-SUT 故障注入；生产编排不转导它，也不接收依赖注入。
export function createVerdictCliAdapter(dependencies = {}) {
  const usable = !!dependencies && typeof dependencies === 'object'
    && DEPENDENCY_KEYS.every((name) => typeof dependencies[name] === 'function');
  return frozen({
    async runFrozenVerdict(options) {
      if (!usable) return denied('VERDICT_INPUT_INVALID');
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return denied('VERDICT_INPUT_INVALID');
      }
      // 调用方只能提交 axesBytes：路径、case 名、judge path、command、args、env、
      // shell、timeout 与输出事实一律不收。
      if (!exactKeys(options, ['axesBytes'])) return denied('VERDICT_INPUT_INVALID');
      if (!Buffer.isBuffer(options.axesBytes) || options.axesBytes.length === 0) {
        return denied('VERDICT_INPUT_INVALID');
      }
      // 立即复制：任何依赖调用之后调用方对同一 Buffer 的 mutation 都无效。
      const axesBytes = Buffer.from(options.axesBytes);
      const axesInput = parseAxesInput(axesBytes);
      if (!axesInput) return denied('VERDICT_INPUT_INVALID');

      let workspace;
      try {
        workspace = dependencies.createWorkspace();
      } catch {
        return denied('VERDICT_EXECUTION_FAILED');
      }
      if (!workspace || typeof workspace !== 'object'
        || typeof workspace.axesPath !== 'string'
        || typeof workspace.verdictPath !== 'string') {
        return denied('VERDICT_EXECUTION_FAILED');
      }
      let outcome;
      try {
        outcome = await executeInWorkspace(dependencies, workspace, axesBytes, axesInput);
      } catch {
        outcome = denied('VERDICT_EXECUTION_FAILED');
      }
      // 清理失败覆盖本次潜在成功，绝不带半份 verdictBytes 返回。
      try {
        dependencies.removeWorkspace(workspace);
      } catch {
        return denied('VERDICT_TEMP_CLEANUP_FAILED');
      }
      return outcome;
    },
  });
}

function canonicalCreateWorkspace() {
  const directory = mkdtempSync(join(tmpdir(), 'casey-teachin-verdict-'));
  return {
    directory,
    axesPath: join(directory, 'axes.json'),
    verdictPath: join(directory, 'verdict.json'),
  };
}

// 固定 execFile（不是 spawn/shell 字符串）+ 参数数组 + shell:false；只回退出码，不回 stderr。
function canonicalExecuteJudge({ command, argv, options }) {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(command, argv, options, (error) => {
      if (!error) {
        resolvePromise({ exitCode: 0 });
        return;
      }
      if (typeof error.code === 'number') {
        resolvePromise({ exitCode: error.code });
        return;
      }
      rejectPromise(error);
    });
  });
}

export const canonicalVerdictCliAdapter = createVerdictCliAdapter({
  createWorkspace: canonicalCreateWorkspace,
  writeWorkspaceFile: (path, bytes) => writeFileSync(path, bytes),
  readWorkspaceFile: (path) => readFileSync(path),
  removeWorkspace: (workspace) => rmSync(workspace.directory, { recursive: true, force: true }),
  readJudgeBytes: () => readFileSync(JUDGE_PATH),
  executeJudge: canonicalExecuteJudge,
});
