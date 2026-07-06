# cli-mcp-face — grill 决策记录（light）

> 授权链：Steven「接着干」延续指示。全部决策为机械镜像既有先例或对齐已建事实，零新机制。

## 背景

三面统一标识符（CLAUDE.md：CLI / skill / MCP server）中第三面 `mcp/casey-server.mjs` 是 P0 时代薄壳，
已滞后于 CLI 现状三处：① `casey_run` 的 inputSchema 还是 `run <file> [--channel]`，而真 `runPipeline`
要 `<caseId> --sut --events --expected --profile`——照 MCP 目录调用必 exit 64；② `casey_verdict`/
`casey_report` 描述误标「诚实桩 exit 3」，而底层 `bin/verdict.mjs`/`bin/report.mjs` 早已建成收口
（`casey run` 内部直连在用）；③ 相0–相2 五个新命令（ingest/flow-bridge/compile/draft/sign）未暴露。
同时 CLI 侧 `replay`/`verdict`/`report` 三个 dispatch 仍是 notImplemented 桩——底层真、门面桩。

## D1 CLI 分发接通（机械镜像五先例）

`bin/casey.mjs` 的 `replay`/`verdict`/`report` 三个 case 由 notImplemented 换 `runNode` 一行直通
（同 compile/draft/sign/flow-bridge/ingest 五先例——薄壳只转发 rest argv，参数契约归各 bin 自管）。
help 三行从「理想签名 `<caseId>`」改为真实旗标（`replay --events <f> --sut <url> --expected <f>
--profile <f> --out <f> [...]` / `verdict --axes <f> --out <f>` / `report --model <f> --out <d>`）。
- 理想签名 `<caseId>`（cases/ 目录布局自动寻径）从未实现、无消费者；直通是五先例одного形态。
- `heal` 保持 notImplemented 真桩（相5 只有 lib 件、无 bin/heal.mjs，诚实交底不变）。
- `report-model` 不新增 dispatch（从未列 help，run 内部站；扩 CLI 面属另案）——非目标。

## D2 MCP 工具目录刷新（对齐 CLI 真面）

`mcp/casey-server.mjs` TOOLS 重排：
- 新增六工具：`casey_ingest` / `casey_flow_bridge` / `casey_compile` / `casey_draft` / `casey_sign` /
  `casey_replay`——inputSchema 逐字对齐各 bin 真实旗标，description 引用相位语义与退出码契约。
- 修三工具：`casey_run` inputSchema 改真 `runPipeline` 签名；`casey_verdict`/`casey_report` 去掉
  「诚实桩」误标、改真实旗标。
- 保留：`casey_selftest` / `casey_lint` / `casey_gate`（现状正确）。
- 协议层/传输层零改动（手写 stdio JSON-RPC 保持；退出码语义标注机制保持）；版本 0.1.0 → 0.2.0。

## D3 漂移锁金牌（防再次滞后）

新金牌走 MCP 协议真握手：spawn server → `initialize`（serverInfo=casey）→ `tools/list`（工具名集
钉死 deepEq）→ `tools/call` 正反两路（`casey_lint` registry 真跑 exit 0 + 未知工具 -32602 +
缺参调用回传 [exitCode=64] 标注非静默）→ CLI 侧三分发真跑非桩（零参 exit 64 非 3）+ `heal` 仍 3。
MCP 目录与 CLI 真面的漂移从「没人看见」变成金牌红。

## D5 skill 面同步（查后并入）

`.claude/skills/casey/SKILL.md` 已查实同样滞后：命令映射表还是理想签名（`ingest <file> [--out]` /
`replay <caseId>` / `verdict <caseId>`）、进度段仍写「生命周期命令多数是诚实桩」。并入本契约：
命令映射表逐行改真实旗标、进度段改「七相全建 + hermetic 全链贯通、heal 桩、真机端到端 route:human」。
纯文档改动（term-lint 扫 md）；skill 的立场段（裁判零 LLM/完成是退出码）一字不动。

## D4 非目标

不动协议/传输实现；不加 report-model/heal 面；不动 run 编排与任何 lib；不碰冻结面；不做 MCP
挂载注册（用户侧 `claude mcp add` 自理）；不改 skill 立场段与判定树摘要。

## hermetic 可建

金牌 spawn server 子进程走 stdin/stdout JSON-RPC（newline-delimited），零网络零真机；
`tools/call` 只调秒级命令（lint registry）。CLI 分发检查同 ingest 金牌 C16 先例。
