# cli-mcp-face — CLI/MCP/skill 三面对齐现状（light）

## 背景

三面统一标识符中 MCP server 与 skill 两面滞后于 CLI 现状（P0 时代产物）：MCP 工具目录参数形态
对不上真命令、误标诚实桩、新命令未暴露；skill 命令映射表同病。CLI 侧 replay/verdict/report 分发
仍是桩而底层 bin 早已建成。决策见 `proposed/GRILL.md`（D1–D5，全机械镜像先例/对齐已建事实）。

## 改动

1. `bin/casey.mjs`：`replay`/`verdict`/`report` 三 case notImplemented 桩换 `runNode` 直通（镜像
   五先例）；help 三行改真实旗标。`heal` 保持真桩。
2. `mcp/casey-server.mjs`：TOOLS 目录刷新——新增 `casey_ingest`/`casey_flow_bridge`/`casey_compile`/
   `casey_draft`/`casey_sign`/`casey_replay` 六工具；修 `casey_run` inputSchema 为真 runPipeline 签名、
   `casey_verdict`/`casey_report` 去误标改真实旗标；`casey_selftest`/`casey_lint`/`casey_gate` 保留。
   协议/传输零动；版本 0.1.0→0.2.0。
3. `.claude/skills/casey/SKILL.md`：命令映射表逐行改真实旗标；进度段改现状（七相全建 + hermetic
   全链贯通、heal 桩、真机端到端 route:human）。立场段一字不动。
4. `tests/_golden/cli-mcp-face.golden.mjs`（新建，红先行）+ `loop/prd-cli-mcp-face.json`。

## 非目标

不动 MCP 协议/传输实现；不加 report-model/heal 面；不动 run 编排与 lib；不碰冻结面；不改 skill 立场段。

## 验收（红金牌）

- C1 CLI 三分发真跑非桩：`casey replay|verdict|report` 零参 → exit 64（真 bin 用法错）非 exit 3；
  用法串含各自真实旗标；`casey heal` 仍 exit 3（真桩保持）。
- C2 MCP 握手：spawn server → `initialize` 回 serverInfo.name=casey + `tools/list` 工具名集 deepEq
  钉死（12 工具）。
- C3 MCP 正路：`tools/call casey_lint`（registry）→ 真跑 exit 0、文本含 `[exitCode=0]`、isError false。
- C4 MCP 反路：未知工具 → JSON-RPC error -32602；`casey_verdict` 缺参调用 → isError true 且文本含
  `[exitCode=64]`（错误面如实回传非静默）。
- C5 漂移锁：`tools/list` 每个工具的 inputSchema required 字段与该命令真 bin 的必填旗标一致
  （从金牌内置的真面表比对——表即断言，MCP 目录再滞后即红）。
- 涟漪：`bin/casey.mjs` 被改 → 经 casey 子进程金牌复跑零行为差（flow-bridge / ingest / e2e-chain /
  chiefcomplaint-smoke / wf-publish-states / wf-history-version）；`selftest --tier1` 无回归；
  SKILL.md 过 term-lint（写入即扫）。
