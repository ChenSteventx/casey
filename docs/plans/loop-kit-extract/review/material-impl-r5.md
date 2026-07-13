# loop-kit-extract 实现审 round-2 第四次跑评审料（material-impl-r5）

> 用途：喂给异构冗余实现审（`codex` / `pi`）round-2 第四次跑。此前三次跑均由 `codex` 发现问题、
> `pi` 同料判 `PASS`：第一次跑 2 `HIGH`+1 `MED`+1 `LOW`；第二次跑 1 `HIGH`；第三次跑 1 `MED`+1
> `LOW`。均已处置，详见 `docs/plans/loop-kit-extract/review/codex-impl-r2.md`/`r3.md`/`r4.md`。
> 本轮复核处置后的最终状态。

---

## 0. 评审指令（原样转发）

你是异构冗余实现审的评审方（评审家族≠实现家族：实现方是 Claude/Sonnet 5）。这是
`casey-loop-kit-extract` 契约实现审第五轮复核（`round-1` 七条 + `round-2` 三次跑各自发现均已
处置）。请针对下文「历史发现摘要」「本轮新增处置」「diff」「门禁证据」逐条核实：

1. `round-2` 第三次跑的 1 条 `MED`（显式 `envRoot` 同值分支缺永久回归测试）与 1 条 `LOW`
   （`isFrozenBySelf()` 命名过度声明）是否已真实闭合？重点复核新增的 C7 用例是否确实覆盖了
   `claimAtomic()` 的显式 `envRoot` 同值分支（而不是巧合般走到省略路径）；`isClaimSlotFrozen()`
   改名后行为是否与改名前完全一致（零行为改动，纯命名/注释精度修正）。
2. 通读 `loop-kit/lib/root.mjs` 全文（本轮 diff 累积后的最终版本），独立评估其 ROOT 认领机制
   是否还有你能构造出的其它缺口（不局限于历史发现列表，欢迎提出全新角度）。
3. 这四轮修复整体上是否引入了任何新问题、性能隐患、或对既有七项 `round-1` 闭合的意外破坏。
4. 冻结纪律与凭据/术语边界同前几轮标准。

给出总体结论（`PASS` / `CHANGES REQUIRED`），若仍有发现请标 `HIGH`/`MED`/`LOW` 并给出文件位置与
复现方式。你在 `read-only` 沙箱内可以自行读文件、跑只读命令（含构造独立复现脚本）来验证。

---

## 1. 历史发现摘要

`round-1`（7 条采信，已修复）：`A1`（`HIGH`）ROOT 认领槽模块局部变量；`A2`（`HIGH`）D5 故障矩阵
金牌未覆盖全故障域；`A3`（`HIGH`）`boot.mjs` 不入 `testChecksums`；`A4`（`MED`）金牌原地覆写生产
信任根文件；`A5`（`MED`）观测基线规范化非字段级白名单；`A6`（`MED`）`loadLib` 字符串拼接 `file://`
URL 特殊字符解析错位；`A7`（`LOW`）信号自终失败兜底码不符 `128+n` 语义。

`round-2` 第一次跑（`codex` 2 `HIGH`+1 `MED`+1 `LOW`，已修复）：`worker_threads` 跨 Worker 独立
`globalThis` 静默各自认领；槽内容预置无效值被幂等复用照单全收；`SPAWN_ERROR`/`NO_STATUS` 断言只
查退出码可假绿；`A6` 缺失特殊字符路径回归测试；`C4` 遗留孤儿锁文件。

`round-2` 第二次跑（`codex` 1 `HIGH`，已修复）：外部预置合法 ROOT 后，幂等复用路径校验通过但从未
冻结该属性，随后可再改写成另一个同样合法的 ROOT。

`round-2` 第三次跑（`codex` 1 `MED`+1 `LOW`，本轮处置对象）：显式 `envRoot` 同值分支
（`claimAtomic()`）缺永久回归测试；`isFrozenBySelf()` 命名声称「本模块自身产生」但实际只能证明
「当前已冻结」。

## 2. 本轮新增处置

- 新增独立 C7 用例：`外部预置合法 ROOT 后再改写：显式 envRoot 同值路径（claimAtomic）同样应就地
  补冻结` —— 外部预置合法 A → 显式 `envRoot: A` 调用 `resolveRoot` → 断言返回前已冻结 → 断言改写
  为合法 B 被拒绝。用 codex 描述的相同 mutation（删除 `claimAtomic()` 的补冻结调用）验证：mutation
  后该新用例正确转红（`{"swapped":true,...,"writable":true,"configurable":true}`）。
- `isFrozenBySelf()` 改名为 `isClaimSlotFrozen()`，函数体与调用点零改动（纯命名 + 注释精度修正，
  不声称「本模块自身产生」，只如实描述「当前是否已不可写/不可配置」）。

## 3. 门禁证据

```
$ node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json
gate: GREEN —— story 5/5 过

$ node tests/_golden/loop-kit-extract.golden.mjs
loop-kit-extract golden: 73/73 GREEN

$ node bin/casey.mjs selftest --tier1
selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。

$ node loop-kit/bin/ratchet.mjs verify
ratchet verify: RED -- 69 PRD / 190 冻结文件 / 2 问题
RED FILE_MISSING cases/tc_wf_history_version/expected.frozen.json
RED FILE_MISSING cases/tc_wf_publish_states/expected.frozen.json
```

上述 2 项 `FILE_MISSING` 是本契约无关的既有缺口（`prd` `observability` 已记档，改动前后同为这 2 项）。

## 4. Diff（Casey worktree，从提取切换收口 `31e71de` 到本轮 HEAD 的累积 diff）

```diff
diff --git a/loop-kit/kit-lock.json b/loop-kit/kit-lock.json
index 83ff2ce..36f3dd2 100644
--- a/loop-kit/kit-lock.json
+++ b/loop-kit/kit-lock.json
@@ -12,7 +12,7 @@
     "bin/ratchet.mjs": "bc0389a1b6951154af961520d728eeaf06a31b9da7d4072ac7731297b7c70f3b",
     "bin/review-deepseek.mjs": "11ed6d0aa25d650004f545febe31ebaa2ee018d33b979da72476d58ce2a36e09",
     "bin/term-lint.mjs": "802b71d7ca27c8db2ff91bc5f1108e1ded6d233ebfe89021824ec57d14554cf0",
-    "lib/root.mjs": "512dc7f82a1f56817dbf79e93c3a245c06e6be85c2213d6e11922938cb40c9a1",
+    "lib/root.mjs": "bb61035656067857e14cd4b1c32e2b951b950a42f4d5c988922e902f3d2b4a3e",
     "package.json": "1f435d74bae0b8db750cdd85033b3364b6431212d3b24702c7e4f6a0cf1b1279"
   }
 }
diff --git a/loop-kit/lib/boot.mjs b/loop-kit/lib/boot.mjs
index 1b0028d..4047e99 100644
--- a/loop-kit/lib/boot.mjs
+++ b/loop-kit/lib/boot.mjs
@@ -12,7 +12,8 @@ import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
 import { createHash } from 'node:crypto';
 import { spawnSync } from 'node:child_process';
 import { join, resolve } from 'node:path';
-import { fileURLToPath } from 'node:url';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+import { constants as OS_CONSTANTS } from 'node:os';
 
 // 本文件位于 <tree>/loop-kit/lib/boot.mjs；TREE_ROOT = 消费树根；DEFAULT_PKG_DIR = 静态兄弟约定
 // new URL('../../../loop-kit', import.meta.url)（GRILL D4 字面表述，逐字采用）。
@@ -137,10 +138,21 @@ function degrade(kind, err, { silent = false } = {}) {
   return code;
 }
 
+// 信号名 → 数值编号（POSIX，Node os.constants.signals），供下方自终失败兜底码换算 128+n 用。
+function signalNumber(signalName) {
+  const n = OS_CONSTANTS && OS_CONSTANTS.signals ? OS_CONSTANTS.signals[signalName] : undefined;
+  return typeof n === 'number' ? n : null;
+}
+
 // ---- CLI 转发 ----
 // kind: 'cli'（gate/contract/breaker/term-lint/ratchet/review-deepseek）| 'guard'（hook-loop-guard）|
 //       'lint'（hook-stop/hook-posttool/hook-loop-triage）。三类降级语义见 D5 矩阵、plan.md GRILL.md。
-export function runCli({ script, kind, argv = process.argv.slice(2), pkgDirOverride, lockPathOverride } = {}) {
+// spawnImpl：测试专用注入口（round-1 实现审 A2 采信新增）——默认真实 spawnSync；生产 shim 从不传参，
+// 与 pkgDirOverride/lockPathOverride 同类「生产零跳过口、测试唯一可达」的接缝，供确定性制造
+// spawnSync 的 r.error / status===null 等否则无法跨平台稳定复现的返回态。
+export function runCli({
+  script, kind, argv = process.argv.slice(2), pkgDirOverride, lockPathOverride, spawnImpl = spawnSync,
+} = {}) {
   let dir;
   try {
     dir = resolveVerifiedPkg({ pkgDirOverride, lockPathOverride });
@@ -151,7 +163,7 @@ export function runCli({ script, kind, argv = process.argv.slice(2), pkgDirOverr
   if (!existsSync(target)) {
     return degrade(kind, new BootError(`包内目标脚本缺失：${script}`, { code: 'TARGET_MISSING' }));
   }
-  const r = spawnSync(process.execPath, [target, ...argv], {
+  const r = spawnImpl(process.execPath, [target, ...argv], {
     stdio: 'inherit',
     env: { ...process.env, LOOP_KIT_ROOT: TREE_ROOT },
   });
@@ -161,8 +173,15 @@ export function runCli({ script, kind, argv = process.argv.slice(2), pkgDirOverr
   if (r.signal) {
     if (kind === 'cli') {
       // 子进程信号终止 → 以同信号自终，保留 shell 128+n 语义（D5 CLI 行）。
-      try { process.kill(process.pid, r.signal); } catch { /* ignore */ }
-      return 1; // 若信号未能实际终止本进程（极端环境），仍给一个非零兜底码
+      try {
+        process.kill(process.pid, r.signal);
+      } catch {
+        // 若信号未能实际终止本进程（极端环境，如信号名无法投递），兜底码仍遵循 shell 128+n 语义
+        // （round-1 实现审 A7 采信：不用普通业务失败码 1，避免与真实业务 RED 混淆）。
+        const n = signalNumber(r.signal);
+        return n === null ? 1 : 128 + n; // 连编号都查不到时才退回 1（极端兜底之兜底）
+      }
+      return 1; // 正常路径：process.kill 已成功投递，本进程即将真的被同信号终止，这里的返回值不会被观察到
     }
     return degrade(kind, new BootError(`子进程被信号终止：${r.signal}`, { code: 'SIGNALED' }));
   }
@@ -176,11 +195,13 @@ export function runCli({ script, kind, argv = process.argv.slice(2), pkgDirOverr
 
 // ---- 库模式：动态 import 包内模块 + 求值前原子认领本树 ROOT（评审 R2-H3）----
 // 抛错直接向上冒泡——库模式无 exit code 概念，由调用方（shim 的 else 分支）决定是否再抛。
+// URL 构造统一走 pathToFileURL（round-1 实现审 A6 采信）——字符串拼接 file://${dir}/ 在 dir 含 # / % /
+// 空格等字符时会被误当 URL fragment/转义序列，锁校验通过后仍可能 import 到错误路径。
 export async function loadLib({ script, pkgDirOverride, lockPathOverride } = {}) {
   const dir = resolveVerifiedPkg({ pkgDirOverride, lockPathOverride });
-  const rootMod = await import(new URL('lib/root.mjs', `file://${dir}/`).href);
+  const rootMod = await import(pathToFileURL(join(dir, 'lib', 'root.mjs')).href);
   rootMod.resolveRoot({ envRoot: TREE_ROOT }); // 显式参数认领——目标模块随后裸调用走幂等分支，不依赖 cwd
-  return import(new URL(`bin/${script}`, `file://${dir}/`).href);
+  return import(pathToFileURL(join(dir, 'bin', script)).href);
 }
 
 // 仅供测试探查默认位置（不改变行为，探针性质）。
