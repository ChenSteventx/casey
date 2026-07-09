# mcp-parity — 红先行金牌测试计划

> 起草态：本文只给断言清单与形态意图，**不写完整测试代码**（实现者据此写红金牌、验红、再实现）。
> 载体：编辑既有 `tests/_golden/cli-mcp-face.golden.mjs`（不新建同类文件——`EXPECT_TOOL_NAMES` `deepEq` 在其中，加 2 工具本就要动它，且单一漂移锁文件更集中）。红先行：先把断言改到 14 工具/含 record·intake·`CLI`⊆`MCP`·版本验等，跑一遍确认红，再实现 `MCP` 两工具 + 版本读源 + `package.json` bump。

## 现状红基线（实现前跑，应红在这些点）

- 工具名集实际 12 ≠ 期望 14（`deepEq` 红）。
- C6 argv 表里 `casey_record`/`casey_intake` 取不到（「工具不在目录」）。
- `CLI`⊆`MCP` 断言：`casey_record`/`casey_intake` 不在 `tools/list` 名集（红）。
- 版本验等：`package.json.version`（`0.1.0`）≠ `serverInfo.version`（`0.2.0`）（红）。
- record/intake 空参 `MCP` 调用：工具未知 → JSON-RPC `-32602`（红，非期望的 `[exitCode=64]`）。

## 断言清单

### A1 工具名集 14 `deepEq` 钉死（改既有 C2）

- `EXPECT_TOOL_NAMES` 更新为 14 名，次序在 `casey_sign` 后插 `casey_record`、`casey_intake`：
  `[casey_selftest, casey_lint, casey_gate, casey_ingest, casey_flow_bridge, casey_compile, casey_draft, casey_sign, casey_record, casey_intake, casey_replay, casey_verdict, casey_report, casey_run]`。
- 走真握手：`spawn` server → `initialize` → `tools/list` → `names = tools.map(t=>t.name)` → `deepEq(names, EXPECT_TOOL_NAMES)`。多出/缺失/改名/乱序即红。
- 形态：`deepEq(a,b) = JSON.stringify(a)===JSON.stringify(b)`（沿用文件内既有助手）。

### A2 `casey_record` `toArgs` 全量入参 `deepEq`（加进既有 C6 CASES）

- 入参 `{ caseId:'tc', sut:'u', outDir:'d', loginBootstrap:true, noLogin:false, fromEvents:'e', headless:true, maxMs:'5000' }`
  期望 argv `['record','tc','--sut','u','--out-dir','d','--login-bootstrap','--from-events','e','--headless','--max-ms','5000']`。
- 断言 `deepEq(tool.toArgs(input), expect)`（`TOOLS` 经 `import(...)` 取；文件末尾已有显式 `process.exit` 兜 readline 副作用）。
- 校验点：kebab 转换（`out-dir`/`from-events`/`max-ms`/`login-bootstrap`）、布尔旗标（`--login-bootstrap`/`--headless` 在场，`noLogin:false` 不产 `--no-login`）、带值旗标只对在场值拼。

### A3 `casey_intake` `toArgs` 全量入参 `deepEq`（加进既有 C6 CASES）

- 入参 `{ caseId:'tc', capture:'c.json' }` 期望 argv `['intake','tc','--capture','c.json']`。
- 断言 `deepEq(tool.toArgs(input), expect)`。

### A4 `CLI` 命令集 ⊆ `MCP` 工具集（新断言，防再漏——核心）

- 从 `bin/casey.mjs` **源码**派生命令集：读文件 → `[...src.matchAll(/case '([a-z][a-z-]*)':/g)].map(m=>m[1])`。
- 减显式排除集 `EXCLUDED = new Set(['help','breaker','contract','heal'])`（`undefined`/`--help`/`-h` 因不以 `[a-z]` 起头天然不被正则抓）。
- 对剩余每个命令 `cmd`，断言 `casey_${cmd.replace(/-/g,'_')}` ∈ `tools/list` 名集（用 A1 已取的 `names`，或重取一次）。任一缺失即红，报出缺哪个命令的映射工具。
- fail-closed 语义在断言里写清：派生集随 switch 生长——新加 `case 'foo':` 若 `casey_foo` 不在 `MCP` 且 `foo` 未加进 `EXCLUDED`，此断言即红。`EXCLUDED` 是需人过目的小白名单，故意排除也留痕。
- 现状核验：派生 − `EXCLUDED` = 14 命令，与 A1 的 14 工具逐一相等（已实测）。
- 与 A1 互补：A1 钉精确集合（防乱变），A4 钉覆盖关系（防落后），两者都要。

