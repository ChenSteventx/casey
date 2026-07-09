# run-convention 落地计划（plan）

> 目标：`casey run <caseId>` 支持 `cases/<caseId>/` 约定布局解析——缺文件旗标时先按约定路径取，取不到再报清晰用法错。解 `AUDIT-PLAN` 摩擦 F2 / 条目 C1。
> 车道：light（改 `bin` 分发分流 + `lib`，含故障关闭分支，值一道 plan 门）。触真机：否（hermetic，夹具 SUT）。
> 决策依据见同目录 `proposed/GRILL.md`（D1-D8）。本计划只描述改动与验收，实现须先 `casey contract init run-convention --lane light`（本包不代做）。

## 一、背景与现状诊断

`runPipeline`（`bin/casey.mjs:67-122`）把 `events`/`expected`/`profile`/`sut` 全列必填，缺一 `exit 64`，逼用户手带四条全路径（`real-zero-error-examples.md:34-45` 的八行复制块）。`casePaths`（`lib/paths.mjs:29-40`）是死 import（`casey.mjs:25` import 未用），且字段形状误述布局（有 `spec`/`report`/`verdict`，缺 `expected`/`profile`/`caseMeta`）。缺可选件时报告静默降级不告警。真实约定布局与五件的确切文件名见 GRILL D1。

## 二、方案（改哪几处）

### 2.1 `lib/paths.mjs` — 重塑 `casePaths` 字段形状（GRILL D6）

- 保留 `dir`/`events`/`observed`/`contract`；新增 `expected`（`expected.frozen.json`）、`profile`（`profile.json`）、`caseMeta`（`testcase.json`）；移除误述布局的 `spec`/`report`/`verdict`（零活跃消费者，安全）。
- 目的：字段形状对齐真实布局，供 `runPipeline` 调用。

### 2.2 `lib/paths.mjs` — `CASES_DIR` 加 env 覆盖（GRILL D7，测试接缝）

- `CASES_DIR = process.env.AT_CASES_DIR ? path.resolve(PROJECT_ROOT, process.env.AT_CASES_DIR) : path.join(PROJECT_ROOT, 'cases')`，与 `AT_SITE_JSON`/`AT_CREDS_FILE` 同范式；绝对值保持绝对路径，相对值固定按 `PROJECT_ROOT` 解析，避免调用者 cwd 漂移。
- 目的：金牌把用例根指向 tmp 夹具，hermetic 测约定解析，零污染真实 `cases/` 树。

### 2.3 `bin/casey.mjs` — `runPipeline` 约定解析（改约 `:68-113`）

- 复活死 import：`caseId` 在场时 `const cp = casePaths(caseId)`。
- 每件按 GRILL D3 顺序解析（显式旗标恒赢 → 缺则约定路径存在即取 → 否则记缺）：`events`/`expected`/`profile`/`observed`/`caseMeta` 五个局部量替代直接读 `opts.*`。
- 必填分诊（GRILL D4）：`events`/`expected`/`profile` 三件 + `opts.sut` 任一仍缺 → `exit 64`，逐条点名缺件与约定查过的相对路径（仓内相对路径非敏感；绝不回显 `site.json`/凭据）。
- 可选降级告警（GRILL D4）：`observed` 或 `caseMeta` 缺 → 打一行可见 stderr 告警（报告将降级：期望版本/签署人投影缺失、`naturalLanguage` 缺失），照跑不拦。
- 下游接线：`:100-113` 的 `stage()`/`rmArgs` 里 `opts.events`/`opts.expected`/`opts.profile`/`opts.observed`/`opts['case-meta']` 换成解析后的五个局部量；其余（`--sut`/`--run-dir`/`--login-bootstrap`/`--no-video`/`--generated-at`）不动。

### 2.4 `bin/casey.mjs` — help 补约定用法（`:177-217`）

- `端到端` 段补一行：`casey run <caseId> --sut <本地基址>`（其余五件按 `cases/<caseId>/` 约定自动解析；显式旗标可覆盖）。无 help 快照金牌，纯文档改、不触发 re-sign。

## 三、涟漪勘定