diff --git a/loop/prd-loop-kit-extract.json b/loop/prd-loop-kit-extract.json
index e9f0c66..5bca5a8 100644
--- a/loop/prd-loop-kit-extract.json
+++ b/loop/prd-loop-kit-extract.json
@@ -3,11 +3,12 @@
   "task": "loop-kit-extract（full，kernel 级加严）：loop-kit 通用内核提取为独立包 /mnt/d/ctx/heren/loop-kit（兄弟目录，fresh git init，出处记 casey@f9f9019）+ Casey 侧十文件原地换薄转发层（shim）+ 新增共享引导助手 loop-kit/lib/boot.mjs（包定位/kit-lock 包身份锁校验/env 注入/CLI 转发与库模式 re-export/D5 全故障域降级单点）。内核行为一字不让——提取前后逐命令等价（切换前观测基线钉死）。决策依据：docs/plans/loop-kit-extract/plan.md、proposed/GRILL.md（D1–D10）、Steven 2026-07-13 四裁定（route:human #1 有条件签署已满足 / #4 D8 取甲不加依赖声明 / #2 D5 加严接受 / #3 D2 取 fresh git init）。",
   "specPath": "docs/plans/loop-kit-extract/plan.md",
   "testChecksums": {
-    "loop-kit/kit-lock.json": "b33e6096d686064f97ecb559fd343f2d6c4152d843abe6a6aecc223120033747",
+    "loop-kit/kit-lock.json": "043594335a17106e4bed400c1803f5e08aca581376a4e34a47f2c4eb8402853a",
+    "loop-kit/lib/boot.mjs": "9e0cf9ccf0d79975d07676139a30782b31f54411f7f7b64cbcb7b3dc58f89720",
     "loop/prd-ratchet-reverse-index.json": "5e8c093c2c72128bec40c0e8cae769e7eb3d4f28b093aa0158471f26b32e8199",
     "loop/prd-term-guard.json": "227157bb517a0e8af2173ff231acbfa799bae922c33cc935a35d2ef9e0cc5b6f",
     "loop/prd-worktree-baton.json": "9086f24fb10f8f95ef22657783f1af93971d5657a66bac965dc08084311ff770",
-    "tests/_golden/loop-kit-extract.golden.mjs": "f2b61c9ef8a012c42e6e88a02a7d71132718023c22fc92da40a513bb397d6dd4",
+    "tests/_golden/loop-kit-extract.golden.mjs": "35eb49d7ad3cee60124a718ec2b284383ac9e7b80f5c1bab3b9675c47278179a",
     "tests/_golden/ratchet-reverse-index.golden.mjs": "8b76c9a1b8bfb07d87e4ec1b6088d44cc544045d94780738a30667f0f701bbd5",
     "tests/_golden/term-guard.golden.mjs": "d7fba4fa8f87d8e407e926bdeb02798492658f4d924d2943e28b330353fba80a",
     "tests/_golden/worktree-baton.golden.mjs": "bfbb5f2d10f233fe2bb70161c293f6d6ecb0d6cb1eabe99cdc980cccd22d3ecc",
@@ -23,7 +24,7 @@
     "tests/fixtures/loop-kit-expected/baseline/fixture/loop/config.json": "9c808952589e5a80b06cf4ebd9cd1c8d864438a0350f8df12457e612adf89c91",
     "tests/fixtures/loop-kit-expected/baseline/fixture/loop/grill-baseline.md": "b5359a6e99719cc26286b0b43a5318c88dccb7f842a48f39baf998f46be2fccf",
     "tests/fixtures/loop-kit-expected/baseline/fixture/loop/prd-baseline.json": "8e54ac39ba4c30db520427d5ac98a245db4497085cb73b80a0768e4504765f3b",
-    "tests/fixtures/loop-kit-expected/baseline/normalize.mjs": "c0d9aa644cb110501a727b38c1847b7ab98eafda2a33c2b362dd4823a855a361",
+    "tests/fixtures/loop-kit-expected/baseline/normalize.mjs": "87e6d3fa04d61853cda78166839c2f24ca34831dcc1985ff3b004fc542c87f2f",
     "tests/fixtures/loop-kit-expected/baseline/normalized/breaker-reset.json": "5ca5c09b2eab6a10c27a61986d9ae6e774efeee55dba50afcb13e58d270be904",
     "tests/fixtures/loop-kit-expected/baseline/normalized/breaker-round-error.json": "accfb4a3f2dfe4f5cff702eb5543eeaaa5fc3a2652e3dd08c1a2c334540b9cad",
     "tests/fixtures/loop-kit-expected/baseline/normalized/breaker-round-ok.json": "757c291fd1854edc1ad07e58d497a27e17ed8c2cb3261c9fff80b46a9e70a385",
@@ -89,7 +90,7 @@
     "tests/fixtures/loop-kit-expected/package/bin/ratchet.mjs": "bc0389a1b6951154af961520d728eeaf06a31b9da7d4072ac7731297b7c70f3b",
     "tests/fixtures/loop-kit-expected/package/bin/review-deepseek.mjs": "11ed6d0aa25d650004f545febe31ebaa2ee018d33b979da72476d58ce2a36e09",
     "tests/fixtures/loop-kit-expected/package/bin/term-lint.mjs": "802b71d7ca27c8db2ff91bc5f1108e1ded6d233ebfe89021824ec57d14554cf0",
-    "tests/fixtures/loop-kit-expected/package/lib/root.mjs": "512dc7f82a1f56817dbf79e93c3a245c06e6be85c2213d6e11922938cb40c9a1",
+    "tests/fixtures/loop-kit-expected/package/lib/root.mjs": "bb61035656067857e14cd4b1c32e2b951b950a42f4d5c988922e902f3d2b4a3e",
     "tests/fixtures/loop-kit-expected/package/package.json": "1f435d74bae0b8db750cdd85033b3364b6431212d3b24702c7e4f6a0cf1b1279",
     "tests/fixtures/loop-kit-expected/shim-template.mjs": "57d2271c6b9608445d24f45af84e4c23be14993d00c292c38f67a3b65c3dfb13"
   },
