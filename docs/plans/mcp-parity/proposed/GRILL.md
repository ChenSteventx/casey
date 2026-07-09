# mcp-parity — grill 决策记录（`MCP` 面补齐 + 三面漂移锁加固，light）

> 起草态（零-baton）：本文只落决策，未 `contract init`、未改实现、未 gate。授权链待 Steven grill 签核。
> 全部决策为机械镜像 `cli-mcp-face` 既有先例或对齐已建事实（`bin/record.mjs`/`bin/intake.mjs` 07-09 已落），零新机制、零新业务。

## 背景

三面统一标识符（`CLAUDE.md`：`CLI` / `skill` / `MCP` server）里 `MCP` 面又一次滞后于 `CLI` 面，且本该盯住它的漂移锁盯不到（易用性审计摩擦点 F7/F8/F9，`docs/plans/usability-audit/proposed/AUDIT-PLAN.md` C3 项）：

1. `casey record`（示教录制）与 `casey intake`（示教入账）已是真 `CLI` 命令（`bin/casey.mjs:245`/`247` 分派到 `bin/record.mjs`/`bin/intake.mjs`），但 `mcp/casey-server.mjs` 的 `TOOLS` 仍 12 个，无 `casey_record`/`casey_intake`。纯 `MCP` 的 agent（如 codex）做不了示教录制/入账。
2. `tests/_golden/cli-mcp-face.golden.mjs` 的漂移锁只对**已声明的** 12 工具做 `deepEq` 与 `toArgs` 逐一比对，没有「`CLI` 生命周期命令集 ⊆ `MCP` 工具集」这道覆盖断言——`CLI` 长了新命令而 `MCP` 没跟，金牌照绿。这是让 F7 静默滞后的根因。
3. 版本漂移：`package.json:3` 是 `0.1.0`，`mcp/casey-server.mjs:22` 的 `SERVER_INFO` 是 `0.2.0`，两处不一致。
4. `SKILL.md` 底层命令映射表、`README.md`「12 个工具…漂移锁」文案都停在 12 工具口径。

## D1 车道：light

- 定夺：light。碰 `mcp/casey-server.mjs`（工具目录）+ `tests/_golden/cli-mcp-face.golden.mjs`（漂移锁）+ `package.json`（版本）+ `SKILL.md`/`README.md`（文档）。不碰冻结内核（`verdict.mjs`/`replay.mjs`/断言 schema）、不碰凭据·目标地址边界、不新增多分支命令。有一道 fail-closed 漂移锁值一道 plan 门，故 light 而非 direct；无冻结 schema 涟漪、无凭据回显新面，故不必 full。镜像 `cli-mcp-face` 同理由。
- 实现者动 `bin`/`mcp`/`tests/_golden` 前须先 `casey contract init mcp-parity --lane light`；本起草文档只读+写自身，未 `contract init`。

## D2 `MCP` 加 `casey_record` + `casey_intake` 两工具（`toArgs` 逐字对齐真旗标）

`mcp/casey-server.mjs` 的 `TOOLS` 在 `casey_sign` 之后、`casey_replay` 之前插入两条（镜像 `CLI` help 里 `record`/`intake` 紧跟 `sign` 的次序），`inputSchema` 逐字对齐各 `bin` 真实旗标，`toArgs` 只对在场值拼旗标（空参透传到 `CLI` 落真实用法错码，壳里绝不预判——同现有 12 工具口径）：

- `casey_record`：`inputSchema.required = [caseId, sut, outDir]`（`--login-bootstrap`/`--no-login` 互斥由 `CLI` 落 exit 64，壳里不预判）；
  `toArgs(a) = ['record', ...(a.caseId?[a.caseId]:[]), ...flag('sut',a.sut), ...flag('out-dir',a.outDir), ...boolFlag('login-bootstrap',a.loginBootstrap), ...boolFlag('no-login',a.noLogin), ...flag('from-events',a.fromEvents), ...boolFlag('headless',a.headless), ...flag('max-ms',a.maxMs)]`。
  description 引用示教语义（`teach-in-capture.json` 只作蒸馏语料，不签署、不直通回放）。
