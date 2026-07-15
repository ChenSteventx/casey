#!/usr/bin/env node
// loop-kit/bin/contract.mjs —— 薄转发层（shim，由单一模板生成，勿手改；真实现在独立包 loop-kit，兄弟目录
// 或 LOOP_KIT_PKG 显式指向）。全部包定位/身份锁校验/env 注入/降级逻辑单点收在 loop-kit/lib/boot.mjs，
// 本文件只调它，并以最小内联 try/catch 兜住 boot 自身故障（评审 R2-H1）。
// 模板源：tests/fixtures/loop-kit-expected/shim-template.mjs（C5 金牌逐字比对钉死展开结果，勿分叉手改）。
// 详见 docs/plans/loop-kit-extract/plan.md D4/D5、proposed/GRILL.md。
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __self = fileURLToPath(import.meta.url);
const isMain = process.argv[1] ? resolve(process.argv[1]) === __self : false;
const __DEGRADE = { cli: 64, guard: 2, lint: 0 };
function __fallbackDegrade(kind, err) {
  const code = __DEGRADE[kind] ?? 64;
  if (kind === 'lint') {
    console.log(`WARN  loop-kit 引导失败（lint 监督层不阻塞）：${err && err.message}`);
    return 0;
  }
  console.error(`loop-kit shim 引导失败：${err && err.message}\n补救：确认 ../../loop-kit（或 LOOP_KIT_PKG 指向的包）存在且完整，或修复 loop-kit/lib/boot.mjs。`);
  return code;
}

export let STAGES;
export let touchesImpl;
export let initContract;
export let canAdvance;
export let advanceStage;
export let doneThrough;
export let checkAction;
export let gitSub;
export let bashAction;
export let stripPathspec;
export let commitArgs;
export let actionFromTool;
export let isValidSlug;
export let defaultWorktreePath;
export let parseWorktreePorcelain;
export let describeBaton;
export let slugTaken;
export let isPathInsideRepo;

let __boot, __bootError;
try {
  __boot = await import('../lib/boot.mjs');
} catch (e) {
  __bootError = e;
}

if (isMain) {
  if (__bootError) {
    process.exitCode = __fallbackDegrade("cli", __bootError);
  } else {
    try {
      process.exitCode = __boot.runCli({ script: "contract.mjs", kind: "cli" });
    } catch (e) {
      process.exitCode = __fallbackDegrade("cli", e);
    }
  }
}

if (!isMain) {
  if (__bootError) throw __bootError;
  const __lib = await __boot.loadLib({ script: "contract.mjs" });
  STAGES = __lib.STAGES;
  touchesImpl = __lib.touchesImpl;
  initContract = __lib.initContract;
  canAdvance = __lib.canAdvance;
  advanceStage = __lib.advanceStage;
  doneThrough = __lib.doneThrough;
  checkAction = __lib.checkAction;
  gitSub = __lib.gitSub;
  bashAction = __lib.bashAction;
  stripPathspec = __lib.stripPathspec;
  commitArgs = __lib.commitArgs;
  actionFromTool = __lib.actionFromTool;
  isValidSlug = __lib.isValidSlug;
  defaultWorktreePath = __lib.defaultWorktreePath;
  parseWorktreePorcelain = __lib.parseWorktreePorcelain;
  describeBaton = __lib.describeBaton;
  slugTaken = __lib.slugTaken;
  isPathInsideRepo = __lib.isPathInsideRepo;
}
