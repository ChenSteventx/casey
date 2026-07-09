# run-convention 决策记录（GRILL）

> 契约包起草：`casey run <caseId>` 约定布局解析。让用户不用手抄一长串文件旗标，`casey run` 缺参时先按 `cases/<caseId>/` 约定布局自动解析，取不到再报清晰用法错。
> 事实源：`bin/casey.mjs` 的 `runPipeline`（`:67-122`）、`lib/paths.mjs` 的 `casePaths`（`:29-40`）、真实 `cases/*` 布局（`tc_catalog_wf_crud` / `tc_wf_history_version` / `tc_wf_publish_states` 三条建齐的用例）、`docs/runbooks/real-zero-error-examples.md`（八行 `RUN_ID` 复制块）、`tests/_golden/e2e-chain.golden.mjs`（C7 十站链 `casey run`）、`tests/_golden/cli-mcp-face.golden.mjs`（C5/C6 门面漂移锁）。对应审计条目：`docs/plans/usability-audit/proposed/AUDIT-PLAN.md` 摩擦 F2 / 条目 C1。
> 纪律：起草期零 baton；2026-07-09 经 Steven 点选后进入 `run-convention` light 契约。用户操作面只收自然语言，凭据与真目标地址不进任何输出。

## grill 收口（2026-07-09）

- D7 采 `AT_CASES_DIR` 注入用例根，不向真实 `cases/` 写一次性探针；本契约不顺带改 `e2e-chain`，避免重签既有冻结金牌。
- `AT_CASES_DIR` 若给相对值，固定按 `PROJECT_ROOT` 解析，不随调用者 cwd 漂移；绝对值保持不变。
- 可选件缺失告警走 stderr，保持 stdout 给产物路径/摘要使用；告警必须可见，不能静默降级。
- `--sut` 仍显式必填，本契约不从 `site.json`/`devProxyUrl` 自动反解，避免跨凭据边界。
- 真机约定布局跑通列 route:human 尾巴，不进入本契约 hermetic 验收。

## 现状诊断（落到文件与行号）

- `runPipeline`（`bin/casey.mjs:70`）把 `caseId && opts.events && opts.expected && opts.profile && opts.sut` 全列为必填，缺一即 `exit 64`。用户被逼手带四条文件全路径 `--events`/`--expected`/`--profile`（外加可选 `--observed`/`--case-meta`），正是 `real-zero-error-examples.md:34-45` 那段八行 bash 复制块。
- `bin/casey.mjs:25` 把 `casePaths` import 进来后从未调用（死 import）。
- `casePaths`（`lib/paths.mjs:29-40`）字段形状对不上真实布局：给了 `spec`（`<caseId>.spec.ts`，编译产出的是 `events.json`、从不产 `.spec.ts`）、`report`（`<caseId>.report.html`，那是 `runs/` 下的回放产物，不在 `cases/`）、`verdict`（回放产物、非 `run` 输入）；却缺 `run` 真正要的 `expected.frozen.json`、`profile.json`、`testcase.json`。
- 缺可选件 `--observed`/`--case-meta` 时报告静默降级（期望版本投影不出、`naturalLanguage` 缺失）却不告警（`runPipeline:107-109` 只在旗标在场才透传，缺席无声）。
- 真实约定布局（读 `cases/tc_catalog_wf_crud/` 等建齐用例，与 runbook 复制块逐一吻合）：
  - `cases/<caseId>/events.json`
  - `cases/<caseId>/expected.frozen.json`
  - `cases/<caseId>/profile.json`
  - `cases/<caseId>/observed-<caseId>.json`（注意带 caseId 后缀）
  - `cases/<caseId>/testcase.json`（纯名、无 caseId 后缀；区别于 ingest 的 out-dir 产物 `testcase-<caseId>.json`）

## 决策

### D1 约定布局的精确定义

`casey run <caseId>` 的五件按约定各锚一个确切文件名，全部相对 `cases/<caseId>/`：

| run 参数 | 约定文件 | 必填/可选 | 依据 |
|---|---|---|---|
| `--events` | `cases/<caseId>/events.json` | 必填 | 真实布局 + runbook |
| `--expected` | `cases/<caseId>/expected.frozen.json` | 必填 | 真实布局 + runbook |
| `--profile` | `cases/<caseId>/profile.json` | 必填 | 真实布局 + runbook |
| `--observed` | `cases/<caseId>/observed-<caseId>.json` | 可选 | 真实布局；`casePaths` 现已算对此名 |
| `--case-meta` | `cases/<caseId>/testcase.json` | 可选 | 真实布局 + runbook |

决策：约定名钉死为以上五个，不做模糊匹配、不扫目录猜文件。`--observed` 用带 caseId 后缀的名、`--case-meta` 用纯 `testcase.json`，两处命名差异照真实布局如实登记，不强行统一。

### D2 `--sut` 不进约定（关键决策）

`--sut` 是运行期地址（隧道回环基址或夹具地址），不是用例目录里的静态制品，`cases/<caseId>/` 里没有也不该有它。从 `site.json` 的 `devProxyUrl` 反解 `--sut` 会跨进凭据文件边界（护栏 #7：`site.json` 内容不得进任何输出）。

决策：`--sut` 保持显式必填，不进 C1 约定范围。约定解析后最小命令是 `casey run <caseId> --sut <本地基址>`——八旗标塌成一旗标加 caseId。自然语言操作面上，`--sut` 由 skill/agent 内部按 `devProxyUrl` 填入、用户永不手打。「从 `site.json` 自动解析 `--sut`」列为非目标（见 D8），若要做另起契约、单独过凭据边界评审。