- `casey_intake`：`inputSchema.required = [caseId, capture]`；
  `toArgs(a) = ['intake', ...(a.caseId?[a.caseId]:[]), ...flag('capture',a.capture)]`。
  description 引用入账语义（安全复核录制包 → 登记入账台账；不转形/不签署/不回放；拒账 fail-closed exit 65）。

`flag`/`boolFlag` 复用现有壳内助手，服务行为对既有 12 工具零变。

## D3 `casey_heal` 不暴露（`exit-3` 语义）

- 定夺：`heal` 保持不进 `MCP` 面。相5 只有 lib 件、无 `bin/heal.mjs`，`CLI` 侧 `casey heal` 是唯一诚实桩（exit 3）。暴露一个只会回「该阶段尚未实现」的可调用工具，与内核纪律「绝不把桩当完成」相悖，且沿 `cli-mcp-face` 先例（当时也刻意不列 `casey_heal`）。
- 交账：P6 落地真 `bin/heal.mjs` 后，由那一契约补 `casey_heal` 并把 `heal` 移出下面 D5 的显式排除集——那时它自然被覆盖断言纳入，fail-closed 默认要求它进 `MCP`。

## D4 版本单源：`package.json` 为唯一事实源

- 定夺：`package.json` 的 `version` 是唯一事实源。`mcp/casey-server.mjs` 的 `SERVER_INFO.version` 改为从 `package.json` 读取（`JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).version`，零第三方依赖、hermetic），不再写死字面量。同步把 `package.json` 版本 `0.1.0` → `0.2.0`（与既有 `SERVER_INFO` 事实对齐，且 `cli-mcp-face` C2 早已把 `serverInfo.version` 钉在 `0.2.0`）。
- 取 `package.json` 为源的理由：它是 npm 规范里的正式版本字段、分发者第一眼看的地方；让 `MCP` 握手从它派生，「两处一致」由结构保证而非靠人对齐，日后 bump 一处即两处同步。
- 金牌相应改为**结构性验等**：读 `package.json.version` 与 `initialize` 回的 `serverInfo.version` 比较相等（不再硬编码 `'0.2.0'` 字面量），日后 bump 自动流过、不留需手改的断言。

## D5 「`CLI` 命令集 ⊆ `MCP` 工具集」覆盖断言：从 `CLI` 源派生、fail-closed 默认必覆盖

这是防 F7 再滞后的核心设计。旧漂移锁只认识**已声明的**工具名集（`EXPECT_TOOL_NAMES` 硬编码 + `deepEq`），所以「`CLI` 长了新命令」这类漂移它天生看不见——正是这次滞后能发生的原因。

- 定夺：金牌从 `bin/casey.mjs` 的 `main()` switch **源码**派生 `CLI` 命令全集（正则 `/case '([a-z][a-z-]*)':/g` 抓所有 `case '<cmd>':` 字面量），减去一个**显式且小**的排除集 `EXCLUDED`，对剩下每个命令断言其映射工具名 `casey_${cmd.replace(/-/g,'_')}` ∈ `MCP` `tools/list` 名集。任一缺失即红。
- `EXCLUDED = { help, breaker, contract, heal }`（外加 `undefined`/`--help`/`-h` 因不以 `[a-z]` 起头天然被正则排除）：
  - `help`：非生命周期命令。
  - `breaker` / `contract`：loop 开发台账（熔断器 / Loop Contract 阶段互锁），属开发纪律面、非测试消费者该驱动的能力，与现有 `MCP` 面只暴露 `lint`/`gate` 而不暴露 `breaker`/`contract` 的既有取舍一致。
  - `heal`：诚实桩（见 D3），P6 真 bin 落地后移出。
- 何以防再漏：派生集随 switch 生长——新加一个 `case 'foo':` 就自动进派生集，若 `casey_foo` 不在 `MCP` 且 `foo` 未被显式加进 `EXCLUDED`，断言即红。默认方向 fail-closed（新命令默认「必须被 `MCP` 覆盖」），把 `EXCLUDED` 做成一份小而显式、需人过目的白名单——漏进 `MCP` 会红，故意不进也得留痕。
- 现状核验：派生集减 `EXCLUDED` = 14 个 `casey_*`，与本契约后的 `MCP` 工具集逐一相等（已实测）。

## D6 `EXPECT_TOOL_NAMES` 12→14 `deepEq` 保留（与 D5 互补，两者都要）