### A5 版本单源一致（改既有 C2 的版本断言）

- 读 `package.json`：`const pkg = JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8'))`。
- 从 A1 的 `initialize` 结果取 `serverInfo.version`。
- 断言 `serverInfo.version === pkg.version`（结构性验等，**不**硬编码 `'0.2.0'`——日后 bump 自动流过）。
- 附加可选断言：`pkg.version` 非空字符串（防两处同为 `undefined` 的假绿）。

### A6 `MCP` 层 intake happy 全管道（复现真接缝、真产台账）

> 复现冻结接缝，不 rig：干净 capture 由真 `casey record --from-events` 产（hermetic，无浏览器），不手写伪造 doc 倒着裁到 accept。

- 备料（真 `record` 接缝）：`mkdtemp` → 写一份干净事件夹具 `clean-events.json`（`[{action:'click', path:'/atl_x/list', selector:'button.new', text:'新增'}]`，全字段无裸 `://`、action ∈ `{click,dblclick,fill,press,nav}`）→ 跑 `casey record tc_mcp_intake --from-events <clean-events.json> --sut http://127.0.0.1:9 --no-login --out-dir <tmp>`（`--from-events` 走非浏览器路径），产 `<tmp>/tc_mcp_intake/record-capture/teach-in-capture.json`（规范布局，intake 前置守卫认这条路径）。
- 经协议调用：`tools/call { name:'casey_intake', arguments:{ caseId:'tc_mcp_intake', capture:<上述路径> } }`。
- 断言：
  - `r.result && !r.result.isError`；文本含 `[exitCode=0]`。
  - `<tmp>/tc_mcp_intake/record-capture/intake-ledger.jsonl` 真落地，最后一行解析出 `intakeStatus:'accepted'`、`eventCount` 与夹具事件数一致、`reason:null`。
  - 台账全文过凭据门口径：无裸 `://`、无凭据关键词（可直接扫文本或调 `credentialGate`）。
  - 成功回显不含用户绝对路径（output-seal 纪律——只报定名产物）。
- 语义：证明 record→intake 这条示教兜底链路经 `MCP` 协议端到端真跑、真产入账台账，不是壳里假绿。

### A7 record/intake 空参落真 bin 用法错码（并入既有 C5 `LIFECYCLE_EMPTY_EXIT`，可选）

- `LIFECYCLE_EMPTY_EXIT` 加 `casey_record:64`、`casey_intake:64`。
- 对二者 `tools/call {name, arguments:{}}` → `r.result` 在册（非 `-32602`）、文本含 `[exitCode=64]`、不含 `[exitCode=3]`/「尚未实现」（映射断线/退化成桩即红）。
- hermetic 保证：`casey record` 空参在启动浏览器**之前**因缺 `caseId` 落 `dieUsage` exit 64（已实测），故不触真机。

## 涟漪回归（金牌外，gate acceptance 覆盖）

- 碰 `mcp/casey-server.mjs` → `node tests/_golden/cli-mcp-face.golden.mjs` 全绿（本文件即其漂移锁）。
- `node tests/_golden/record-intake.golden.mjs` / `record-capture.golden.mjs` 零行为差（未碰其 bin/lib）。
- `node bin/casey.mjs selftest --tier1` 无回归。
- `SKILL.md`/`README.md` 写入过 `term-lint`（PostToolUse hook 扫）。
- 重签后 `node loop-kit/bin/gate.mjs --prd loop/prd-cli-mcp-face.json` 复跑仍绿（`testChecksums` 已对齐新 sha）。

## 不做（本金牌不覆盖，留 route:human）

- `record` 浏览器 happy 路径（真机 + 凭据 + 站点）——非 hermetic，route:human。
- 真机 `MCP` 挂载后 codex/pi 上实调（`claude mcp add` 后 tools/call 实跑）——route:human 尾巴。
