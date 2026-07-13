#!/usr/bin/env node
// shim-template.mjs —— loop-kit/bin/*.mjs 十件薄转发层（shim）的单一模板（GRILL D4、评审 H3/R2-H1）。
// renderShim(params) 是唯一渲染入口：生成时（把结果写进 loop-kit/bin/<script>）与校验时（C5 金牌重渲染
// 逐字比对现文件）共用同一函数——杜绝「模板」与「金牌对模板的理解」各自漂移出第三变体。
// 模板含对 loop-kit/lib/boot.mjs 的最小内联 try/catch 边界（boot 自身缺失/语法损坏/依赖装载失败时，
// 该边界独立于 boot 兜底降级——评审 R2-H1：降级逻辑集中到 boot 不等于 boot 自身故障可以绕过矩阵）。
//
// params:
//   script   —— 包内 bin/ 下同名脚本文件名（如 'gate.mjs'）
//   kind     —— 'cli' | 'guard' | 'lint'（D5 三类降级语义）
//   libNames —— 库模式 re-export 的具名列表（空数组 = 无库消费者，只做 CLI 主模式）

export function renderShim({ script, kind, libNames = [] }) {
  const hasLib = libNames.length > 0;
  const exportLetBlock = hasLib
    ? `\n${libNames.map((n) => `export let ${n};`).join('\n')}\n`
    : '';
  const libBranch = hasLib
    ? `\nif (!isMain) {\n  if (__bootError) throw __bootError;\n  const __lib = await __boot.loadLib({ script: ${JSON.stringify(script)} });\n${libNames.map((n) => `  ${n} = __lib.${n};`).join('\n')}\n}\n`
    : '';

  return `#!/usr/bin/env node
// loop-kit/bin/${script} —— 薄转发层（shim，由单一模板生成，勿手改；真实现在独立包 loop-kit，兄弟目录
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
    console.log(\`WARN  loop-kit 引导失败（lint 监督层不阻塞）：\${err && err.message}\`);
    return 0;
  }
  console.error(\`loop-kit shim 引导失败：\${err && err.message}\\n补救：确认 ../../loop-kit（或 LOOP_KIT_PKG 指向的包）存在且完整，或修复 loop-kit/lib/boot.mjs。\`);
  return code;
}
${exportLetBlock}
let __boot, __bootError;
try {
  __boot = await import('../lib/boot.mjs');
} catch (e) {
  __bootError = e;
}

if (isMain) {
  if (__bootError) {
    process.exitCode = __fallbackDegrade(${JSON.stringify(kind)}, __bootError);
  } else {
    try {
      process.exitCode = __boot.runCli({ script: ${JSON.stringify(script)}, kind: ${JSON.stringify(kind)} });
    } catch (e) {
      process.exitCode = __fallbackDegrade(${JSON.stringify(kind)}, e);
    }
  }
}
${libBranch}`;
}

// 十件参数登记表（唯一事实源：生成脚本与 C5 金牌都从这里取，不各自维护一份名单）。
// libNames 顺序即 C1 deepEq 快照顺序（提取前 in-repo 三库件导出名，plan D7/§3 S1 冻结）。
export const SHIM_PARAMS = [
  { script: 'breaker.mjs', kind: 'cli', libNames: [] },
  {
    script: 'contract.mjs', kind: 'cli', libNames: [
      'STAGES', 'touchesImpl', 'initContract', 'canAdvance', 'advanceStage', 'doneThrough',
      'checkAction', 'gitSub', 'bashAction', 'stripPathspec', 'commitArgs', 'actionFromTool',
      'isValidSlug', 'defaultWorktreePath', 'parseWorktreePorcelain', 'describeBaton', 'slugTaken',
      'isPathInsideRepo',
    ],
  },
  { script: 'gate.mjs', kind: 'cli', libNames: [] },
  { script: 'hook-loop-guard.mjs', kind: 'guard', libNames: [] },
  { script: 'hook-loop-triage.mjs', kind: 'lint', libNames: [] },
  { script: 'hook-posttool.mjs', kind: 'lint', libNames: [] },
  { script: 'hook-stop.mjs', kind: 'lint', libNames: [] },
  { script: 'ratchet.mjs', kind: 'cli', libNames: ['normalizeRepoPath', 'buildRatchetIndex', 'verifyRatchet', 'findAffectedPrds'] },
  { script: 'review-deepseek.mjs', kind: 'cli', libNames: [] },
  { script: 'term-lint.mjs', kind: 'cli', libNames: ['parseRegistry', 'scanText', 'lintFiles'] },
];
