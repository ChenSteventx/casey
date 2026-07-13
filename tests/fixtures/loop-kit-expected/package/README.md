# loop-kit

可复用 loop engineering 工具箱：契约（Loop Contract）/ 质量门禁（Quality Gate）/ 熔断器（Circuit Breaker）/
统一语言强制（term-lint）/ Test Ratchet 反向索引 的确定性内核。以确定性退出码为唯一真相：默认 FAIL，凭证据翻绿。

## 出处

本包由 `loop-kit-extract` 契约从 casey 仓提取为独立包（`docs/adr/0008-loop-kit-extraction.md`，2026-07-13 拍板路线①）：

- 提取源：casey 仓 `HEAD=f9f9019`（`loop-kit/bin/` 十脚本原地拷贝，`contract.mjs`/`ratchet.mjs` 以 casey 版为准）。
- 提取前，`breaker.mjs`/`gate.mjs`/`hook-loop-guard.mjs`/`hook-loop-triage.mjs`/`hook-posttool.mjs`/`hook-stop.mjs`/
  `review-deepseek.mjs`/`term-lint.mjs` 八份脚本与 autotester 仓同名文件逐字节 `cmp` 一致（对齐基线）；
  `contract.mjs` 已分叉（本包取 casey 版，含 `worktree` baton 全套）；`ratchet.mjs` 为 casey 独有件。
- 本仓 `fresh git init`，不携 casey/autotester 两仓历史（route:human #3，Steven 2026-07-13 裁定）。

## 双消费者

- **casey**（`docs/adr/0001-reuse-loop-kit.md`）：`loop-kit/bin/*.mjs` 十件原地换同名薄转发层（`shim`），经
  `loop-kit/lib/boot.mjs`（casey 侧新增引导助手）定位本包、校验 `kit-lock.json` 包身份锁、转发 CLI/库调用。
- **autotester**（`docs/adr/0001-loop-kit-incubation.md`，孵化源仓）：待其自身迁移工作流对齐本包（非本契约范围）。

## 分发形态

**拓扑优先，不是绝对路径**：本包与各消费树天然是**兄弟目录**——`../<消费仓目录名>` 平级、`../loop-kit` 平级。
消费树默认按此静态兄弟约定直解析本包（零安装、零 `node_modules` 依赖）；非常规布局（异地 clone、任意路径
worktree）须由消费侧显式设 `LOOP_KIT_PKG` 指向本包实际位置。npm 本地路径依赖（`file:../loop-kit`）是
autotester ADR-0001 预定的第二出口，本次提取契约未采用（route:human #4，Steven 2026-07-13 裁定：取甲，
不加依赖声明）——如后续确需该出口，由另一契约评估。

`/mnt/d/ctx/heren/loop-kit` 只是当前环境下的一个实例位置，不是本包必须坐落的绝对路径。

## 布局

```
bin/            十个可执行脚本（CLI 入口 + 部分兼具库导出）
lib/root.mjs    ROOT 解析与原子认领单点（resolveRoot()，唯一提取后新增逻辑）
package.json    name=loop-kit，private，type=module，engines node>=22.12，零第三方依赖
```

`bin/` 中 `breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet` 七件在模块顶层调用
`lib/root.mjs` 的 `resolveRoot()` 取 ROOT（消费侧仓根，非本包自身位置）；`hook-stop`/`hook-loop-triage`/
`review-deepseek` 三件无 ROOT 锚定语义，与提取前逐字节一致。

## 凭据边界

`review-deepseek.mjs` 读取的 DeepSeek key 位于消费侧 `~/.loop-kit/config.json`（仓外），本包自身不含任何凭据、
不读写 `.auth/` 或 `site.json`。
