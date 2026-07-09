# mcp-parity — `MCP` 面补齐 + 三面漂移锁加固（light）

> 起草态（零-baton）：本文只落计划骨架，未 `contract init`、未 gate、未提交。实现者继承时先 `casey contract init mcp-parity --lane light --reason "..."`。
> 解易用性审计 C3（摩擦点 F7/F8/F9）。决策见 `docs/plans/mcp-parity/proposed/GRILL.md`（D1–D10），红金牌断言清单见 `docs/plans/mcp-parity/proposed/GOLDEN-TESTPLAN.md`。

## 背景

三面统一标识符里 `MCP` 面滞后于 `CLI` 面：`casey record`/`casey intake` 已是真 `CLI` 命令（07-09 落），但 `mcp/casey-server.mjs` 的 `TOOLS` 仍 12 个、无这两条；漂移锁 `cli-mcp-face.golden.mjs` 只盯已声明工具、没有「`CLI` 生命周期命令集 ⊆ `MCP` 工具集」覆盖断言，故新命令没进 `MCP` 时金牌照绿；`package.json`（`0.1.0`）与 `SERVER_INFO`（`0.2.0`）版本漂移；`SKILL.md`/`README.md` 停在 12 工具口径。纯 `MCP` 的 agent（codex）因此做不了示教录制/入账。

## 0. 涟漪勘定与重签（先勘后动）

- **唯一冻结涟漪**：编辑 `tests/_golden/cli-mcp-face.golden.mjs` → 其 sha256 由 `loop/prd-cli-mcp-face.json` 的 `testChecksums` 冻结 → 须重签该 prd 的 `testChecksums` 到新值。本次只加断言（不放松既有），属 Test Ratchet 合法加严（护栏 #1）。
- **核实过的非涟漪**：`handover-pack`/`report-exit64` 两 prd 冻的是各自 golden，不冻 `cli-mcp-face.golden.mjs`，不受影响。
- **无冻结 schema 涟漪**：不碰 events/testcase/failure-ledger 等冻结 schema。
- **无新造词**：`record`/`intake`/示教录制/示教入账/示教入账台账 已在 `CONTEXT.md` 登记。

## 1. 改动清单

1. `mcp/casey-server.mjs`
   - `TOOLS` 在 `casey_sign` 后插入 `casey_record`、`casey_intake` 两工具（`inputSchema` 逐字对齐 `bin/record.mjs`/`bin/intake.mjs` 真旗标；`toArgs` 只对在场值拼旗标，映射见 GRILL D2）。
   - `SERVER_INFO.version` 改为从 `package.json` 读（`JSON.parse(readFileSync(join(ROOT,'package.json'),'utf8')).version`），不再写死字面量（GRILL D4）。
   - 协议/传输/退出码语义标注/就绪日志（`${TOOLS.length} 个工具`）机制零改——工具数自然从 12 变 14。
2. `package.json`
   - `version` `0.1.0` → `0.2.0`（单一事实源，GRILL D4）。
3. `tests/_golden/cli-mcp-face.golden.mjs`（编辑，红先行）
   - `EXPECT_TOOL_NAMES` 12→14（`casey_sign` 后插 `casey_record`、`casey_intake`），保留 `deepEq` 钉死（GRILL D6）。C2 描述文字 12→14。
   - C6 argv 映射表加 `casey_record`、`casey_intake` 两个全量入参 `deepEq` 用例。
   - 新增覆盖断言：从 `bin/casey.mjs` switch 源派生 `CLI` 命令集 − `EXCLUDED{help,breaker,contract,heal}`，对每命令断言 `casey_${snake}` ∈ `tools/list` 名集（GRILL D5）。
   - 版本断言改结构性验等：`package.json.version === serverInfo.version`（不再硬编码 `'0.2.0'`，GRILL D4）。
   - 可选并入：C5 `LIFECYCLE_EMPTY_EXIT` 加 `casey_record:64`/`casey_intake:64`（空参落真 bin 用法错码）。
   - 新增 `MCP` 层 intake happy 全管道断言（复现真 `record --from-events` 接缝产 capture → 经协议调 `casey_intake` → exit 0 + 真台账 accepted，见 GOLDEN-TESTPLAN A6）。