@@ -109,9 +110,9 @@
       "route": "machine"
     },
     {
-      "dimension": "C3/C4 覆盖范围的务实取舍（记档不阻塞）：跨树交错导入覆盖 A→B(term-lint)→B(contract) 一种代表性序列而非穷举全部库件×全部排列组合；并发导入与目标模块 import 抛错、认领 API 抛错等态由同一「求值前原子认领」机制保证、未逐态都建独立复现；C4 的「status===null 且无信号无 error」态因 spawnSync 无法确定性人为构造，改以源码级断言（boot.mjs 含相应判据）覆盖，非行为级复现；本环境（DrvFs/WSL）不可确定性复现的权限类故障沿用既有豁免协议。",
+      "dimension": "round-1 实现审 A2 采信后收窄：此前本条把「并发导入/目标模块 import 抛错/认领 API 抛错/status===null 且无信号无 error」四态自行标 waived——设计签署时唯一授权的豁免是「DrvFs 不可确定性复现的权限类」（plan §3 S3 末句），此扩面无设计授权、已回收。现状：四态均已补真实用例（C3「并发导入」用 Promise.all 交织两棵异根树验证 claimAtomic 的原子性；C4「目标模块 import 抛错」与「认领 API 抛错」用真实错误脚本/真实跨树冲突场景直接驱动 boot.loadLib；C4「status===null 且无信号无 error」与「spawnSync 派生失败 r.error」改用测试专用 spawnImpl 注入桩在真实 runCli 代码路径上行为级验证，取代此前的源码字符串断言）。仍务实取舍、未扩面到设计未授权范围之外的：跨树交错导入覆盖 A→B(term-lint)→B(contract) 一种代表性序列而非穷举全部库件×全部排列组合；本环境（DrvFs/WSL）不可确定性复现的权限类故障沿用既有豁免协议——这是 plan 唯一授权的豁免。",
       "route": "waived",
-      "note": "核心不变量（跨树冲突在求值前拦下、故障域按入口归一）已由代表性场景与源码级断言覆盖；穷举更多组合的边际收益低，留作后续如遇实证再补。"
+      "note": "回收范围见上；剩余两项（交错序列取代表性样本、DrvFs 权限类）与设计签署时的授权豁免一致，不构成新的扩面。"
     },
     {
       "dimension": "C6「经 shim 复跑照绿」的锚点选择：worktree-baton.golden.mjs 自身含一条与「本 worktree 活动 contract slug 恰为 worktree-baton」耦合的断言（G6），与 loop-kit-extract 无关且该金牌字节冻结不可改；本 worktree 活动 slug 是 loop-kit-extract，故其复跑现状是 exit 1（非本契约引入的回归）。C6 因此比对「切换前后复跑结果一致」（零回归）而非绝对要求 exit 0，锚值见 tests/fixtures/loop-kit-expected/baseline/c6-rerun-anchor.json。",
@@ -128,7 +129,7 @@
         "node tests/_golden/loop-kit-extract.golden.mjs --group C0,C1,C7"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T13:59:55.638Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T17:35:13.980Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-switch-equivalence",
@@ -138,7 +139,7 @@
         "node tests/_golden/loop-kit-extract.golden.mjs --group C2,C5"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T14:00:07.546Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T17:35:26.970Z 全部 acceptance exit 0"
     },
     {
       "id": "s3-layout-degrade-cross-tree",
@@ -148,7 +149,7 @@
         "node tests/_golden/loop-kit-extract.golden.mjs --group C3,C4"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T14:00:16.234Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T17:35:43.009Z 全部 acceptance exit 0"
     },
     {
       "id": "s4-legacy-zero-resign",
@@ -158,7 +159,7 @@
         "node tests/_golden/loop-kit-extract.golden.mjs --group C6"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T14:00:57.087Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T17:36:23.720Z 全部 acceptance exit 0"
     },
     {
       "id": "s5-tier1-regression",
@@ -168,7 +169,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T14:00:59.891Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-13T17:36:26.546Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/tests/_golden/loop-kit-extract.golden.mjs b/tests/_golden/loop-kit-extract.golden.mjs
index eb3f017..80a0461 100644
--- a/tests/_golden/loop-kit-extract.golden.mjs
+++ b/tests/_golden/loop-kit-extract.golden.mjs
@@ -125,35 +125,32 @@ for (const [file, spec] of Object.entries(EXPECTED_API)) {
 // ============================================================================
 // C2 — 转发证明 + 完整观测基线等价
 // ============================================================================
-await check('C2', '转发证明：LOOP_KIT_PKG 指向标记包时真转发（锁校验不豁免）', () => {
+await check('C2', '转发证明：LOOP_KIT_PKG 指向标记包时真转发（锁校验不豁免）', async () => {
+  // round-1 实现审 A4 采信：故障注入只动隔离消费树内的 kit-lock.json 拷贝，真实工作树全程只读
+  // （不再备份/覆写/恢复真实 loop-kit/kit-lock.json——非原子写在异常退出/并行读取下曾有损坏真信任根的风险）。
+  const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
   const markerDir = mkdtempSync(join(tmpdir(), 'loop-kit-marker-'));
+  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
   try {
     mkdirSync(join(markerDir, 'bin'), { recursive: true });
     const sentinelSrc = '#!/usr/bin/env node\nconsole.log("LOOP_KIT_MARKER_SENTINEL");\nprocess.exit(43);\n';
     writeFileSync(join(markerDir, 'bin', 'gate.mjs'), sentinelSrc, 'utf8');
     const markerHash = sha256(readFileSync(join(markerDir, 'bin', 'gate.mjs')));
     const markerLock = { schemaVersion: 1, files: { 'bin/gate.mjs': markerHash } };
+    writeFileSync(join(tree, 'loop-kit', 'kit-lock.json'), JSON.stringify(markerLock), 'utf8');
 
-    const hadRealLock = existsSync(KIT_LOCK);
-    const realLockBackup = hadRealLock ? readFileSync(KIT_LOCK) : null;
-    writeFileSync(KIT_LOCK, JSON.stringify(markerLock), 'utf8');
-    let r;
-    try {
-      r = spawnSync(process.execPath, [join(SHIM_DIR, 'gate.mjs')], {
-        cwd: ROOT,
-        encoding: 'utf8',
-        env: { PATH: process.env.PATH, LOOP_KIT_PKG: markerDir },
-      });
-    } finally {
-      if (hadRealLock) writeFileSync(KIT_LOCK, realLockBackup);
-      else { try { unlinkSync(KIT_LOCK); } catch { /* ignore */ } }
-    }
+    const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', 'gate.mjs')], {
+      cwd: tree,
+      encoding: 'utf8',
+      env: { PATH: process.env.PATH, LOOP_KIT_PKG: markerDir },
+    });
     assert(
       r.stdout.includes('LOOP_KIT_MARKER_SENTINEL') && r.status === 43,
       `转发未生效（红基线：全量引擎无视 LOOP_KIT_PKG）——实得 status=${r.status} stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`
     );
   } finally {
     rmrf(markerDir);
+    destroyIsolatedTree(tree);
   }
 });
 
@@ -207,6 +204,48 @@ await check('C2', '反向扰动：规范化比对对真实差异仍判红（规
   assert(threw, '对退出码扰动的比较应判红，实际未检出——规范化/比对逻辑有吞真实差异的风险');
 });
 
+await check('C2', '反向扰动（时间戳类，round-1 实现审 A5）：白名单外的时间戳样式差异不被规范化吞掉', async () => {
+  const { normalize } = await import(pathToFileURL(NORMALIZE_PATH).href);
+  const rawPath = join(BASELINE_DIR, 'raw', 'gate-dry.json');
+  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
+  // 在白名单字段（stdout）之外注入一个形似时间戳的真实差异：正常规范化不应把它变成 <TIMESTAMP>，
+  // 且两次规范化结果的这处差异必须仍然存在（比对必判红），证明「字段级白名单」没有退化回全局正则。
+  const mutatedRaw = JSON.parse(JSON.stringify(raw));
+  mutatedRaw.stdout += '\n业务真实时间戳（非白名单字段，不应被规范化）：2026-01-01T00:00:00.000Z\n';
+  const baseNorm = normalize(raw, { treeRoot: null });
+  const mutatedNorm = normalize(mutatedRaw, { treeRoot: null });
+  assert(
+    mutatedNorm.stdout.includes('2026-01-01T00:00:00.000Z'),
+    '白名单外（stdout 里的业务时间戳，此处刻意扩到未登记内容）字段中的时间戳被规范化吞掉了——违反字段级白名单'
+  );
+  let threw = false;
+  try {
+    compareNormalizedCase(baseNorm, mutatedNorm, 'gate-dry(时间戳类扰动)');
+  } catch {
+    threw = true;
+  }
+  assert(threw, '对 stdout 时间戳类真实差异的比较应判红，实际未检出');
+});
+
+await check('C2', '字段级白名单（round-1 实现审 A5）：仅 loop/.breaker-state.json 的 startedAt 被替换，同名字段在其它文件里原样保留', async () => {
+  const { normalize } = await import(pathToFileURL(NORMALIZE_PATH).href);
+  const rawPath = join(BASELINE_DIR, 'raw', 'gate-dry.json');
+  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
+  const decoyPath = 'loop/decoy-not-breaker-state.json';
+  const decoyContent = '{\n  "startedAt": "2026-07-13T12:57:18.658Z"\n}';
+  const mutatedRaw = JSON.parse(JSON.stringify(raw));
+  mutatedRaw.tree.contents[decoyPath] = decoyContent;
+  const norm = normalize(mutatedRaw, { treeRoot: null });
+  assert(
+    norm.tree.contents[decoyPath] === decoyContent,
+    `白名单按路径精确限定于 loop/.breaker-state.json——同名字段出现在其它文件时不应被替换，实得：${norm.tree.contents[decoyPath]}`
+  );
+  assert(
+    norm.tree.contents['loop/.breaker-state.json'].includes('<TIMESTAMP>'),
+    '白名单登记的 loop/.breaker-state.json 自身仍应正常替换'
+  );
+});
+
 // ============================================================================
 // C3 — 布局、降级与跨树
 // ============================================================================
@@ -258,8 +297,9 @@ await check('C3', '③ 异地树无覆盖 → D5 安全失败（cli 类 exit 64
 });
 
 await check('C3', '同进程跨树：先 import 树 A shim 再 import 树 B shim 得结构化错误（求值前认领拦下）', () => {
-  // 须在独立子进程验证：本golden 自身的 C1/C2/C6 检查已经过 boot.loadLib 认领过 Casey 树 ROOT
-  // （root.mjs 的 claimed 是模块级单例、无 query 串区隔），同进程继续测会被早前检查的认领状态污染。
+  // 须在独立子进程验证：本 golden 自身的 C1/C2/C6 检查已经过 boot.loadLib 认领过 Casey 树 ROOT；
+  // 认领槽是 globalThis[Symbol.for(...)] 键住的进程级单例（round-1 实现审 A1 采信后版本），同进程
+  // 继续测会被早前检查的认领状态污染——故每个跨树场景都在独立子进程里从零状态验证。
   assert(existsSync(PKG_DIR), '真包不存在');
   const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-treeA-'));
   const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-treeB-'));
@@ -282,7 +322,9 @@ try {
 console.log(JSON.stringify({ threwB1, threwB2 }));
 `;
     writeFileSync(wrapperPath, wrapperSrc, 'utf8');
-    // 两树同指真包（LOOP_KIT_PKG）——共享包内 lib/root.mjs 模块实例，才能复现跨树冲突。
+    // 两树同指真包（LOOP_KIT_PKG）——共享包内 lib/root.mjs 同一物理文件（同一模块实例）的场景；
+    // 「两树解析到不同物理包目录」的场景由下一个检查覆盖（round-1 实现审 A1：认领槽改为进程级共享后，
+    // 两种布局都应正确冲突，此检查钉「同模块实例」这一支）。
     const r = spawnSync(process.execPath, [wrapperPath], {
       encoding: 'utf8',
       env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
@@ -300,6 +342,95 @@ console.log(JSON.stringify({ threwB1, threwB2 }));
   }
 });
 
+await check('C3', '同进程跨树（真异包目录，round-1 实现审 A1 核心修复点）：两树各自解析到不同物理包目录仍在求值前认领拦下', () => {
+  // 此前的实现（root.mjs 的 claimed 是模块顶层变量）里，这个场景恰恰是防线不在场的地方：两个不同的
+  // 物理包目录对 ESM 而言是两个不同的 file:// URL，会各自得到独立的 root.mjs 模块实例、各自独立的
+  // claimed——两次认领都成功、零冲突（fable 汇裁独立探针已实测复现）。上一个检查特意让两树共享同一个
+  // LOOP_KIT_PKG（同一物理包目录、同一模块实例），因此掩盖了这个故障域；本检查改为两树各自指向两份
+  // 内容相同但物理路径不同的包拷贝，专门钉死这条此前不可达的路径。
+  assert(existsSync(PKG_DIR), '真包不存在');
+  const pkgCopyA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-pkgA-'));
+  const pkgCopyB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-pkgB-'));
+  rmSync(pkgCopyA, { recursive: true, force: true });
+  rmSync(pkgCopyB, { recursive: true, force: true });
+  cpSync(PKG_DIR, pkgCopyA, { recursive: true });
+  cpSync(PKG_DIR, pkgCopyB, { recursive: true });
+  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-treeA2-'));
+  const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-treeB2-'));
+  const wrapperPath = join(tmpdir(), `loop-kit-c3-crosstree-diffpkg-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  try {
+    for (const t of [treeA, treeB]) {
+      mkdirSync(join(t, 'loop'), { recursive: true });
+      writeFileSync(join(t, 'loop', 'config.json'), '{}', 'utf8');
+      cpSync(join(ROOT, 'loop-kit'), join(t, 'loop-kit'), { recursive: true });
+    }
+    const wrapperSrc = `import { pathToFileURL } from 'node:url';
+process.env.LOOP_KIT_PKG = ${JSON.stringify(pkgCopyA)};
+await import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
+process.env.LOOP_KIT_PKG = ${JSON.stringify(pkgCopyB)};
+let threw = null;
+try {
+  await import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'term-lint.mjs'))}).href);
+} catch (e) { threw = String((e && e.message) || e); }
+console.log(JSON.stringify({ threw }));
+`;
+    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
+    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', env: { PATH: process.env.PATH } });
+    assert(r.status === 0, `跨树探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
+    const out = JSON.parse(r.stdout.trim().split('\n').pop());
+    assert(out.threw, '树 A（经 pkgCopyA）先认领后，树 B（经物理上不同的 pkgCopyB，不同 root.mjs 模块实例）的 import 仍应抛结构化错误——实际未抛（认领槽若退化回模块局部变量就会在此处假绿）');
+    assert(/认领冲突|RootResolutionError/.test(out.threw), `应为 ROOT 认领冲突结构化错误，实得：${out.threw}`);
+  } finally {
+    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
+    rmrf(treeA);
+    rmrf(treeB);
+    rmrf(pkgCopyA);
+    rmrf(pkgCopyB);
+  }
+});
+
+await check('C3', '并发导入：Promise.all 同时发起两树 import，认领互斥不因交织而失效', () => {
+  // plan §3 S3「并发导入」场景：resolveRoot()/claimAtomic() 全程无 await（同步、不可能在函数中途被
+  // 其它微任务打断），故在同一进程内，无论两个 import() 的模块加载阶段如何交织，真正执行认领的那一刻
+  // 总是原子的——本检查用 Promise.all（不依次 await）验证：无论谁先谁后，恰好一个成功、另一个抛冲突。
+  assert(existsSync(PKG_DIR), '真包不存在');
+  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-concurA-'));
+  const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-concurB-'));
+  const wrapperPath = join(tmpdir(), `loop-kit-c3-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  try {
+    for (const t of [treeA, treeB]) {
+      mkdirSync(join(t, 'loop'), { recursive: true });
+      writeFileSync(join(t, 'loop', 'config.json'), '{}', 'utf8');
+      cpSync(join(ROOT, 'loop-kit'), join(t, 'loop-kit'), { recursive: true });
+    }
+    const wrapperSrc = `import { pathToFileURL } from 'node:url';
+const pA = import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
+const pB = import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'term-lint.mjs'))}).href);
+const [ra, rb] = await Promise.allSettled([pA, pB]);
+console.log(JSON.stringify({
+  aStatus: ra.status, aReason: ra.status === 'rejected' ? String(ra.reason && ra.reason.message) : null,
+  bStatus: rb.status, bReason: rb.status === 'rejected' ? String(rb.reason && rb.reason.message) : null,
+}));
+`;
+    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
+    const r = spawnSync(process.execPath, [wrapperPath], {
+      encoding: 'utf8',
+      env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
+    });
+    assert(r.status === 0, `并发导入探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
+    const out = JSON.parse(r.stdout.trim().split('\n').pop());
+    const fulfilledCount = [out.aStatus, out.bStatus].filter((s) => s === 'fulfilled').length;
+    const rejectedCount = [out.aStatus, out.bStatus].filter((s) => s === 'rejected').length;
+    assert(fulfilledCount === 1 && rejectedCount === 1, `并发导入两棵异根树应恰好一存活一冲突，实得 aStatus=${out.aStatus} bStatus=${out.bStatus}`);
+    const rejectedReason = out.aStatus === 'rejected' ? out.aReason : out.bReason;
+    assert(/认领冲突|RootResolutionError/.test(rejectedReason), `被拒绝一方应为 ROOT 认领冲突结构化错误，实得：${rejectedReason}`);
+  } finally {
+    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
+    rmrf(treeA);
+    rmrf(treeB);
+  }
+});
+
 // ============================================================================
 // C4 — 故障族矩阵（逐故障 × 逐入口断言 D5 表）
 // ============================================================================
@@ -316,12 +447,21 @@ async function lockMatching(dir) {
 function writeLock(path, lockObj) {
   writeFileSync(path, JSON.stringify(lockObj), 'utf8');
 }
+// round-2 实现审 codex LOW 采信：`${dir}.lock.json` 落在 dir 之外（故意，见各处注释），单独 rmrf(dir)
+// 不会删到它——多次跑金牌会在 tmpdir 残留多份孤儿锁文件。清理时锁文件路径与 buildMarkerPkg/mkdtempSync
+// 生成的 dir 同源拼出，一并回收。
+function rmrfWithLock(dir) {
+  rmrf(dir);
+  try { unlinkSync(`${dir}.lock.json`); } catch { /* ignore */ }
+}
 
 // 直接调用 boot 的 runCli/loadLib（不经 shim 文件），用 pkgDirOverride/lockPathOverride 注入故障——
 // 这是「测试走独立受测锁注入接缝」的实现方式：生产 shim 从不传这些 override，此路径仅测试可达。
-async function runCliDirect({ kind, script = 'gate.mjs', argv = [], pkgDirOverride, lockPathOverride }) {
+// spawnImpl 同理（round-1 实现审 A2 采信新增）：注入桩替身，确定性制造 spawnSync 的 r.error /
+// status===null 等否则无法跨平台稳定复现的返回态——生产 shim 从不传参，走真实 spawnSync。
+async function runCliDirect({ kind, script = 'gate.mjs', argv = [], pkgDirOverride, lockPathOverride, spawnImpl }) {
   const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4=' + Math.random());
-  return boot.runCli({ script, kind, argv, pkgDirOverride, lockPathOverride });
+  return boot.runCli({ script, kind, argv, pkgDirOverride, lockPathOverride, spawnImpl });
 }
 
 const KINDS = ['cli', 'guard', 'lint'];
@@ -336,6 +476,37 @@ async function assertDegradesAllKinds(name, faultFn) {
   }
 }
 
+// round-2 实现审 codex HIGH 采信：只断言退出码（64/2/0）不足以区分 D5 矩阵里判据不同但退出码相同的
+// 分支——例如 SPAWN_ERROR 与 NO_STATUS 在 cli/guard/lint 三态下的归一码完全一样，若生产代码误删
+// `if (r.error) {...}` 分支、让 r.error 桩落进 status===null 判据（两者都会把 status/signal 设为
+// null），退出码断言会照绿而测不出真实分支已经变了。改为额外捕获 degrade() 打到 console.log/error 的
+// 诊断文本，用 reasonPattern 断言其确实含该故障类别的判据字样（各 BootError.message 逐类不同），
+// 与退出码断言一并做「codes + reason」双重锁定。
+async function assertDegradesAllKindsWithReason(name, faultFn, reasonPattern) {
+  for (const kind of KINDS) {
+    await check('C4', `${name}（kind=${kind} → ${EXPECT_DEGRADE[kind]}，含降级判据文本核验）`, async () => {
+      const origLog = console.log;
+      const origError = console.error;
+      const captured = [];
+      console.log = (...args) => { captured.push(args.join(' ')); };
+      console.error = (...args) => { captured.push(args.join(' ')); };
+      let code;
+      try {
+        code = await faultFn(kind);
+      } finally {
+        console.log = origLog;
+        console.error = origError;
+      }
+      assert(code === EXPECT_DEGRADE[kind], `期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
+      const text = captured.join('\n');
+      assert(
+        reasonPattern.test(text),
+        `降级判据文本应匹配 ${reasonPattern}（与其它同码故障类别区分），实际捕获输出：${text || '(空，未捕获到任何诊断文本)'}`
+      );
+    });
+  }
+}
+
 await assertDegradesAllKinds('缺包目录', (kind) =>
   runCliDirect({ kind, pkgDirOverride: join(tmpdir(), 'loop-kit-does-not-exist-xyz'), lockPathOverride: KIT_LOCK }));
 
@@ -353,7 +524,7 @@ await check('C4', '身份锁失配（伪造漂移包）设置准备', async () =
       assert(code === EXPECT_DEGRADE[kind], `身份锁失配 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
     }
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
@@ -369,7 +540,7 @@ await check('C4', '清单外多余文件判失配', async () => {
       assert(code === EXPECT_DEGRADE[kind], `清单外多余文件 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
     }
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
@@ -386,7 +557,7 @@ await check('C4', '缺目标脚本（锁与包内容一致，但请求的脚本
       assert(code === EXPECT_DEGRADE[kind], `缺目标脚本 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
     }
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
@@ -400,7 +571,7 @@ await check('C4', '锁 JSON 损坏', async () => {
       assert(code === EXPECT_DEGRADE[kind], `锁 JSON 损坏 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
     }
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
@@ -419,7 +590,7 @@ await check('C4', '意外退出码（数值码，非 0/2）：cli 类原码透
     const lintCode = await runCliDirect({ kind: 'lint', script: 'oddexit.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
     assert(lintCode === 0, `lint 类应归一 0，实得 ${lintCode}`);
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
@@ -434,34 +605,87 @@ await check('C4', '「锁冻错」残余代价：锁与语法损坏脚本一致
     const code = await runCliDirect({ kind: 'cli', script: 'broken.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
     assert(code === 1, `语法损坏脚本对 Node 的默认退出码是 1，cli 类应原码透传，实得 ${code}`);
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
   }
 });
 
-await check('C4', '信号终止：cli 类以同信号自终（子进程 spawn 层面验证）', () => {
+await check('C4', '信号终止：cli 类经 boot.runCli 以同信号自终（外层包装进程行为级验证，round-1 实现审 A2）', async () => {
+  // round-1 实现审 A2 采信：此前的版本只直接 spawnSync selfkill.mjs，全程不经 boot.runCli——只验证了
+  // Node 自身的 spawnSync 信号语义，删掉 boot.mjs 里 process.kill(process.pid, r.signal) 那行该用例仍绿。
+  // 改为真调用 boot.runCli（无 shim 中间层，直接 import 真实 boot.mjs）驱动一个外层包装进程：boot 内部
+  // 对「同信号自终」的 process.kill 调用作用于该包装进程自身，由本测试从外部观察包装进程真的死于同信号。
   const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-signal-'));
+  const wrapperPath = join(tmpdir(), `loop-kit-c4-signal-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  try {
+    mkdirSync(join(dir, 'bin'), { recursive: true });
+    writeFileSync(join(dir, 'bin', 'selfkill.mjs'), '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n', 'utf8');
+    const lock = await lockMatching(dir);
+    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
+    writeLock(lockPath, lock);
+    const wrapperSrc = `import { pathToFileURL } from 'node:url';
+const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
+const code = boot.runCli({ script: 'selfkill.mjs', kind: 'cli', argv: [], pkgDirOverride: ${JSON.stringify(dir)}, lockPathOverride: ${JSON.stringify(lockPath)} });
+// 若执行到这里，说明 process.kill 未能真正终止本进程（理论上不应发生）——仍给个可观测退出码兜底。
+process.exit(code);
+`;
+    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
+    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', timeout: 4000 });
+    assert(
+      r.signal === 'SIGTERM',
+      `boot.runCli 应以子进程收到的同信号（SIGTERM）终止外层包装进程，实得 signal=${r.signal} status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`
+    );
+  } finally {
+    rmrfWithLock(dir);
+    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
+  }
+});
+
+await check('C4', '信号自终失败兜底码遵循 shell 128+n 语义（桩替换 process.kill，round-1 实现审 A7）', async () => {
+  // A7（LOW）：process.kill 自终失败的极端兜底路径此前 return 1，不符 128+n 语义。真实 process.kill
+  // 对自身 PID 发送有效信号名几乎不会失败，故用外层包装进程内 monkey-patch process.kill 强制其抛错
+  // （只影响该独立子进程，不污染本 golden 测试自身进程）来确定性驱动这条兜底分支。
+  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-signalfail-'));
+  const wrapperPath = join(tmpdir(), `loop-kit-c4-signalfail-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
   try {
     mkdirSync(join(dir, 'bin'), { recursive: true });
     writeFileSync(join(dir, 'bin', 'selfkill.mjs'), '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n', 'utf8');
-    const r = spawnSync(process.execPath, [join(dir, 'bin', 'selfkill.mjs')], { encoding: 'utf8', timeout: 4000 });
-    assert(r.signal === 'SIGTERM', `子进程应以 SIGTERM 终止，实得 signal=${r.signal} status=${r.status}`);
+    const lock = await lockMatching(dir);
+    const lockPath = `${dir}.lock.json`;
+    writeLock(lockPath, lock);
+    const wrapperSrc = `import { pathToFileURL } from 'node:url';
+const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
+const realKill = process.kill.bind(process);
+process.kill = (pid, signal) => { throw new Error('模拟 process.kill 自终失败'); };
+const code = boot.runCli({ script: 'selfkill.mjs', kind: 'cli', argv: [], pkgDirOverride: ${JSON.stringify(dir)}, lockPathOverride: ${JSON.stringify(lockPath)} });
+process.kill = realKill;
+console.log(JSON.stringify({ code }));
+`;
+    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
+    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', timeout: 4000 });
+    assert(r.status === 0, `包装进程本身应正常退出（process.kill 桩只影响返回值，不应让包装进程崩溃），实得 status=${r.status} signal=${r.signal}\nstderr=${r.stderr}`);
+    const { code } = JSON.parse(r.stdout.trim().split('\n').pop());
+    assert(code === 128 + 15, `SIGTERM 自终失败兜底码应为 128+15=143（shell 语义），实得 ${code}`);
   } finally {
-    rmrf(dir);
+    rmrfWithLock(dir);
+    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
   }
 });
 
-// boot 缺失 / boot 语法损坏 / boot 调用前中抛错：需真动 loop-kit/lib/boot.mjs 本体（信任根内），
-// 经真 shim 子进程验证「最小内联 try/catch 边界」——备份/替换/还原，绝不留污染。
-async function withSwappedBoot(brokenContent, fn) {
-  const hadBoot = existsSync(BOOT_PATH);
-  const backup = hadBoot ? readFileSync(BOOT_PATH) : null;
+// boot 缺失 / boot 语法损坏 / boot 调用前中抛错：需真动 boot.mjs 本体（信任根内），经真 shim 子进程
+// 验证「最小内联 try/catch 边界」。round-1 实现审 A4 采信：故障注入只动隔离消费树内的 boot.mjs 拷贝
+// （经 record.mjs 的 buildIsolatedTree 复制真实 loop-kit/ 得到），真实工作树 loop-kit/lib/boot.mjs
+// 全程只读——不再对真实文件备份/覆写/还原（非原子写在异常退出/并行读取窗口内曾有损坏真信任根的风险）。
+function withSwappedBootInTree(tree, brokenContent, fn) {
+  const bootPath = join(tree, 'loop-kit', 'lib', 'boot.mjs');
+  const hadBoot = existsSync(bootPath);
+  const backup = hadBoot ? readFileSync(bootPath) : null;
   try {
-    if (brokenContent === null) { if (hadBoot) unlinkSync(BOOT_PATH); }
-    else { mkdirSync(dirname(BOOT_PATH), { recursive: true }); writeFileSync(BOOT_PATH, brokenContent, 'utf8'); }
-    await fn();
+    if (brokenContent === null) { if (hadBoot) unlinkSync(bootPath); }
+    else { mkdirSync(dirname(bootPath), { recursive: true }); writeFileSync(bootPath, brokenContent, 'utf8'); }
+    return fn();
   } finally {
-    if (hadBoot) writeFileSync(BOOT_PATH, backup);
-    else { try { unlinkSync(BOOT_PATH); } catch { /* ignore */ } try { rmSync(dirname(BOOT_PATH), { recursive: true }); } catch { /* ignore */ } }
+    if (hadBoot) writeFileSync(bootPath, backup);
+    else { try { unlinkSync(bootPath); } catch { /* ignore */ } }
   }
 }
 
@@ -477,23 +701,29 @@ for (const [label, content] of [
       const src = readFileSync(join(SHIM_DIR, script), 'utf8');
       assert(src.includes("'../lib/boot.mjs'"), `${script} 现文件未引导 loop-kit/lib/boot.mjs（红基线：shim 尚未落成）`);
     }
-    await withSwappedBoot(content, () => {
-      const tmpContractFile = join(tmpdir(), `loop-kit-c4-contract-${Date.now()}.json`);
-      try { unlinkSync(tmpContractFile); } catch { /* ignore */ }
-      // guard 案需喂真被守卫的动作（写 lib/ 下文件）且用隔离槽（LOOP_CONTRACT_FILE），
-      // 不依赖/不触碰本 worktree 真实 loop/active-contract.json（其内容与本检查无关、不应耦合）。
-      const guardStdin = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'lib/x.mjs' } });
-      for (const [script, kind, expect, stdin, env] of [
-        ['gate.mjs', 'cli', 64, undefined, {}],
-        ['hook-loop-guard.mjs', 'guard', 2, guardStdin, { LOOP_CONTRACT_FILE: tmpContractFile }],
-        ['hook-stop.mjs', 'lint', 0, '{}', {}],
-      ]) {
-        const r = spawnSync(process.execPath, [join(SHIM_DIR, script)], {
-          cwd: ROOT, encoding: 'utf8', input: stdin, env: { PATH: process.env.PATH, ...env },
-        });
-        assert(r.status === expect, `${label} → ${script}（${kind}）期望 exit ${expect}，实得 ${r.status}（stderr=${r.stderr}）`);
-      }
-    });
+    const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
+    const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
+    try {
+      await withSwappedBootInTree(tree, content, () => {
+        const tmpContractFile = join(tmpdir(), `loop-kit-c4-contract-${Date.now()}.json`);
+        try { unlinkSync(tmpContractFile); } catch { /* ignore */ }
+        // guard 案需喂真被守卫的动作（写 lib/ 下文件）且用隔离槽（LOOP_CONTRACT_FILE），
+        // 不依赖/不触碰任何工作树真实 loop/active-contract.json（其内容与本检查无关、不应耦合）。
+        const guardStdin = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'lib/x.mjs' } });
+        for (const [script, kind, expect, stdin, env] of [
+          ['gate.mjs', 'cli', 64, undefined, {}],
+          ['hook-loop-guard.mjs', 'guard', 2, guardStdin, { LOOP_CONTRACT_FILE: tmpContractFile }],
+          ['hook-stop.mjs', 'lint', 0, '{}', {}],
+        ]) {
+          const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', script)], {
+            cwd: tree, encoding: 'utf8', input: stdin, env: { PATH: process.env.PATH, ...env },
+          });
+          assert(r.status === expect, `${label} → ${script}（${kind}）期望 exit ${expect}，实得 ${r.status}（stderr=${r.stderr}）`);
+        }
+      });
+    } finally {
+      destroyIsolatedTree(tree);
+    }
   });
 }
 
@@ -501,15 +731,161 @@ await check('C4', 'boot 调用前中抛错：shim 最小内联 try/catch 兜住
   const gateSrc = readFileSync(join(SHIM_DIR, 'gate.mjs'), 'utf8');
   assert(gateSrc.includes('boot.runCli') && gateSrc.includes('__fallbackDegrade'), 'gate.mjs 现文件未见 shim 模板的 boot.runCli 调用 + 兜底降级结构（红基线：shim 尚未落成）');
   const throwingBoot = 'export function runCli(){ throw new Error("模拟 boot 内部意外抛错"); }\nexport async function loadLib(){ throw new Error("模拟 boot 内部意外抛错"); }\n';
-  await withSwappedBoot(throwingBoot, () => {
-    const r = spawnSync(process.execPath, [join(SHIM_DIR, 'gate.mjs')], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH } });
-    assert(r.status === 64, `boot.runCli 抛错时 shim 应兜住并归一 exit 64（cli 类），实得 ${r.status}（stderr=${r.stderr}）`);
-  });
+  const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
+  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
+  try {
+    await withSwappedBootInTree(tree, throwingBoot, () => {
+      const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', 'gate.mjs')], { cwd: tree, encoding: 'utf8', env: { PATH: process.env.PATH } });
+      assert(r.status === 64, `boot.runCli 抛错时 shim 应兜住并归一 exit 64（cli 类），实得 ${r.status}（stderr=${r.stderr}）`);
+    });
+  } finally {
+    destroyIsolatedTree(tree);
+  }
+});
+
+// round-1 实现审 A2 采信：spawnSync 的 r.error（派生失败）与 status===null 且无信号无 error 两态，
+// 在真实 OS 上无法跨平台确定性构造（process.execPath 派生自身几乎不会失败；status===null 且无信号
+// 无 error 是 Node 文档列出的极端边缘态）。改走桩注入接缝（spawnImpl，仅测试可达、生产零跳过口，
+// 与 pkgDirOverride/lockPathOverride 同类）在真实 runCli 代码路径上行为级验证，取代此前的源码字符串断言。
+// round-2 实现审 codex HIGH 采信：这两态在 cli/guard/lint 三态下的归一退出码彼此相同（64/2/0）——
+// 只断言退出码时，若生产代码误删 `if (r.error) {...}` 分支、让 r.error 桩落进下面的
+// `typeof r.status !== 'number'` 判据（两者都会把 status 置为非 number），退出码完全不变、测试仍绿
+// （这正是 round-1 要消除的「删掉对应分支测试仍过」）。改用 assertDegradesAllKindsWithReason 额外核验
+// degrade() 打到 console 的诊断文本确实含各自专属判据字样，二者互斥、彼此不可混淆。
+await assertDegradesAllKindsWithReason(
+  'spawnSync 派生失败（r.error，桩注入行为级验证）',
+  (kind) => runCliDirect({
+    kind,
+    pkgDirOverride: EXPECTED_DIR,
+    lockPathOverride: KIT_LOCK,
+    spawnImpl: () => ({ error: new Error('模拟 spawn 派生失败'), status: null, signal: null }),
+  }),
+  /SPAWN_ERROR|子进程派生失败/
+);
+
+await assertDegradesAllKindsWithReason(
+  'status===null 且无信号无 error（桩注入行为级验证，取代源码字符串断言）',
+  (kind) => runCliDirect({
+    kind,
+    pkgDirOverride: EXPECTED_DIR,
+    lockPathOverride: KIT_LOCK,
+    spawnImpl: () => ({ error: null, status: null, signal: null }),
+  }),
+  /NO_STATUS|status=null 且无信号无 error/
+);
+
+await check('C4', '目标模块 import 抛错：boot.loadLib 原样冒泡该错误（不吞、不误判为其它降级类别）', async () => {
+  // plan §3 S3「目标模块 import 抛错」场景：库模式无 exit code 概念，抛错应直接向上冒泡给调用方
+  // （由调用方——shim 的 else 分支——决定是否再抛），不应被 boot 自身吞掉或误归类为锁/包故障。
+  assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
+  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-tgtthrow-'));
+  try {
+    mkdirSync(join(dir, 'bin'), { recursive: true });
+    mkdirSync(join(dir, 'lib'), { recursive: true });
+    writeFileSync(join(dir, 'bin', 'throwing.mjs'), "throw new Error('模拟目标模块 import 抛错');\n", 'utf8');
+    // boot.loadLib 在 import 目标脚本之前总先 import 包内 lib/root.mjs 完成 ROOT 认领——本测试包也要有它，
+    // 否则会在「认领」这一步就先因 lib/root.mjs 缺失而抛 MODULE_NOT_FOUND，测不到「目标脚本 import 抛错」这条分支。
+    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(dir, 'lib', 'root.mjs'));
+    const lock = await lockMatching(dir);
+    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
+    writeLock(lockPath, lock);
+    const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4tgtthrow=' + Math.random());
+    let threw = null;
+    try {
+      await boot.loadLib({ script: 'throwing.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
+    } catch (e) {
+      threw = e;
+    }
+    assert(threw, '目标模块 import 期间抛错应原样冒泡给调用方（库模式无 exit code 概念），不应被吞');
+    assert(/模拟目标模块 import 抛错/.test(String(threw && threw.message)), `应原样冒泡目标模块的错误，实得：${threw && threw.message}`);
+  } finally {
+    rmrfWithLock(dir);
+  }
+});
+
+await check('C4', '认领 API 抛错：ROOT 认领冲突发生在目标模块 import 之前，目标模块的副作用绝不执行', async () => {
+  // plan §3 S3「认领 API 抛错」场景，同时是「求值前认领」顺序的强证据：目标模块若真的被 import 了会
+  // 落一个哨兵文件；本检查制造一个真实的跨树 ROOT 冲突（先经真 shim 认领 treeA，再直接调用 boot.loadLib
+  // 指向另一个真实 Casey 树 ROOT），断言第二次调用抛出认领冲突错误、且哨兵文件从未被创建过。
+  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c4-claimthrow-treeA-'));
+  const sentinelPkgDir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-claimthrow-pkg-'));
+  const sentinelMarkerPath = join(tmpdir(), `loop-kit-c4-claimthrow-marker-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
+  const wrapperPath = join(tmpdir(), `loop-kit-c4-claimthrow-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  const sentinelLockPath = `${sentinelPkgDir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
+  try {
+    assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
+    mkdirSync(join(treeA, 'loop'), { recursive: true });
+    writeFileSync(join(treeA, 'loop', 'config.json'), '{}', 'utf8');
+    cpSync(join(ROOT, 'loop-kit'), join(treeA, 'loop-kit'), { recursive: true });
+
+    mkdirSync(join(sentinelPkgDir, 'bin'), { recursive: true });
+    mkdirSync(join(sentinelPkgDir, 'lib'), { recursive: true });
+    // 同上一个检查的理由：boot.loadLib 先 import 包内 lib/root.mjs 完成 ROOT 认领，此步骤（预期真的抛出
+    // 认领冲突）必须先能成功找到 lib/root.mjs，否则测到的是「模块缺失」而不是「认领冲突」。
+    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(sentinelPkgDir, 'lib', 'root.mjs'));
+    writeFileSync(
+      join(sentinelPkgDir, 'bin', 'sentinel.mjs'),
+      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(sentinelMarkerPath)}, 'imported', 'utf8');\n`,
+      'utf8'
+    );
+    const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
+    const { files } = hashTree(sentinelPkgDir);
+    writeFileSync(sentinelLockPath, JSON.stringify({ schemaVersion: 1, files }), 'utf8');
+
+    const wrapperSrc = `import { pathToFileURL } from 'node:url';
+// 先经真 shim（treeA）认领 ROOT=treeA。
+await import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
+const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
+let threw = null;
+try {
+  await boot.loadLib({ script: 'sentinel.mjs', pkgDirOverride: ${JSON.stringify(sentinelPkgDir)}, lockPathOverride: ${JSON.stringify(sentinelLockPath)} });
+} catch (e) { threw = String(e && e.message); }
+console.log(JSON.stringify({ threw }));
+`;
+    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
+    // treeA 的 shim 自身也要能解析到一个通过锁校验的真包——用 LOOP_KIT_PKG 指向真包（其 tmpdir 不是
+    // Casey 树的兄弟目录，隐式约定不可达）；boot.loadLib 的第二次调用显式传 pkgDirOverride，不受此环境变量影响。
+    const r = spawnSync(process.execPath, [wrapperPath], {
+      encoding: 'utf8',
+      env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
+    });
+    assert(r.status === 0, `包装进程本身应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
+    const out = JSON.parse(r.stdout.trim().split('\n').pop());
+    assert(out.threw, '第二次 loadLib（真实 ROOT 与已认领的 treeA 不同）应抛认领冲突错误，实际未抛');
+    assert(/认领冲突|RootResolutionError/.test(out.threw), `应为 ROOT 认领冲突结构化错误，实得：${out.threw}`);
+    assert(!existsSync(sentinelMarkerPath), '认领应在目标模块 import 之前失败——目标模块的副作用（哨兵文件）不应被创建，但探测到它存在了');
+  } finally {
+    rmrf(treeA);
+    rmrf(sentinelPkgDir);
+    try { unlinkSync(sentinelLockPath); } catch { /* ignore */ }
+    try { unlinkSync(sentinelMarkerPath); } catch { /* ignore */ }
+    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
+  }
 });
 
-await check('C4', 'status===null 且无信号无 error 的降级分类存在（源码级断言，spawnSync 无法确定性构造该态）', () => {
-  const src = readFileSync(BOOT_PATH, 'utf8');
-  assert(/typeof r\.status !== 'number'/.test(src), 'boot.mjs 应显式判 status 非数值（null 且无信号）态并归一降级——未见该判据');
+await check('C4', '特殊字符包路径（空格/#/%）：boot.loadLib 正确 import root.mjs 与目标模块（round-2 实现审 A6 回归测试）', async () => {
+  // round-1 A6 修复本身（file://${dir}/ 字符串拼接改 pathToFileURL(join(...))）是对的，但 round-1 未
+  // 真正补上「补空格/#/%路径用例」——round-2 实现审 codex MED 指出：若日后有人把 loadLib 退回字符串
+  // 拼接 URL，当前金牌仍会全绿。本检查把包放在同时含空格、#、% 的物理路径下，驱动 boot.loadLib 真实
+  // import root.mjs 与目标模块，钉死「两者都必须成功」这一行为，防止该退化再次悄悄发生。
+  assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
+  const specialDir = join(tmpdir(), `loop-kit c4 special #pkg%2Fdir ${Date.now()}-${Math.random().toString(36).slice(2)}`);
+  const specialLockPath = `${specialDir}.lock.json`;
+  try {
+    mkdirSync(join(specialDir, 'bin'), { recursive: true });
+    mkdirSync(join(specialDir, 'lib'), { recursive: true });
+    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(specialDir, 'lib', 'root.mjs'));
+    writeFileSync(join(specialDir, 'bin', 'marker.mjs'), 'export const MARKER = "special-path-ok";\n', 'utf8');
+    const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
+    const { files } = hashTree(specialDir);
+    writeFileSync(specialLockPath, JSON.stringify({ schemaVersion: 1, files }), 'utf8');
+    const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4special=' + Math.random());
+    const mod = await boot.loadLib({ script: 'marker.mjs', pkgDirOverride: specialDir, lockPathOverride: specialLockPath });
+    assert(mod.MARKER === 'special-path-ok', `应正确 import 特殊字符路径下的目标模块，实得 ${JSON.stringify(Object.keys(mod))}`);
+  } finally {
+    rmrf(specialDir);
+    try { unlinkSync(specialLockPath); } catch { /* ignore */ }
+  }
 });
 
 // ============================================================================
@@ -579,9 +955,29 @@ for (const goldenRel of Object.keys(C6_RERUN_ANCHOR.exitCodes)) {
 // ============================================================================
 // C7 — 根语义组（resolveRoot() 独立语义用例）
 // ============================================================================
-async function freshRootMod(tag) {
+// round-1 实现审 A1 采信后修订：认领槽从 root.mjs 模块顶层变量改为 globalThis[Symbol.for(...)]
+// 进程级共享位置——这是本次修复的核心目的（进程唯一 ROOT 真正跨模块实例成立），但也意味着此前
+// 「同一文件用不同 query 串 import 出独立模块实例、从而各自拿到一份新鲜 claimed」的测试隔离手法
+// 不再成立：任何两次 import 都会共享同一个 globalThis 槽。C7 每个场景因此改为在独立子进程里跑——
+// 子进程有自己的 globalThis，天然互不污染，且不依赖本 golden 进程自身是否已在别处（如 C1/C2）
+// 认领过 ROOT。runRootProbe(bodySrc) 是通用探针：把 bodySrc 接到「import 真包的 lib/root.mjs」
+// 之后拼成一个临时脚本、spawn 一个全新 Node 进程执行，探针脚本用 console.log(JSON.stringify(...))
+// 把结果传回，父进程解析最后一行 JSON 断言。
+function runRootProbe(bodySrc) {
   assert(existsSync(PKG_DIR), '真包不存在（红基线：包不存在、无 resolveRoot() 可测）');
-  return import(pathToFileURL(join(PKG_DIR, 'lib', 'root.mjs')).href + '?c7=' + tag + '-' + Math.random().toString(36).slice(2));
+  const probePath = join(tmpdir(), `loop-kit-c7-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  const rootUrl = pathToFileURL(join(PKG_DIR, 'lib', 'root.mjs')).href;
+  const src = `import { resolveRoot, claimedRoot, RootResolutionError } from ${JSON.stringify(rootUrl)};\n${bodySrc}\n`;
+  writeFileSync(probePath, src, 'utf8');
+  try {
+    return spawnSync(process.execPath, [probePath], { encoding: 'utf8' });
+  } finally {
+    try { unlinkSync(probePath); } catch { /* ignore */ }
+  }
+}
+function lastJson(stdout) {
+  const lines = stdout.trim().split('\n');
+  return JSON.parse(lines[lines.length - 1] || '{}');
 }
 function markerRootDir(base) {
   const d = join(base, 'marker-root');
@@ -590,12 +986,16 @@ function markerRootDir(base) {
   return d;
 }
 
-await check('C7', 'env 有效命中：realpath 规范化后返回', async () => {
+await check('C7', 'env 有效命中：realpath 规范化后返回', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
   try {
     const dirA = markerRootDir(tmp);
-    const { resolveRoot } = await freshRootMod('env-valid');
-    const got = resolveRoot({ envRoot: dirA, cwd: tmp });
+    const r = runRootProbe(`
+const got = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
+console.log(JSON.stringify({ got }));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
+    const { got } = lastJson(r.stdout);
     assert(existsSync(got), 'resolveRoot 返回值应是存在的目录');
     assert(got.endsWith('marker-root') || got.includes('marker-root'), `应指向 dirA，实得 ${got}`);
   } finally {
@@ -603,102 +1003,298 @@ await check('C7', 'env 有效命中：realpath 规范化后返回', async () =>
   }
 });
 
-await check('C7', 'env 无效立即失败，绝不静默回退到 cwd 上溯', async () => {
+await check('C7', 'env 无效立即失败，绝不静默回退到 cwd 上溯', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
   try {
     const validCwdRoot = markerRootDir(join(tmp, 'valid-for-cwd'));
-    const { resolveRoot } = await freshRootMod('env-invalid');
-    let threw = false;
-    try {
-      resolveRoot({ envRoot: join(tmp, 'does-not-exist'), cwd: validCwdRoot });
-    } catch (e) {
-      threw = true;
-      assert(/RootResolutionError|不存在/.test(String(e.message)), `应为结构化错误，实得：${e}`);
-    }
+    const r = runRootProbe(`
+let threw = false, message = '';
+try {
+  resolveRoot({ envRoot: ${JSON.stringify(join(tmp, 'does-not-exist'))}, cwd: ${JSON.stringify(validCwdRoot)} });
+} catch (e) {
+  threw = true; message = String(e.message);
+}
+console.log(JSON.stringify({ threw, message }));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const { threw, message } = lastJson(r.stdout);
     assert(threw, 'env 无效时应立即抛错，不应静默回退到 cwd 上溯成功返回');
+    assert(/RootResolutionError|不存在/.test(message), `应为结构化错误，实得：${message}`);
   } finally {
     rmrf(tmp);
   }
 });
 
-await check('C7', '上溯命中根标记：cwd 逐级向上找到 loop/config.json', async () => {
+await check('C7', '上溯命中根标记：cwd 逐级向上找到 loop/config.json', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
   try {
     const rootDir = markerRootDir(tmp);
     const nested = join(rootDir, 'a', 'b', 'c');
     mkdirSync(nested, { recursive: true });
-    const { resolveRoot } = await freshRootMod('upward-hit');
     // envRoot 传 ''（非 undefined）强制走「缺席」分支——JS 默认参数在显式传 undefined 时仍会取
-    // process.env.LOOP_KIT_ROOT，而本金牌作为 gate story acceptance 子进程运行时会从「shim spawnSync
-    // 注入 env → 包 gate.mjs execSync 继承」这条链路真实继承到该变量，必须显式绕开、不依赖环境干净。
-    const got = resolveRoot({ envRoot: '', cwd: nested });
+    // process.env.LOOP_KIT_ROOT，探针子进程若从本 golden 进程继承到该变量，必须显式绕开、不依赖环境干净。
+    const r = runRootProbe(`
+const got = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(nested)} });
+console.log(JSON.stringify({ got }));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const { got } = lastJson(r.stdout);
     assert(got.includes('marker-root'), `应上溯命中 rootDir，实得 ${got}`);
   } finally {
     rmrf(tmp);
   }
 });
 
-await check('C7', '上溯无标记抛结构化错误（不终止宿主进程）', async () => {
+await check('C7', '上溯无标记抛结构化错误（不终止宿主进程）', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-noanchor-'));
   try {
-    const { resolveRoot, RootResolutionError } = await freshRootMod('upward-miss');
-    let caught = null;
-    try {
-      resolveRoot({ envRoot: '', cwd: tmp }); // '' 强制走缺席分支，见上一检查同注
-    } catch (e) {
-      caught = e;
-    }
-    assert(caught, '无标记时应抛错，不应返回');
-    assert(caught instanceof Error, '应是 Error 实例（结构化，非 process.exit）');
-    assert(!RootResolutionError || caught.name === 'RootResolutionError', `错误类型应为 RootResolutionError，实得 ${caught.name}`);
+    const r = runRootProbe(`
+let threw = false, isErrorInstance = false, isRootResolutionError = false, name = '';
+try {
+  resolveRoot({ envRoot: '', cwd: ${JSON.stringify(tmp)} }); // '' 强制走缺席分支，见上一检查同注
+} catch (e) {
+  threw = true;
+  isErrorInstance = e instanceof Error;
+  name = e.name;
+  isRootResolutionError = !RootResolutionError || e.name === 'RootResolutionError';
+}
+console.log(JSON.stringify({ threw, isErrorInstance, isRootResolutionError, name }));
+`);
+    // 探针进程本身应正常退出（status 0）——这本身就证明 resolveRoot 未调用 process.exit 终止宿主进程。
+    assert(r.status === 0, `探针子进程应正常退出（若 resolveRoot 误用 process.exit 终止宿主进程，这里就不会是 0），实得 ${r.status}\nstderr=${r.stderr}`);
+    const { threw, isErrorInstance, isRootResolutionError, name } = lastJson(r.stdout);
+    assert(threw, '无标记时应抛错，不应返回');
+    assert(isErrorInstance, '应是 Error 实例（结构化，非 process.exit）');
+    assert(isRootResolutionError, `错误类型应为 RootResolutionError，实得 ${name}`);
   } finally {
     rmrf(tmp);
   }
 });
 
-await check('C7', 'realpath 规范化：经软链解析后返回真实路径', async () => {
+await check('C7', 'realpath 规范化：经软链解析后返回真实路径', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-symlink-'));
   try {
     const realDir = markerRootDir(join(tmp, 'real-target'));
     const linkPath = join(tmp, 'link-to-root');
     symlinkSync(realDir, linkPath, 'dir');
-    const { resolveRoot } = await freshRootMod('realpath');
-    const got = resolveRoot({ envRoot: linkPath, cwd: tmp });
-    assert(got !== linkPath, 'resolveRoot 不应原样返回软链路径');
+    const r = runRootProbe(`
+const got = resolveRoot({ envRoot: ${JSON.stringify(linkPath)}, cwd: ${JSON.stringify(tmp)} });
+console.log(JSON.stringify({ got, sameAsLink: got === ${JSON.stringify(linkPath)} }));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const { got, sameAsLink } = lastJson(r.stdout);
+    assert(!sameAsLink, 'resolveRoot 不应原样返回软链路径');
     assert(got.includes('real-target'), `应解析到真实目标，实得 ${got}`);
   } finally {
     rmrf(tmp);
   }
 });
 
-await check('C7', '原子认领：首认领成立、同根幂等、异根立即抛、认领后不可变；探针回报认领值', async () => {
+await check('C7', '原子认领：首认领成立、同根幂等、异根立即抛、认领后不可变；探针回报认领值', () => {
   const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-claim-'));
   try {
     const dirA = markerRootDir(join(tmp, 'a'));
     const dirB = markerRootDir(join(tmp, 'b'));
-    const { resolveRoot, claimedRoot } = await freshRootMod('claim');
-    assert(claimedRoot() === null, '未认领时探针应返回 null');
-    const first = resolveRoot({ envRoot: dirA, cwd: tmp });
-    assert(claimedRoot() === first, '首认领后探针应回报认领值');
-    const again = resolveRoot({ envRoot: dirA, cwd: tmp });
-    assert(again === first, '同根幂等：重复解析应返回同一值');
-    let conflictThrew = false;
-    try {
-      resolveRoot({ envRoot: dirB, cwd: tmp });
-    } catch (e) {
-      conflictThrew = true;
-      assert(/认领冲突/.test(e.message), `异根应抛认领冲突错误，实得：${e.message}`);
-    }
-    assert(conflictThrew, '异根解析应立即抛错');
-    assert(claimedRoot() === first, '认领后不可变：失败的异根尝试不应更新认领值');
-    // envRoot 省略 + 已认领 → 幂等直接复用，不依赖 cwd 恰好匹配（库模式核心防线）
-    const viaOmitted = resolveRoot({ envRoot: '', cwd: join(tmp, '完全不相关且无标记的路径') });
-    assert(viaOmitted === first, '已认领时省略 envRoot 应直接复用认领值，不依赖 cwd 上溯');
+    const unrelated = join(tmp, '完全不相关且无标记的路径');
+    // 本检查的多步（首认领/幂等/冲突/不可变/省略 envRoot 复用）刻意都在同一个子进程内依次调用
+    // resolveRoot——这正是要测的「同进程内」不变量本身，故不拆到更多子进程，只在外层用一个子进程隔离。
+    const r = runRootProbe(`
+const results = {};
+results.initialClaimedNull = claimedRoot() === null;
+const first = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
+results.probeAfterFirst = claimedRoot() === first;
+const again = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
+results.idempotent = again === first;
+let conflictThrew = false, conflictMsgOk = false;
+try {
+  resolveRoot({ envRoot: ${JSON.stringify(dirB)}, cwd: ${JSON.stringify(tmp)} });
+} catch (e) {
+  conflictThrew = true;
+  conflictMsgOk = /认领冲突/.test(e.message);
+}
+results.conflictThrew = conflictThrew;
+results.conflictMsgOk = conflictMsgOk;
+results.claimUnchangedAfterConflict = claimedRoot() === first;
+const viaOmitted = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(unrelated)} });
+results.omittedReusesClaim = viaOmitted === first;
+console.log(JSON.stringify(results));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const out = lastJson(r.stdout);
+    assert(out.initialClaimedNull, '未认领时探针应返回 null');
+    assert(out.probeAfterFirst, '首认领后探针应回报认领值');
+    assert(out.idempotent, '同根幂等：重复解析应返回同一值');
+    assert(out.conflictThrew, '异根解析应立即抛错');
+    assert(out.conflictMsgOk, '异根应抛认领冲突错误（消息应含「认领冲突」）');
+    assert(out.claimUnchangedAfterConflict, '认领后不可变：失败的异根尝试不应更新认领值');
+    assert(out.omittedReusesClaim, '已认领时省略 envRoot 应直接复用认领值，不依赖 cwd 上溯');
+  } finally {
+    rmrf(tmp);
+  }
+});
+
+await check('C7', '槽内容不可信防线：外部预置的无效值不被幂等复用照单全收（round-2 实现审 A1）', () => {
+  // codex round-2 实测复现：globalThis[Symbol.for('loop-kit:root:claimed')] = '/preseeded' 后，
+  // resolveRoot({envRoot:''}) 旧版会直接返回未经校验的 '/preseeded'。本检查钉死修复后的行为：
+  // 复用前重新校验，槽内容不存在/无根标记时立即抛错，不会被当成「已验证过」而照单全收。
+  const r = runRootProbe(`
+let threw = false, message = '';
+globalThis[Symbol.for('loop-kit:root:claimed')] = '/this-path-almost-certainly-does-not-exist-xyz';
+try {
+  resolveRoot({ envRoot: '', cwd: '/tmp' });
+} catch (e) {
+  threw = true; message = String(e.message);
+}
+console.log(JSON.stringify({ threw, message }));
+`);
+  assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+  const { threw, message } = lastJson(r.stdout);
+  assert(threw, '外部预置的无效槽值在幂等复用时应被拒绝，不应静默返回');
+  assert(/RootResolutionError|不存在/.test(message), `应为结构化错误，实得：${message}`);
+});
+
+await check('C7', '认领后不可变：外部直接改写 globalThis 槽会被冻结拒绝（round-2 实现审 A1）', () => {
+  // globalThis[Symbol.for(...)] 一旦公开，同进程任何代码都能读写——首次认领后必须冻结该属性，
+  // 否则「认领后不可变」只是本模块自身遵守的君子协定，同进程其它代码仍可静默替换认领值。
+  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-freeze-'));
+  try {
+    const dirA = markerRootDir(tmp);
+    const r = runRootProbe(`
+const first = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
+let tamperThrew = false;
+try {
+  globalThis[Symbol.for('loop-kit:root:claimed')] = '/tampered-after-claim';
+} catch (e) {
+  tamperThrew = true;
+}
+console.log(JSON.stringify({ first, tamperThrew, stillClaimed: claimedRoot() }));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const out = lastJson(r.stdout);
+    assert(out.tamperThrew, '首认领后，同进程其它代码直接改写 globalThis 槽应被冻结拒绝（抛错），实际未抛');
+    assert(out.stillClaimed === out.first, `认领值应在改写尝试后保持不变，实得 ${out.stillClaimed}（应为 ${out.first}）`);
   } finally {
     rmrf(tmp);
   }
 });
 
+await check('C7', '外部预置合法 ROOT 后再改写另一合法 ROOT：应在首次被信任使用时就地补冻结，不给「两个合法值间来回切换」留窗口（round-2 第二轮实现审 codex HIGH）', () => {
+  // codex round-2 第二轮独立探针实测复现的缺口：此前的冻结只挂在「从空槽写入」这一条路径（claimAtomic
+  // 的 current===null 分支）上——外部若用普通赋值预置一个已经合法、规范化的 ROOT，resolveRoot 的幂等
+  // 复用路径会校验通过并接受它，但从未走到 writeClaimed()，属性仍可写；外部随后可再悄悄换成另一个同样
+  // 合法的 ROOT，下次复用又校验通过——同一进程先后「认领」了两个不同的合法值，违反「首次认领后不可变」。
+  // 本检查钉死修复：只要某个槽值被首次信任使用（无论是从空槽写入、还是幂等复用一个外部预置的合法值），
+  // 该属性此刻起必须已是冻结形态，此后任何改写尝试都应被拒绝。
+  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-preseed-swap-'));
+  try {
+    const dirA = markerRootDir(join(tmp, 'a'));
+    const dirB = markerRootDir(join(tmp, 'b'));
+    const r = runRootProbe(`
+// 外部普通赋值预置一个合法 ROOT（不经 claimAtomic/writeClaimed）。
+globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirA)};
+const before = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
+const first = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(tmp)} }); // 幂等复用路径应就地补冻结
+const after = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
+let swapThrew = false;
+try {
+  globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirB)}; // 尝试换成另一个同样合法的 ROOT
+} catch (e) {
+  swapThrew = true;
+}
+console.log(JSON.stringify({
+  beforeWasWritable: before.writable, first, afterIsFrozen: after.writable === false && after.configurable === false,
+  swapThrew, stillClaimed: claimedRoot(),
+}));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const out = lastJson(r.stdout);
+    assert(out.beforeWasWritable, '外部普通赋值预置的属性理应是可写的（测试前提校验）');
+    assert(out.first.includes('a'), `幂等复用应接受外部预置的合法值 dirA，实得 ${out.first}`);
+    assert(out.afterIsFrozen, '幂等复用一个此前未被本模块冻结的合法值后，该属性此刻起应已是冻结形态');
+    assert(out.swapThrew, '冻结之后尝试换成另一个同样合法的 ROOT 应被拒绝（抛错），实际未抛——两个合法值之间的静默切换窗口未关闭');
+    assert(out.stillClaimed === out.first, `认领值应保持为最初信任使用的那个值，实得 ${out.stillClaimed}（应为 ${out.first}）`);
+  } finally {
+    rmrf(tmp);
+  }
+});
+
+await check('C7', '外部预置合法 ROOT 后再改写：显式 envRoot 同值路径（claimAtomic）同样应就地补冻结（round-2 第三轮实现审 codex MED）', () => {
+  // codex round-2 第三轮独立复现：上一检查只覆盖「省略 envRoot」的幂等复用路径（revalidateClaimed）；
+  // 「显式 envRoot 恰好等于外部预置槽值」这条路径走的是 claimAtomic() 的同值分支（current===candidate），
+  // 是与前者不同的代码路径——mutation 测试证实只删掉 claimAtomic() 里的 adoptAndFreezeIfNeeded(current)
+  // 调用，该路径的换根漏洞会重新出现，而现有断言（只测省略路径）测不出这个回退。本检查专门钉死显式路径。
+  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-preseed-swap-explicit-'));
+  try {
+    const dirA = markerRootDir(join(tmp, 'a'));
+    const dirB = markerRootDir(join(tmp, 'b'));
+    const r = runRootProbe(`
+// 外部普通赋值预置一个合法 ROOT（不经 claimAtomic/writeClaimed）。
+globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirA)};
+const before = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
+// 显式 envRoot 恰好等于槽内已预置的值——走 claimAtomic() 的同值分支，不是 revalidateClaimed()。
+const first = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
+const after = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
+let swapThrew = false;
+try {
+  globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirB)}; // 尝试换成另一个同样合法的 ROOT
+} catch (e) {
+  swapThrew = true;
+}
+console.log(JSON.stringify({
+  beforeWasWritable: before.writable, first, afterIsFrozen: after.writable === false && after.configurable === false,
+  swapThrew, stillClaimed: claimedRoot(),
+}));
+`);
+    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
+    const out = lastJson(r.stdout);
+    assert(out.beforeWasWritable, '外部普通赋值预置的属性理应是可写的（测试前提校验）');
+    assert(out.first.includes('a'), `显式 envRoot 同值分支应接受外部预置的合法值 dirA，实得 ${out.first}`);
+    assert(out.afterIsFrozen, '显式 envRoot 同值分支复用一个此前未被本模块冻结的合法值后，该属性此刻起应已是冻结形态');
+    assert(out.swapThrew, '冻结之后尝试换成另一个同样合法的 ROOT 应被拒绝（抛错），实际未抛——显式 envRoot 路径的静默切换窗口未关闭');
+    assert(out.stillClaimed === out.first, `认领值应保持为最初信任使用的那个值，实得 ${out.stillClaimed}（应为 ${out.first}）`);
+  } finally {
+    rmrf(tmp);
+  }
+});
+
+await check('C7', '非主线程拒绝：worker_threads 内调用 resolveRoot() 应显式拒绝，不静默各自认领（round-2 实现审 A1）', () => {
+  // worker_threads 的每个 Worker 有独立 globalThis，本机制无法跨 Worker 协调认领——codex round-2 用两个
+  // Worker 各自成功认领不同 ROOT、零冲突复现了这一点。本仓与消费侧均未使用 worker_threads（已 grep
+  // 核验零命中），修复方向是让非主线程调用显式失败，而不是让各 Worker 静默各自认领造成假象。
+  assert(existsSync(PKG_DIR), '真包不存在');
+  const workerSrc = `import { parentPort } from 'node:worker_threads';
+import { pathToFileURL } from 'node:url';
+const rootMod = await import(pathToFileURL(${JSON.stringify(join(PKG_DIR, 'lib', 'root.mjs'))}).href);
+let threw = null;
+try {
+  rootMod.resolveRoot({ envRoot: process.env.LOOP_KIT_ROOT || '', cwd: process.cwd() });
+} catch (e) {
+  threw = String(e && e.message);
+}
+parentPort.postMessage({ threw });
+`;
+  const workerPath = join(tmpdir(), `loop-kit-c7-worker-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  const mainSrc = `import { Worker } from 'node:worker_threads';
+const w = new Worker(${JSON.stringify(workerPath)});
+w.on('message', (msg) => { console.log(JSON.stringify(msg)); w.terminate(); });
+w.on('error', (e) => { console.log(JSON.stringify({ workerError: String(e && e.message) })); });
+`;
+  const mainPath = join(tmpdir(), `loop-kit-c7-worker-main-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
+  writeFileSync(workerPath, workerSrc, 'utf8');
+  writeFileSync(mainPath, mainSrc, 'utf8');
+  try {
+    const r = spawnSync(process.execPath, [mainPath], { encoding: 'utf8' });
+    assert(r.status === 0, `外层进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
+    const out = lastJson(r.stdout);
+    assert(!out.workerError, `Worker 自身不应崩溃（应是 resolveRoot 内部抛错并被捕获回传），实得 workerError=${out.workerError}`);
+    assert(out.threw, 'worker_threads 内调用 resolveRoot() 应抛错拒绝，不应静默返回某个认领值');
+    assert(/主线程|worker_threads|isMainThread/.test(out.threw), `应为「仅支持主线程」的结构化错误，实得：${out.threw}`);
+  } finally {
+    try { unlinkSync(workerPath); } catch { /* ignore */ }
+    try { unlinkSync(mainPath); } catch { /* ignore */ }
+  }
+});
+
 // ============================================================================
 // 汇总
 // ============================================================================
diff --git a/tests/fixtures/loop-kit-expected/baseline/normalize.mjs b/tests/fixtures/loop-kit-expected/baseline/normalize.mjs
index 72f0c0b..c58da63 100644
--- a/tests/fixtures/loop-kit-expected/baseline/normalize.mjs
+++ b/tests/fixtures/loop-kit-expected/baseline/normalize.mjs
@@ -1,13 +1,31 @@
 #!/usr/bin/env node
 // normalize.mjs —— 观测基线规范化器（自身入 prd 冻结面，plan.md D7 C2）。
-// 字段级白名单：只替换两类逐一登记的易变值——① 隔离树自身绝对根路径 → <TREE_ROOT>；
-// ② ISO 8601 时间戳（如 breaker --reset 写入 .breaker-state.json 的 startedAt）→ <TIMESTAMP>。
-// 白名单之外一字不动；反向扰动用例（证明本规范化不吞真实差异）见 tests/_golden/loop-kit-extract.golden.mjs C2。
-const TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
+// 字段级白名单（round-1 实现审 A5 收严后版本）：只替换两类逐一登记的字段，按结构化路径定位、
+// 不对整份结果做 JSON.stringify 后的全局正则扫描——白名单之外一字不动，防止吞掉 stdout/stderr
+// 或任意文件内容里本应参与比对的真实业务差异（哪怕它们碰巧长得像时间戳/路径）。
+//   ① raw.stdout / raw.stderr —— 隔离树自身绝对根路径字面量 → <TREE_ROOT>（仅这两个顶层字段）；
+//   ② raw.tree.contents['loop/.breaker-state.json'] 的 startedAt 字段 —— ISO 8601 时间戳 → <TIMESTAMP>
+//     （按文件路径 + 字段名双重限定的字符串替换，不解析/重排该文件其余内容，保持字节形状不变）。
+// 反向扰动用例（证明本规范化不吞真实差异，含白名单外时间戳类差异）见
+// tests/_golden/loop-kit-extract.golden.mjs C2。
+const STARTED_AT_FIELD_RE = /("startedAt":\s*")[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z(")/;
+const BREAKER_STATE_PATH = 'loop/.breaker-state.json';
 
-export function normalize(raw, { treeRoot }) {
-  let text = JSON.stringify(raw);
-  if (treeRoot) text = text.split(treeRoot).join('<TREE_ROOT>');
-  text = text.replace(TIMESTAMP_RE, '<TIMESTAMP>');
-  return JSON.parse(text);
+function replaceTreeRoot(value, treeRoot) {
+  if (typeof value !== 'string' || !treeRoot) return value;
+  return value.split(treeRoot).join('<TREE_ROOT>');
+}
+
+export function normalize(raw, { treeRoot } = {}) {
+  const out = JSON.parse(JSON.stringify(raw)); // 深拷贝：不改调用方原对象，其余字段原样透传
+  out.stdout = replaceTreeRoot(out.stdout, treeRoot);
+  out.stderr = replaceTreeRoot(out.stderr, treeRoot);
+  const contents = out.tree && out.tree.contents;
+  if (contents && Object.prototype.hasOwnProperty.call(contents, BREAKER_STATE_PATH)) {
+    const original = contents[BREAKER_STATE_PATH];
+    if (typeof original === 'string' && STARTED_AT_FIELD_RE.test(original)) {
+      contents[BREAKER_STATE_PATH] = original.replace(STARTED_AT_FIELD_RE, '$1<TIMESTAMP>$2');
+    }
+  }
+  return out;
 }
diff --git a/tests/fixtures/loop-kit-expected/package/lib/root.mjs b/tests/fixtures/loop-kit-expected/package/lib/root.mjs
index 84a423f..0454337 100644
--- a/tests/fixtures/loop-kit-expected/package/lib/root.mjs
+++ b/tests/fixtures/loop-kit-expected/package/lib/root.mjs
@@ -1,19 +1,59 @@
 #!/usr/bin/env node
 // lib/root.mjs — loop-kit 包内 ROOT 解析与原子认领单点（提取后包内唯一新增逻辑面，GRILL D4）。
 //
-// 语义（评审 M2/M3/R2-H3 收严后版本）：
+// 语义（评审 M2/M3/R2-H3 + round-1/round-2 实现审收严后版本）：
 //   1. LOOP_KIT_ROOT（显式参数 envRoot，缺省读同名环境变量）在场则必须有效——目录存在 + 含
 //      loop/config.json 根标记 + realpath 规范化；无效立即失败，绝不静默回退到 cwd 上溯。
-//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）；否则自 cwd
-//      （缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
+//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）——复用前重新校验该
+//      值仍存在且仍带根标记（round-2 实现审 A1 采信：不可对 globalThis 槽内容照单全收，见下）；否则自
+//      cwd（缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
 //   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
 //      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
 //   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
 //      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
 //      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
 //   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
+//   6. 仅支持 Node 主线程；worker_threads 的独立 Worker 各有独立 globalThis，本机制无法跨 Worker
+//      协调认领（round-2 实现审 A1 采信：见下）——非主线程调用直接拒绝，不产生「各自静默认领互不冲突」
+//      的假象。
+//
+//   认领槽存储位置（round-1 实现审 A1 采信后修订）：认领值存在 globalThis[Symbol.for(...)] ——
+//   进程级共享位置，而非本模块的顶层 let 变量。原因：包可能以多个不同的物理目录被加载（如两棵
+//   消费树各自的兄弟目录约定解析到不同包副本、或显式 LOOP_KIT_PKG 指向另一份包拷贝）——不同物理
+//   路径对 ESM 而言是不同的 file:// URL，会各自得到独立的模块实例；若认领槽是模块顶层变量，则
+//   「进程唯一 ROOT」只在两次加载解析到同一物理包目录（同一模块实例）时成立，两树解析到不同包
+//   目录时防线静默不在场（同进程可各自认领不同 ROOT，零冲突）——这与本节语义 4 的「进程唯一」直接
+//   矛盾。Symbol.for() 使用全局符号注册表，同一键名在同进程内任何模块实例中都解析到同一 Symbol，
+//   故 globalThis[Symbol.for(...)] 是真正意义上的进程级单例存储，与「加载自哪个物理文件」无关。
+//
+//   round-2 实现审两处加固（codex HIGH 采信）：
+//   ① worker_threads 边界：globalThis 按 JS 执行环境（Node 主线程 / 每个 Worker）独立，不是操作系统
+//      进程级共享——同进程内的两个 Worker 各有独立 globalThis，会各自静默认领不同 ROOT、互不冲突，
+//      与语义 4 矛盾。本仓与消费侧 casey 代码库均未使用 worker_threads（已用 grep 核验零命中）；
+//      为避免「看似成立、实则在 Worker 场景下静默违反不变量」，resolveRoot() 在非主线程直接拒绝，把
+//      未支持的执行环境变成显式失败而非静默错误——若未来确需 Worker 内消费本包，须先设计跨 Worker
+//      协调机制（如经 SharedArrayBuffer/Atomics 或专用 broker）并重新评估本假设，不能绕过此拒绝。
+//   ② 槽内容不可信问题：globalThis[Symbol.for(...)] 一旦公开，同进程内任何代码都能读写（不像模块
+//      顶层变量那样只能经本模块导出的函数触达）——若外部代码在本模块首次认领前预置一个不存在/无根
+//      标记的值，旧版会不经校验直接复用。现改为：a) 首次认领后用 Object.defineProperty 冻结该属性
+//      （writable:false/configurable:false），本模块自身的合法流程只会在「尚未认领」时写一次，此后
+//      同进程任何代码（含本模块自身）再尝试赋值都会在严格模式下抛 TypeError，不会静默覆盖；
+//      b) 幂等复用路径（语义 2）每次复用前都重新对槽内容跑一遍与首次认领相同的校验（存在性 + 根标记 +
+//      realpath），槽内容不存在/无标记/被非常规篡改会在复用时立即抛错，不会被当成「已验证过」而照单
+//      全收。两者合力：认领后无法被同进程其它代码静默替换，认领前的伪造值也过不了复用校验。
+//
+//   round-2 第二轮实现审加固（codex HIGH 采信）：上述 ②a 的冻结只挂在「从空槽写入」这一条代码路径
+//   （claimAtomic 的 current===null 分支）上——若外部先用普通赋值预置一个「合法、规范化」的 ROOT
+//   （存在 + 有根标记 + 已是 realpath 形态），复用路径/同值路径会校验通过并接受它，但从未走到
+//   writeClaimed()，属性仍可写，外部随后可再悄悄改写成另一个同样合法的 ROOT——两次合法值之间的静默
+//   切换，独立探针实测复现（同一主线程进程先后接受两个不同的真实合法目录）。修复：不再只在「从空槽
+//   写入」时冻结，而是在任何代码路径打算把某个槽值当「已认领」使用（幂等复用 revalidateClaimed()、
+//   同值复用 claimAtomic()）之前，先查属性描述符是否已不可写/不可配置（isClaimSlotFrozen()），
+//   不是则当场补冻结（adoptAndFreezeIfNeeded()）——把「首次被信任使用的时刻」当作认领时刻，不局限于
+//   「首次从空槽写入」这一种途径，堵死「两个合法值之间来回切换」的窗口。
 import { existsSync, realpathSync } from 'node:fs';
 import { dirname, join, resolve } from 'node:path';
+import { isMainThread } from 'node:worker_threads';
 
 export class RootResolutionError extends Error {
   constructor(message) {
@@ -22,7 +62,48 @@ export class RootResolutionError extends Error {
   }
 }
 
-let claimed = null; // 进程唯一认领值（realpath 规范化后的绝对路径字符串）；null=未认领
+// 进程级共享认领槽——键名含包名与用途，降低与其它代码的 Symbol.for 键碰撞概率。
+const CLAIM_KEY = Symbol.for('loop-kit:root:claimed');
+
+function readClaimed() {
+  const v = globalThis[CLAIM_KEY];
+  return v === undefined ? null : v;
+}
+
+// 首次认领后冻结该 globalThis 属性——同进程内（含本模块自身）此后任何再赋值尝试都会在 ESM 的严格
+// 模式下抛 TypeError，不会静默覆盖已认领的值（round-2 实现审 A1 采信）。正常流程下 claimAtomic() 只在
+// current===null 时调用本函数一次，故这里的冻结不会与自身的合法调用冲突。
+function writeClaimed(v) {
+  try {
+    Object.defineProperty(globalThis, CLAIM_KEY, {
+      value: v, writable: false, configurable: false, enumerable: false,
+    });
+  } catch (e) {
+    throw new RootResolutionError(`进程级认领槽写入失败（可能已被外部代码以不兼容方式预置）：${e.message}`);
+  }
+}
+
+// 槽当前是否已是不可写/不可配置的冻结形态（round-2 第二轮实现审 codex HIGH 采信）。缺口：外部若在
+// 本模块首次认领前，用普通赋值预置一个「合法、规范化」的 ROOT（存在 + 有根标记 + 已是 realpath），
+// revalidateClaimed()/claimAtomic() 的「同值直接复用」分支会校验通过并接受它——但从未经过
+// writeClaimed()，属性仍是 writable:true/configurable:true，外部随后可再次悄悄改写成另一个同样合法
+// 的 ROOT，下次复用又校验通过、静默换根，「首次认领后不可变」名存实亡（codex 独立探针实测复现：同一
+// 主线程进程先后接受两个不同合法 ROOT）。修复：任何代码路径只要打算把某个槽值当「已认领」使用，先检查
+// 该属性是否已不可写/不可配置；不是则就地补冻结（把「首次真正被信任使用的时刻」当认领时刻，而不是只认
+// 「经由 claimAtomic 从空槽写入」这一条路径），此后同样不可被普通赋值覆盖。
+// 命名说明（round-2 第三轮实现审 codex LOW 采信）：本函数只能证明「属性当前已不可写/不可配置」，不能
+// 证明该冻结确由本模块的 writeClaimed() 产生——外部代码理论上可以构造出描述符完全相同（仅
+// enumerable 等无关字段可能不同）的「假冻结」。但这不构成漏洞：任何 writable:false+configurable:false
+// 的描述符，不论来源，都同样拒绝后续改写，「两个合法值间来回切换」的窗口一样被堵死；本函数命名与注释
+// 因此不再声称「本模块自身产生」，只如实描述「当前是否已冻结」这一可观察状态。
+function isClaimSlotFrozen() {
+  const desc = Object.getOwnPropertyDescriptor(globalThis, CLAIM_KEY);
+  return !!desc && desc.writable === false && desc.configurable === false;
+}
+
+function adoptAndFreezeIfNeeded(value) {
+  if (!isClaimSlotFrozen()) writeClaimed(value);
+}
 
 function hasRootMarker(dir) {
   return existsSync(join(dir, 'loop', 'config.json'));
@@ -43,6 +124,19 @@ function validate(dir, sourceLabel) {
   }
 }
 
+// 幂等复用前重新校验槽内容（round-2 实现审 A1 采信）：不对 globalThis 槽内容照单全收——若其已不存在/
+// 无根标记（环境劣化，或槽在本模块首次认领前已被外部预置成无效值），在复用点立即抛错，绝不静默返回
+// 一个未经校验的值。合法场景下 revalidated 应恒等于 value（value 本就是 validate() 的输出、已是
+// realpath 规范化后的绝对路径）；两者不等则视为槽内容异常（记为「篡改」而非静默接受）。
+function revalidateClaimed(value) {
+  const revalidated = validate(value, '进程级认领槽（幂等复用前复核）');
+  if (revalidated !== value) {
+    throw new RootResolutionError(`进程级认领槽内容异常（重新校验后规范化结果与槽内值不一致，疑似被篡改）：槽值「${value}」`);
+  }
+  adoptAndFreezeIfNeeded(revalidated); // 本次校验通过即视为「被信任使用」，就地补冻结（见上）
+  return revalidated;
+}
+
 function upwardSearch(startCwd) {
   let cur = resolve(String(startCwd));
   for (;;) {
@@ -60,25 +154,36 @@ function upwardSearch(startCwd) {
 }
 
 function claimAtomic(candidate) {
-  if (claimed === null) {
-    claimed = candidate;
-    return claimed;
+  const current = readClaimed();
+  if (current === null) {
+    writeClaimed(candidate);
+    return candidate;
   }
-  if (claimed !== candidate) {
+  if (current !== candidate) {
     throw new RootResolutionError(
-      `ROOT 认领冲突：进程已认领「${claimed}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
+      `ROOT 认领冲突：进程已认领「${current}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
     );
   }
-  return claimed;
+  // 同值分支（round-2 第二轮实现审 codex HIGH 采信）：current 可能来自外部普通赋值预置（同一显式
+  // envRoot 恰好与之相等），此时槽未必已冻结——就地补冻结，防止后续被改写成另一个「同样合法」的 ROOT。
+  adoptAndFreezeIfNeeded(current);
+  return current;
 }
 
 // 单点解析 + 原子认领。envRoot 缺省读 process.env.LOOP_KIT_ROOT；cwd 缺省读 process.cwd()。
 // 显式传参（boot 库模式用法）与缺省裸调用（CLI 转发子进程 / 受支持路径外的直接调用）共用同一函数、同一原子性。
 export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process.cwd() } = {}) {
+  if (!isMainThread) {
+    // round-2 实现审 A1 采信：worker_threads 的每个 Worker 有独立 globalThis，本机制无法跨 Worker
+    // 协调认领——与其让各 Worker 各自静默认领互不冲突（违反「进程唯一 ROOT」），不如在非主线程直接
+    // 拒绝，把未支持的执行环境变成显式失败。
+    throw new RootResolutionError('resolveRoot() 仅支持 Node 主线程；worker_threads 的 Worker 各有独立 globalThis，本机制无法跨 Worker 协调 ROOT 认领');
+  }
   if (envRoot !== undefined && envRoot !== '') {
     return claimAtomic(validate(envRoot, 'LOOP_KIT_ROOT'));
   }
-  if (claimed !== null) return claimed; // 已认领：幂等直接复用，不重复上溯（同进程库模式的核心防线）
+  const already = readClaimed();
+  if (already !== null) return revalidateClaimed(already); // 已认领：幂等直接复用，但复用前重新校验（见上）
   const found = upwardSearch(cwd);
   if (!found) {
     throw new RootResolutionError(`未设 LOOP_KIT_ROOT，且从 ${resolve(String(cwd))} 上溯未找到根标记 loop/config.json`);
@@ -86,7 +191,8 @@ export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process
   return claimAtomic(found);
 }
 
-// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。
+// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。不重新校验——纯读，供诊断/测试观察当前认领
+// 状态，语义与 resolveRoot() 的复用路径（会重新校验）刻意区分。
 export function claimedRoot() {
-  return claimed;
+  return readClaimed();
 }
```

## 5. Diff（包仓 /mnt/d/ctx/heren/loop-kit，从首提交 0f34cc0 到本轮 HEAD 的累积 diff）

```diff
diff --git a/lib/root.mjs b/lib/root.mjs
index 84a423f..0454337 100644
--- a/lib/root.mjs
+++ b/lib/root.mjs
@@ -1,19 +1,59 @@
 #!/usr/bin/env node
 // lib/root.mjs — loop-kit 包内 ROOT 解析与原子认领单点（提取后包内唯一新增逻辑面，GRILL D4）。
 //
-// 语义（评审 M2/M3/R2-H3 收严后版本）：
+// 语义（评审 M2/M3/R2-H3 + round-1/round-2 实现审收严后版本）：
 //   1. LOOP_KIT_ROOT（显式参数 envRoot，缺省读同名环境变量）在场则必须有效——目录存在 + 含
 //      loop/config.json 根标记 + realpath 规范化；无效立即失败，绝不静默回退到 cwd 上溯。
-//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）；否则自 cwd
-//      （缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
+//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）——复用前重新校验该
+//      值仍存在且仍带根标记（round-2 实现审 A1 采信：不可对 globalThis 槽内容照单全收，见下）；否则自
+//      cwd（缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
 //   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
 //      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
 //   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
 //      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
 //      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
 //   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
+//   6. 仅支持 Node 主线程；worker_threads 的独立 Worker 各有独立 globalThis，本机制无法跨 Worker
+//      协调认领（round-2 实现审 A1 采信：见下）——非主线程调用直接拒绝，不产生「各自静默认领互不冲突」
+//      的假象。
+//
+//   认领槽存储位置（round-1 实现审 A1 采信后修订）：认领值存在 globalThis[Symbol.for(...)] ——
+//   进程级共享位置，而非本模块的顶层 let 变量。原因：包可能以多个不同的物理目录被加载（如两棵
+//   消费树各自的兄弟目录约定解析到不同包副本、或显式 LOOP_KIT_PKG 指向另一份包拷贝）——不同物理
+//   路径对 ESM 而言是不同的 file:// URL，会各自得到独立的模块实例；若认领槽是模块顶层变量，则
+//   「进程唯一 ROOT」只在两次加载解析到同一物理包目录（同一模块实例）时成立，两树解析到不同包
+//   目录时防线静默不在场（同进程可各自认领不同 ROOT，零冲突）——这与本节语义 4 的「进程唯一」直接
+//   矛盾。Symbol.for() 使用全局符号注册表，同一键名在同进程内任何模块实例中都解析到同一 Symbol，
+//   故 globalThis[Symbol.for(...)] 是真正意义上的进程级单例存储，与「加载自哪个物理文件」无关。
+//
+//   round-2 实现审两处加固（codex HIGH 采信）：
+//   ① worker_threads 边界：globalThis 按 JS 执行环境（Node 主线程 / 每个 Worker）独立，不是操作系统
+//      进程级共享——同进程内的两个 Worker 各有独立 globalThis，会各自静默认领不同 ROOT、互不冲突，
+//      与语义 4 矛盾。本仓与消费侧 casey 代码库均未使用 worker_threads（已用 grep 核验零命中）；
+//      为避免「看似成立、实则在 Worker 场景下静默违反不变量」，resolveRoot() 在非主线程直接拒绝，把
+//      未支持的执行环境变成显式失败而非静默错误——若未来确需 Worker 内消费本包，须先设计跨 Worker
+//      协调机制（如经 SharedArrayBuffer/Atomics 或专用 broker）并重新评估本假设，不能绕过此拒绝。
+//   ② 槽内容不可信问题：globalThis[Symbol.for(...)] 一旦公开，同进程内任何代码都能读写（不像模块
+//      顶层变量那样只能经本模块导出的函数触达）——若外部代码在本模块首次认领前预置一个不存在/无根
+//      标记的值，旧版会不经校验直接复用。现改为：a) 首次认领后用 Object.defineProperty 冻结该属性
+//      （writable:false/configurable:false），本模块自身的合法流程只会在「尚未认领」时写一次，此后
+//      同进程任何代码（含本模块自身）再尝试赋值都会在严格模式下抛 TypeError，不会静默覆盖；
+//      b) 幂等复用路径（语义 2）每次复用前都重新对槽内容跑一遍与首次认领相同的校验（存在性 + 根标记 +
+//      realpath），槽内容不存在/无标记/被非常规篡改会在复用时立即抛错，不会被当成「已验证过」而照单
+//      全收。两者合力：认领后无法被同进程其它代码静默替换，认领前的伪造值也过不了复用校验。
+//
+//   round-2 第二轮实现审加固（codex HIGH 采信）：上述 ②a 的冻结只挂在「从空槽写入」这一条代码路径
+//   （claimAtomic 的 current===null 分支）上——若外部先用普通赋值预置一个「合法、规范化」的 ROOT
+//   （存在 + 有根标记 + 已是 realpath 形态），复用路径/同值路径会校验通过并接受它，但从未走到
+//   writeClaimed()，属性仍可写，外部随后可再悄悄改写成另一个同样合法的 ROOT——两次合法值之间的静默
+//   切换，独立探针实测复现（同一主线程进程先后接受两个不同的真实合法目录）。修复：不再只在「从空槽
+//   写入」时冻结，而是在任何代码路径打算把某个槽值当「已认领」使用（幂等复用 revalidateClaimed()、
+//   同值复用 claimAtomic()）之前，先查属性描述符是否已不可写/不可配置（isClaimSlotFrozen()），
+//   不是则当场补冻结（adoptAndFreezeIfNeeded()）——把「首次被信任使用的时刻」当作认领时刻，不局限于
+//   「首次从空槽写入」这一种途径，堵死「两个合法值之间来回切换」的窗口。
 import { existsSync, realpathSync } from 'node:fs';
 import { dirname, join, resolve } from 'node:path';
+import { isMainThread } from 'node:worker_threads';
 
 export class RootResolutionError extends Error {
   constructor(message) {
@@ -22,7 +62,48 @@ export class RootResolutionError extends Error {
   }
 }
 
-let claimed = null; // 进程唯一认领值（realpath 规范化后的绝对路径字符串）；null=未认领
+// 进程级共享认领槽——键名含包名与用途，降低与其它代码的 Symbol.for 键碰撞概率。
+const CLAIM_KEY = Symbol.for('loop-kit:root:claimed');
+
+function readClaimed() {
+  const v = globalThis[CLAIM_KEY];
+  return v === undefined ? null : v;
+}
+
+// 首次认领后冻结该 globalThis 属性——同进程内（含本模块自身）此后任何再赋值尝试都会在 ESM 的严格
+// 模式下抛 TypeError，不会静默覆盖已认领的值（round-2 实现审 A1 采信）。正常流程下 claimAtomic() 只在
+// current===null 时调用本函数一次，故这里的冻结不会与自身的合法调用冲突。
+function writeClaimed(v) {
+  try {
+    Object.defineProperty(globalThis, CLAIM_KEY, {
+      value: v, writable: false, configurable: false, enumerable: false,
+    });
+  } catch (e) {
+    throw new RootResolutionError(`进程级认领槽写入失败（可能已被外部代码以不兼容方式预置）：${e.message}`);
+  }
+}
+
+// 槽当前是否已是不可写/不可配置的冻结形态（round-2 第二轮实现审 codex HIGH 采信）。缺口：外部若在
+// 本模块首次认领前，用普通赋值预置一个「合法、规范化」的 ROOT（存在 + 有根标记 + 已是 realpath），
+// revalidateClaimed()/claimAtomic() 的「同值直接复用」分支会校验通过并接受它——但从未经过
+// writeClaimed()，属性仍是 writable:true/configurable:true，外部随后可再次悄悄改写成另一个同样合法
+// 的 ROOT，下次复用又校验通过、静默换根，「首次认领后不可变」名存实亡（codex 独立探针实测复现：同一
+// 主线程进程先后接受两个不同合法 ROOT）。修复：任何代码路径只要打算把某个槽值当「已认领」使用，先检查
+// 该属性是否已不可写/不可配置；不是则就地补冻结（把「首次真正被信任使用的时刻」当认领时刻，而不是只认
+// 「经由 claimAtomic 从空槽写入」这一条路径），此后同样不可被普通赋值覆盖。
+// 命名说明（round-2 第三轮实现审 codex LOW 采信）：本函数只能证明「属性当前已不可写/不可配置」，不能
+// 证明该冻结确由本模块的 writeClaimed() 产生——外部代码理论上可以构造出描述符完全相同（仅
+// enumerable 等无关字段可能不同）的「假冻结」。但这不构成漏洞：任何 writable:false+configurable:false
+// 的描述符，不论来源，都同样拒绝后续改写，「两个合法值间来回切换」的窗口一样被堵死；本函数命名与注释
+// 因此不再声称「本模块自身产生」，只如实描述「当前是否已冻结」这一可观察状态。
+function isClaimSlotFrozen() {
+  const desc = Object.getOwnPropertyDescriptor(globalThis, CLAIM_KEY);
+  return !!desc && desc.writable === false && desc.configurable === false;
+}
+
+function adoptAndFreezeIfNeeded(value) {
+  if (!isClaimSlotFrozen()) writeClaimed(value);
+}
 
 function hasRootMarker(dir) {
   return existsSync(join(dir, 'loop', 'config.json'));
@@ -43,6 +124,19 @@ function validate(dir, sourceLabel) {
   }
 }
 
+// 幂等复用前重新校验槽内容（round-2 实现审 A1 采信）：不对 globalThis 槽内容照单全收——若其已不存在/
+// 无根标记（环境劣化，或槽在本模块首次认领前已被外部预置成无效值），在复用点立即抛错，绝不静默返回
+// 一个未经校验的值。合法场景下 revalidated 应恒等于 value（value 本就是 validate() 的输出、已是
+// realpath 规范化后的绝对路径）；两者不等则视为槽内容异常（记为「篡改」而非静默接受）。
+function revalidateClaimed(value) {
+  const revalidated = validate(value, '进程级认领槽（幂等复用前复核）');
+  if (revalidated !== value) {
+    throw new RootResolutionError(`进程级认领槽内容异常（重新校验后规范化结果与槽内值不一致，疑似被篡改）：槽值「${value}」`);
+  }
+  adoptAndFreezeIfNeeded(revalidated); // 本次校验通过即视为「被信任使用」，就地补冻结（见上）
+  return revalidated;
+}
+
 function upwardSearch(startCwd) {
   let cur = resolve(String(startCwd));
   for (;;) {
@@ -60,25 +154,36 @@ function upwardSearch(startCwd) {
 }
 
 function claimAtomic(candidate) {
-  if (claimed === null) {
-    claimed = candidate;
-    return claimed;
+  const current = readClaimed();
+  if (current === null) {
+    writeClaimed(candidate);
+    return candidate;
   }
-  if (claimed !== candidate) {
+  if (current !== candidate) {
     throw new RootResolutionError(
-      `ROOT 认领冲突：进程已认领「${claimed}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
+      `ROOT 认领冲突：进程已认领「${current}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
     );
   }
-  return claimed;
+  // 同值分支（round-2 第二轮实现审 codex HIGH 采信）：current 可能来自外部普通赋值预置（同一显式
+  // envRoot 恰好与之相等），此时槽未必已冻结——就地补冻结，防止后续被改写成另一个「同样合法」的 ROOT。
+  adoptAndFreezeIfNeeded(current);
+  return current;
 }
 
 // 单点解析 + 原子认领。envRoot 缺省读 process.env.LOOP_KIT_ROOT；cwd 缺省读 process.cwd()。
 // 显式传参（boot 库模式用法）与缺省裸调用（CLI 转发子进程 / 受支持路径外的直接调用）共用同一函数、同一原子性。
 export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process.cwd() } = {}) {
+  if (!isMainThread) {
+    // round-2 实现审 A1 采信：worker_threads 的每个 Worker 有独立 globalThis，本机制无法跨 Worker
+    // 协调认领——与其让各 Worker 各自静默认领互不冲突（违反「进程唯一 ROOT」），不如在非主线程直接
+    // 拒绝，把未支持的执行环境变成显式失败。
+    throw new RootResolutionError('resolveRoot() 仅支持 Node 主线程；worker_threads 的 Worker 各有独立 globalThis，本机制无法跨 Worker 协调 ROOT 认领');
+  }
   if (envRoot !== undefined && envRoot !== '') {
     return claimAtomic(validate(envRoot, 'LOOP_KIT_ROOT'));
   }
-  if (claimed !== null) return claimed; // 已认领：幂等直接复用，不重复上溯（同进程库模式的核心防线）
+  const already = readClaimed();
+  if (already !== null) return revalidateClaimed(already); // 已认领：幂等直接复用，但复用前重新校验（见上）
   const found = upwardSearch(cwd);
   if (!found) {
     throw new RootResolutionError(`未设 LOOP_KIT_ROOT，且从 ${resolve(String(cwd))} 上溯未找到根标记 loop/config.json`);
@@ -86,7 +191,8 @@ export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process
   return claimAtomic(found);
 }
 
-// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。
+// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。不重新校验——纯读，供诊断/测试观察当前认领
+// 状态，语义与 resolveRoot() 的复用路径（会重新校验）刻意区分。
 export function claimedRoot() {
-  return claimed;
+  return readClaimed();
 }
```