| 面 | 会不会动 | 结论 |
|---|---|---|
| `cli-mcp-face.golden.mjs` C5（空 `casey_run` → 64） | 否 | `casey run` 无 caseId 仍 `exit 64`，`[exitCode=64]` 不变，green，不 re-sign。 |
| `cli-mcp-face.golden.mjs` C6（`casey_run` `toArgs` deepEq） | 否 | 全字段输入照拼全旗标，`toArgs` 不改（GRILL D8），deepEq 不变，green，不 re-sign。 |
| `e2e-chain.golden.mjs` C7（全显式 `casey run`） | 否（行为） | 五件旗标全显式 → 显式恒赢 → 产物逐字节不变，green。观测/元数据缺席会多一行 stderr 降级告警，C7 不断言 stderr 空、不受影响。 |
| MCP `casey_run` | 否（代码） | `toArgs`（`casey-server.mjs:102`）条件拼旗标，调用方省旗标即自动继承约定，零改。`inputSchema.required` 放宽是可选优化、归 C3。 |
| help 快照 | 无 | 全仓无 help 快照金牌（已核 `tests/_golden/`），help 改动自由。 |
| `handover-pack.golden.mjs` | 否 | 不引入任何凭据形内容或非回环 URL。 |
| 现有全部金牌 | 否 | 无冻结金牌需 re-sign；新增能力靠新金牌红先行守（见 GOLDEN-TESTPLAN）。 |

隐患一条（记账）：`e2e-chain` C7 用 `CASE_ID='tc_e2e_chain'`，约定解析对 `observed`/`case-meta` 会探真实 `cases/tc_e2e_chain/`（当前不存在 → 缺 → 降级告警，green）。若日后有人建了该目录会污染 C7。彻底封印需给 C7 补 `AT_CASES_DIR` 指空 tmp——但那要 re-sign 一个冻结金牌，取舍留实现者/人裁（见 route:human）。

## 四、验收

hermetic 全绿即收口，红先行金牌见 `proposed/GOLDEN-TESTPLAN.md`：

1. 新金牌 `run-convention`（light）实现后全绿；实现前 A1/A2/A4/A5/A6/A7 应红（缺约定解析）、A3 可能已绿（缺 caseId 现已 64）。
2. 约定布局仅 `casey run <caseId> --sut <夹具>`（无文件旗标）→ `exit 0`、落报告三件 + `verdict.json`（A1）。
3. 显式旗标覆盖约定（A2）；缺 caseId `exit 64`（A3）；必填件缺 `exit 64` 点名缺件、非崩（A4）；可选件缺 → `exit 0` + 可见降级告警行（A5）。
4. 既有全显式调用零行为差回归（A6）。
5. `casePaths` 字段形状对齐真实布局、死 import 复活（A7）。
6. 现有全部金牌仍绿（尤重 `cli-mcp-face` C5/C6、`e2e-chain` C7），无冻结金牌被 re-sign。
7. `casey lint --registry` 干净、本包新增文档 `term-lint` 干净；`gate --prd loop/prd-run-convention.json` 翻绿（唯一写 `passes`）。
8. 凭据与真目标地址零泄漏：`exit 64` 报文只含 `cases/<caseId>/…` 仓内相对路径，绝不回显 `site.json`/凭据（A8）。

## 五、车道与阶段互锁

- 车道 light：改 `bin` 分发 + `lib`，含故障关闭分支。实现前必 `casey contract init run-convention --lane light --reason "run 约定布局解析，缩八旗标为 caseId+--sut"`；金牌须先冻结（`acceptance-gate`）方可动 `lib`/`bin`（护栏 #11）。
- 本包零 baton：未 `contract init`、未 gate、未提交、未写 `tests/` 金牌，只起草三份文档。

## 六、route:human / 开放项

1. D7 接缝取舍（`AT_CASES_DIR` vs 一次性用例目录）+ 是否给 `e2e-chain` C7 补封印（re-sign 冻结金牌值不值）。
2. `--sut` 从 `site.json` `devProxyUrl` 自动反解——跨凭据边界，另起契约，非本契约目标。
3. 真机用约定布局跑一次是 route:human 尾巴（要隧道 + `autotest` 账户 + Steven 在场），不进本契约 hermetic 验收。
4. 异构评审：本包 Claude 起草，实现落地后须交 codex 异构评审（评审家族≠实现家族）。