4. `loop/prd-cli-mcp-face.json`
   - `testChecksums["tests/_golden/cli-mcp-face.golden.mjs"]` 重签为编辑后新 sha256（涟漪 §0）。
5. `.claude/skills/casey/SKILL.md`
   - 底层命令映射表 `sign` 行后补 `record`/`intake` 两行真实签名（GRILL D7）；立场段一字不动。
6. `README.md`
   - `MCP` 挂载段「12 个工具…漂移锁」改 14 工具口径，点出含「`CLI`⊆`MCP`」覆盖断言（GRILL D8）。

## 2. 实现次序（红先行）

1. `contract init mcp-parity --lane light`。
2. 先改金牌（`cli-mcp-face.golden.mjs`）到 14 工具 + record/intake argv + `CLI`⊆`MCP` + 版本验等；跑一遍验**红基线**（现状 `MCP` 仍 12、`package.json` 仍 `0.1.0`，应红在：工具名集 14≠12、record/intake 工具不在目录、`casey_record`/`casey_intake` 不在名集、版本 `0.1.0`≠`0.2.0`）。
3. 实现 `mcp/casey-server.mjs` 两工具 + 版本读源；`package.json` bump。
4. 金牌转绿；重签 `prd-cli-mcp-face.json` `testChecksums`；补 `SKILL.md`/`README.md` 文档。
5. 涟漪回归 + gate。

## 3. 验收（红金牌，断言清单见 GOLDEN-TESTPLAN）

- 工具名集 14 `deepEq` 钉死；record/intake `toArgs` 全量入参 `deepEq`。
- `CLI` 生命周期命令集（switch 源派生 − `EXCLUDED`）⊆ `MCP` 工具集：任一命令无对应 `casey_*` 工具即红（含新加命令未进 `MCP` 的场景）。
- 版本单源一致：`package.json.version === serverInfo.version`。
- `MCP` 层 intake happy：经协议 `tools/call casey_intake`（真 `record` 接缝产的干净 capture）→ exit 0 + `intake-ledger.jsonl` 真落 accepted 条目、台账无凭据/无裸 `://`。
- record/intake 空参经 `MCP` → 落真 bin 用法错码 exit 64（浏览器前即退，hermetic）。
- 涟漪回归：碰 `mcp/casey-server.mjs` → `cli-mcp-face` 金牌全绿；碰 `bin/casey.mjs` 未动（本契约不改 `CLI` 分发）；`selftest --tier1` 无回归；`SKILL.md`/`README.md` 过 `term-lint`（写入即扫）；`record-capture`/`record-intake` 金牌零行为差。
- 门禁：`node loop-kit/bin/gate.mjs --prd loop/prd-mcp-parity.json` 全 acceptance exit 0（且 `prd-cli-mcp-face.json` 重签后 gate 复跑仍绿）。

## 4. route:human 尾巴（非阻断，非本契约 hermetic 验收）

- 真机 `MCP` 挂载核验：`claude mcp add casey` 后，在 codex/pi 上实调 `casey_record`（真浏览器示教）与 `casey_intake`（真 capture 入账），确认能挂能用、无凭据/目标地址泄漏（对应审计 R3/R4）。`record` 浏览器 happy 路径本身需真机 + 凭据 + 站点，不进 hermetic 金牌。

## 5. 非目标（本契约不做）

- 不接新业务（不蒸馏、不新增相位、不动 `run` 编排与 `lib`）。
- 不改 `MCP` 协议/传输实现、不动握手三方法。
- 不碰冻结内核（`verdict.mjs`/`replay.mjs`/schema）、不碰凭据·目标地址边界。
- 不暴露 `casey_heal`（诚实桩 exit 3，P6 真 bin 落地后另契约补，GRILL D3）。
- 不做 `MCP` 挂载配置打印（属 C6 `mcp-config` 另案）、不做分家接入文档（属 C7 另案）。