- 定夺：`EXPECT_TOOL_NAMES` 更新为 14 名并保留 `deepEq` 钉死；新次序在 `casey_sign` 后插 `casey_record`、`casey_intake`：
  `[casey_selftest, casey_lint, casey_gate, casey_ingest, casey_flow_bridge, casey_compile, casey_draft, casey_sign, casey_record, casey_intake, casey_replay, casey_verdict, casey_report, casey_run]`。
- 为何两道都留：`deepEq` 钉的是**精确集合**（防改名/误删/乱序/多出工具），D5 的派生断言钉的是**覆盖关系**（防 `CLI` 长了 `MCP` 没跟）。前者管「`MCP` 别乱变」，后者管「`MCP` 别落后」，方向正交，缺一漏一类漂移。

## D7 `SKILL.md` 命令映射表补两行真实签名

- 定夺：`.claude/skills/casey/SKILL.md` 的「底层命令映射（仅供代理内部执行）」表，在 `sign` 行之后补两行，签名逐字对齐 `CLI` help：
  - `record`：`node bin/casey.mjs record <caseId> --sut <本地基址> --out-dir <d> (--login-bootstrap|--no-login) [--from-events <f> --headless --max-ms <ms>]`；注「示教语料，非正式回放输入」。
  - `intake`：`node bin/casey.mjs intake <caseId> --capture <f>`；注「安全复核 → 入账台账，拒账 fail-closed」。
- 纯文档改动（`term-lint` 写入即扫）；`skill` 立场段（裁判零 `LLM`/完成是退出码/fail-safe）一字不动。避开 handover-pack C2 的 help 过时形态黑名单（`record`/`intake` 不带 `--sut <url>` 明文目标地址形态）。

## D8 `README.md`「12 工具…漂移锁」文案更新

- 定夺：`README.md:69` 的「12 个工具（`casey_ingest` … `casey_run`），签名与 `CLI` 真面对齐并有漂移锁金牌盯防」改为 14 工具口径，并点出漂移锁现含「`CLI` 生命周期命令集 ⊆ `MCP` 工具集」覆盖断言（`CLI` 长了 `MCP` 没跟即红）。纯文档、无目标地址/凭据值。

## D9 涟漪与重签

- 唯一冻结涟漪：本契约编辑 `tests/_golden/cli-mcp-face.golden.mjs`，其 sha256 由 `loop/prd-cli-mcp-face.json` 的 `testChecksums` 冻结。编辑后须把该 prd 的 `testChecksums` 重签到新值——本次编辑**只加断言**（14 工具集、record/intake `toArgs`、`CLI`⊆`MCP`、版本验等、intake happy），不放松任何既有断言，属 Test Ratchet 合法加严。
- 核实过的**非**涟漪：`handover-pack`/`report-exit64` 两 prd 的 `testChecksums` 冻的是各自 golden（`handover-pack.golden.mjs`/`report-exit64.golden.mjs`），**不**冻 `cli-mcp-face.golden.mjs`（grep 命中只是任务文字里的字符串），故不受本契约影响。
- 无新造词：`record`/`intake`/示教录制/示教入账/示教入账台账 均已在 `CONTEXT.md` 登记；「`CLI` 命令集 ⊆ `MCP` 工具集」是覆盖关系描述、非新术语。

## D10 非目标

- 不接任何新业务能力（不蒸馏、不新增相位、不动 `run` 编排与任何 `lib`）。
- 不改 `MCP` 协议/传输实现（手写 stdio JSON-RPC、退出码语义标注机制、`initialize`/`tools/list`/`tools/call` 一字不动）。
- 不碰冻结内核（`verdict.mjs`/`replay.mjs`/断言与 events schema）、不碰凭据·目标地址边界。
- `record` 的浏览器 happy 路径不进 hermetic 金牌（需真机 + 凭据 + 站点）：金牌只验 `record` 的 `toArgs` 映射 + 空参 exit 64（浏览器前即退，hermetic）；`intake` 的 happy 全管道用真 `record --from-events` 接缝产 capture 后 hermetic 跑通（见 GOLDEN-TESTPLAN）。
- 真机 `MCP` 挂载核验（`claude mcp add` 后 codex/pi 上实调 `casey_record`/`casey_intake`）留 route:human 尾巴，非本契约 hermetic 验收（对应审计 R3/R4）。