理由：一句「仅 caseId 就跑」的直觉会误以为 `--sut` 也自动解析；这里显式定死为不解析，避免把凭据边界偷偷带进本契约。

### D3 缺省解析顺序：显式旗标优先于约定

对五件里的每一个：

1. 显式旗标在场 → 原样采用（显式恒赢，不被约定覆盖）。
2. 旗标缺席且 caseId 在场 → 计算约定路径，文件存在则采用。
3. 旗标缺席且约定文件不存在 → 记为「缺该件」，进 D4 分诊。

「显式恒赢」是向后兼容既有全显式调用的地基（见 D5）。

### D4 缺件分诊：必填 fail 清晰用法错，可选 fail 可见降级告警，都不静默、不崩

- 必填四项（`events` / `expected` / `profile` 三件 + `--sut`）经约定解析后仍缺任一 → `exit 64`，逐条点名缺哪件、以及约定查过的相对路径（`cases/<caseId>/…` 是仓内相对路径、非敏感，可回显；绝不回显 `site.json`/凭据）。故障关闭，不静默降级、不崩栈。
- 可选两项（`observed` / `case-meta`）经约定解析后缺席 → 照跑 `exit 0`，但打一行可见告警：报告将降级（期望版本与签署人投影缺失、`naturalLanguage` 缺失）。修掉 F2 的「静默降级不告警」。
- caseId 本身缺席（`pos[0]` 为空）→ `exit 64`（没有 caseId 无从约定解析），沿用现有行为。

### D5 向后兼容既有全显式调用

约定解析纯做「缺参兜底填充」，只在旗标缺席时触发。凡把 `--events`/`--expected`/`--profile`（及 `--observed`/`--case-meta`）全带齐的既有调用——`real-zero-error-examples.md` 的复制块、`e2e-chain.golden.mjs:195` 的 C7——行为逐字节不变。回归金牌钉死零行为差（见 GOLDEN-TESTPLAN A6）。

### D6 修 `casePaths` 字段形状 + 复活死 import

`casePaths`（`lib/paths.mjs`）当前是死 import、且字段形状误述布局，零活跃消费者（全仓仅 `casey.mjs:25` import 而不调用），可安全重塑：

- 保留：`dir`、`events`、`observed`、`contract`。
- 新增：`expected`（→ `expected.frozen.json`）、`profile`（→ `profile.json`）、`caseMeta`（→ `testcase.json`）。
- 移除误述布局的 `spec`（从不产 `.spec.ts`）、`report`（是 `runs/` 产物）、`verdict`（是回放产物、非 run 输入）。

`runPipeline` 改为真正调用 `casePaths(caseId)` 做约定解析——一举复活死 import、对齐字段形状。

### D7 测试性接缝：`CASES_DIR` 可注入（推荐 `AT_CASES_DIR`）

`cases/` 全目录 gitignore（`.gitignore` 明列），CI/hermetic 环境里不可复现真实用例目录；而约定解析硬锚 `CASES_DIR = PROJECT_ROOT/cases`。要 hermetic 地测约定解析，需一个可注入的用例根：

- 推荐（选项甲）：`CASES_DIR` 加 env 覆盖 `process.env.AT_CASES_DIR || path.join(PROJECT_ROOT, 'cases')`，与既有 `AT_SITE_JSON`/`AT_CREDS_FILE` 范式（`lib/login-bootstrap.mjs:32/53`）一致。金牌把 `AT_CASES_DIR` 指向 tmp 夹具、全程在 tmp 内造约定布局，零污染真实 `cases/` 树。
- 备选（选项乙）：金牌往真实 `CASES_DIR` 下写一次性 `cases/_run_conv_probe/` 再清扫（`selftest` 造 `cases/_selftest` 的先例，`casey.mjs:138`）。零 `lib` 改动，但污染真实树、崩溃留残、并发相撞。

决策：推荐选项甲。附带收益——任何调 `casey run` 的金牌（含 `e2e-chain` C7）都能借 `AT_CASES_DIR` 把约定解析从真实 `cases/` 树封起来（否则某人日后建了 `cases/tc_e2e_chain/observed-*.json` 会污染 C7）。是否给 `e2e-chain` 也补这一行是 re-sign 取舍，留实现者/人裁（见开放项）。

### D8 非目标

- 从 `site.json` 反解 `--sut`（跨凭据边界，另起契约）。
- 触碰相0-2 前段与 LLM 边界。
- 给 `casey run` 加任何新用户旗标（约定纯做缺省填充；`AT_CASES_DIR` 仅测试接缝、非用户面）。
- 改 MCP 的 `casey_run` `toArgs`（`mcp/casey-server.mjs:102` 的 `toArgs` 是条件拼旗标，缺项不拼，MCP 调用方省旗标即自动继承约定，零改；`cli-mcp-face` C6 逐字 deepEq 因此不动）。放宽 `casey_run` `inputSchema.required` 是可选优化，归 C3。
- 触碰真机（本契约 hermetic 收口，夹具 SUT）。

## 后续挂账

1. `--sut` 自动化（从 `devProxyUrl` 反解）需另起契约，单独过凭据边界评审。
2. 真机侧用约定布局跑一次是 route:human 尾巴（要隧道 + `autotest` 账户），不进本契约 hermetic 验收。
