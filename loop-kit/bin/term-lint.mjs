#!/usr/bin/env node
// loop-kit/bin/term-lint.mjs —— 薄转发层（shim，由单一模板生成，勿手改；真实现在独立包 loop-kit，兄弟目录
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

export let parseRegistry;
export let scanText;
export let lintFiles;

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
      process.exitCode = __boot.runCli({ script: "term-lint.mjs", kind: "cli" });
    } catch (e) {
      process.exitCode = __fallbackDegrade("cli", e);
    }
  }
}

if (!isMain) {
  if (__bootError) throw __bootError;
  const __lib = await __boot.loadLib({ script: "term-lint.mjs" });
  parseRegistry = __lib.parseRegistry;
  scanText = __lib.scanText;
  lintFiles = __lib.lintFiles;
}
