# teachin-semantic-lock-wiring-gaps — plan（full）

目标：补齐 `teachin-semantic-lock-wiring` 主契约之外五个可导致错误对象被选择或未签动作直通的接线盲区；所有边界 fail-closed，且不引入 capture↔sidecar 哈希环。

## 1. 无环 package 与最终字节

新增纯函数 package 层，固定规范目录的三份文件：

- `teach-in-capture.json` 与 `identity-observations.json` 分别先形成最终完整字节；二者不得互含对方 SHA-256。
- `teach-in-package.json` 绑定 `caseId`、两个固定文件名、两个最终字节 SHA-256、观察数量和观察 schema 版本。
- manifest 使用闭合确定性 JSON；其自身不含自 hash。intake 台账可按 manifest 原始最终字节另算 SHA-256。
- 任一最终字节改变、count/version 不符、未知键、文件名不是固定 basename、绝对路径或跨目录均结构化拒绝。

此项明确替代旧计划里“capture 引用 sidecar sha256”的子决定；旧冻结文件不改，由本契约追加约束消除环。

## 2. intake 联合验证与规范路径

`bin/intake.mjs` 仍只接收规范 capture 路径；manifest 与 sidecar 必须从 capture 同级目录和固定文件名推导：

- CLI/MCP 不新增 `--manifest`、`--sidecar` 或等价任意路径参数。
- symlink/规范布局门之后读取三份原始字节，调用 package verifier 联合校验。
- accepted 台账同时绑定 `captureSha256 + sidecarSha256 + manifestSha256 + observationCount + observationSchemaVersion`。
- `distill` 消费前对三份当前原始字节与最新 accepted 记录做 TOCTOU 重验；任一替换都拒绝，不只校 capture。

## 3. flow 来源与角色保真

`buildFlow` 的每个输出 step 保留：

- `sourceIntentId`：逐字来自 mapping 的 `intentId`；
- `entityBindings`：逐项保存 `candidateId + role`；
- source/target 是显式角色，关系写需要两端，顺序变化也不能把角色互换。

compile 可生成执行时 intent/step 标识，但不能覆盖或丢弃 `sourceIntentId`；后续 draft/frozen 必须能回溯手录事件与原自然语言 intent。

## 4. sign 前 mutation 旁路

新增纯函数 admission preflight（准入前检）：

- `compile --execute` 对含业务对象 mutation 的 flow，要求独立签署且绑定 flow/testcase/caseId 的 pre-execution identity authority；缺失、失配或未覆盖全部对象时 `allowBrowserLaunch:false`。
- `compile --verify` 已消费最终 events，要求绑定这些 events 的 `entity-locks.frozen.json`；缺失或失配时 `allowBrowserLaunch:false`。
- 两个门都必须位于任何 `chromium.launch`、登录、回放 spawn 或业务动作之前；不得以 flow confirm 替代身份授权。
- 纯只读且无业务对象的 compile 行为可按明确 policy 放行，但不得由调用者用布尔开关自称只读。

## 5. 公共入口不绕锁

- `bin/promptset.mjs` 把 `--entity-locks` 列为必填并逐行原样传给 replay。
- `casey replay/run` 与内部 run pipeline 对实体相关 events 要求 frozen locks；不得生成空锁或猜路径。
- MCP 的 replay/run schema 必须要求 `entityLocks` 并传 `--entity-locks`；compile execute 暴露 `entityAuthority`，compile verify 暴露 `entityLocks`；sign 暴露身份 draft/confirm/frozen 产物。
- 未签直通、跳过身份锁和允许 unsigned 的参数名在公共面一律禁止。

## 6. 验收点

### 可命令化

1. `teachin-semantic-lock-package-integrity.zero-sut.golden.mjs`：固定最终字节 digest domain、第三 manifest 精确字节、无互引、篡改和路径走私拒绝。
2. `teachin-semantic-lock-intake-joint.zero-sut.golden.mjs`：intake 联合读取/验证三文件、固定同级推导、台账三 hash 与 distill 三联 TOCTOU。
3. `teachin-semantic-lock-flow-provenance.zero-sut.golden.mjs`：flow 保留 source intent 与 source/target 角色，不允许角色推断或丢失。
4. `teachin-semantic-lock-presign-bypass.zero-sut.golden.mjs`：execute/verify 两类 authority 分开，且 admission 早于浏览器或 replay spawn。
5. `teachin-semantic-lock-public-bypass.zero-sut.golden.mjs`：promptset、CLI run/replay 与 MCP compile/sign/replay/run 均不能绕 frozen locks。

### 可观察性申报

- package 在真实手录关窗后的完整性、观察数量与真实 UI 对象一致性：`route:human`，须真机录像与视觉复核。
- pre-execution authority 在真实 AI 中台 mutation 前能否覆盖 workflow/agent 及其它名字+编号对象：`route:human`。
- MCP/skill/CLI 跨 Win/macOS/WSL 的端到端参数传递与错误提示：`route:human`，不得以本轮静态测试代替。

## 7. 停止条件

本工序只在五份新增验收测试真实红、sha256 冻结、独立 PRD 可被 `gate --dry` 消费并提交后结束。不得修改 `965a0e7` 已冻结的三份测试，不得写生产实现，不得运行 SUT。
