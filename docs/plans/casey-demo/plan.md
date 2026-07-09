# casey-demo 落地计划（plan）

> 目标：`casey demo` —— 一句话零真机零凭据（需本机 chromium）产出一份可打开的样例测试报告，作为新用户/新同事「先看到 Casey 产物长啥样」的入口。把现成的 `scripts/sample-report.mjs` 转正成 `CLI` 子命令，并接进 `skill` 与 `README`。解 `AUDIT-PLAN` 摩擦 F1 / 条目 C2。
> 车道：light（改 `bin` 分发分流 + help + 提升一个 bin 脚本；纯加法、无冻结内核改动，值一道 plan 门）。触真机：否（hermetic，夹具 SUT，无 route:human 尾巴）。
> 决策依据见同目录 `proposed/GRILL.md`（D1-D9）。本计划只描述改动与验收，实现须先 `casey contract init casey-demo --lane light`（本包不代做）。

## 一、背景与现状诊断

`scripts/sample-report.mjs` 已能零真机零凭据跑出一份自包含 `PASS` 报告（手写工作流「发布」样例三件套 → 启夹具 SUT → 串 `replay`→`verdict`→`report-model`→`report` → 落 `runs/sample-wf-publish/`）。本包实证：exit 0、2 步全 `PASS`、报告含裁定徽章「通过」、三产物全文零 `://` 零 host。但它对用户不可见——不是子命令、`SKILL.md` 无它、`README`「环境验收」只指跑金牌。新同事没有一句自然语言问出「样例报告长啥样」的入口，除非上真机。现状两瑕疵：`:85` 硬编码 `/mnt/d/`→`D:\` 路径提示（跨平台失真）、`:11` 生产脚本引测试 helper `_sign-helper`。

## 二、方案（改哪几处）

### 2.1 提升 `scripts/sample-report.mjs` → `bin/demo.mjs`（GRILL D3 甲）

- 把现驱动移到 `bin/demo.mjs`，语义一字不改：固定 caseId `tc_wf_publish_sample`、固定 runDir `runs/sample-wf-publish/`、清建幂等（GRILL D1）；样例三件套 + 夹具 SUT + 串四段既有冻结 bin（复用相6 渲染，GRILL D2）。
- 顺手清理二处（不改语义）：
  - 去 `_sign-helper` 耦合——样例 `expected` 的签署字段（signedAt/signedAgainstBuild/signerId）内联成样例常量，`bin/demo.mjs` 不再 import 测试件；报告「期望版本/签署人」投影照旧（`report-model` 逐条核 `isSigned`）。
  - 去 `/mnt/d/` 硬编码——打印「可打开路径」按真实绝对路径给跨平台提示，不字面替换盘符（GRILL D5）。
- 目的：子命令实现落在每个子命令都在的 `bin/`，与 `ingest`/`compile`/`replay` 等六先例一致。
- 备选（GRILL D3 乙，低涟漪）：脚本原地留、门面直通它——留开放项，实现者/人裁二选一。

### 2.2 `bin/casey.mjs` — 门面接线 + help 行

- main switch 加一分支：`case 'demo': { const r = runNode(path.join(PROJECT_ROOT, 'bin', 'demo.mjs'), rest); process.exit(r.code); }`（同 `ingest`/`compile`/`report` 直通范式，`casey.mjs:239-253`）。
- help 加一行（避开 handover-pack C2 黑名单，GRILL D7）：`casey demo` 零参、无 `--sut`、无文件旗标。建议落「自检/上手」邻位：`casey demo    零真机零凭据产一份样例测试报告（落 runs/sample-wf-publish/，需 chromium）`。全仓无 help 快照金牌（已核 `tests/_golden/`），help 改动自由。

### 2.3 `.claude/skills/casey/SKILL.md` — 自然语言入口（纯文档）

- 「用户怎么说」补一句样例：「给我看一份样例报告 / Casey 产物长啥样 / 先看看报告长什么样」。
- 「内部动作表」补一行：`看样例报告/Casey 产物长啥样 | 跑 casey demo（零真机零凭据，需 chromium），返回 runs/sample-wf-publish/ 下 report.{html,md,json} 链接与「通过」四态计数`。
- 「底层命令映射」补一行：`看样例报告 | node bin/casey.mjs demo`（零参）。
- 措辞守自然语言操作面：agent 内部跑、只回 html 链接 + 四态摘要，不把命令抛给用户。

### 2.4 `README.md` — 环境验收列为可跑项（GRILL D6 诚实定位）

- 「环境验收」第 2 级（hermetic 回放就绪，需 chromium）伴随位加一条：「看样例报告：`node bin/casey.mjs demo`——零真机零凭据出一份自包含 `PASS` 报告（含裁定徽章），落 `runs/sample-wf-publish/`」。
- 明确它与第 1 级 `selftest --tier1` 的区别：demo 需 chromium、不是零依赖；不冒充「零依赖一句话出报告」。
- 守 handover-pack C1：不引入任何凭据形关键词、URL 全回环或无 URL（demo 行无 URL），凭据带外纪律不动。

## 三、涟漪勘定

| 面 | 会不会动 | 结论 |
|---|---|---|
| `cli-mcp-face.golden.mjs` C5/C6（MCP 工具集 deepEq） | 否 | 本契约不加 MCP `casey_demo`（GRILL D8），`TOOLS` 12 个不变，deepEq 不动，不 re-sign。 |
| `handover-pack.golden.mjs` C1（README 八节锚 + 凭据卫生） | 否 | 新增一条无 URL、无凭据形关键词的验收项；八节锚不删，green。 |
| `handover-pack.golden.mjs` C2（help 无黑名单形态） | 否 | demo help 行零参、无 `--sut <url>`/`run <file>` 等黑名单 token（GRILL D7），green。 |
| `handover-pack.golden.mjs` C3（SKILL 无 D:\\ctx 硬编码） | 否 | SKILL 新增行不含盘符硬编码；顺带把 demo 驱动的 `/mnt/d` 提示改成跨平台，反而更干净。 |
| `e2e-chain.golden.mjs` 及全部相6/回放金牌 | 否 | demo 是新子命令、走独立夹具三件套，不碰既有链路与冻结 bin 行为；相6 渲染复用不改 `lib/report.mjs`。 |
| `docs/HANDOFF.md`/`docs/plans/sign|e2e-chain`（历史提 `scripts/sample-report.mjs`） | 视 D3 取舍 | 采甲（提升为 `bin/demo.mjs`）则这些历史句失指，实现者顺带刷新或接受；采乙则零失指。记账、留开放项 1。 |
| 现有全部金牌 | 否 | 无冻结金牌需 re-sign；新增能力靠新金牌 `casey-demo` 红先行守（见 GOLDEN-TESTPLAN）。 |

## 四、验收

hermetic 全绿即收口，红先行金牌见 `proposed/GOLDEN-TESTPLAN.md`：

1. 新金牌 `casey-demo`（light，需 chromium）实现后全绿；实现前 A1-A5 应红（无 `casey demo` 子命令时 `exit 64` 未知命令、产不出报告、help 无该行）。
2. `casey demo`（零参）→ `exit 0`，`runs/sample-wf-publish/` 下落 `tc_wf_publish_sample.report.{html,md,json}`（A1）。
3. 报告含裁定徽章、逐步 `PASS`、自包含可打开（无外链/无 script）（A2）。
4. 三产物 + stdout/stderr 全文零凭据形关键词、零 `://`（A3）。
5. `casey help` 暴露 `casey demo` 且不含 handover-pack C2 黑名单 token（A4）。
6. 幂等/固定落点：连跑两次落同一 runDir、caseId 固定、清建覆盖（A5）。
7. demo 不依赖凭据：`AT_SITE_JSON`/`AT_CREDS_*` 毒化仍 `exit 0`、产物零泄漏（A6）。
8. 跨平台路径提示不含 `/mnt/d` 字面硬编码（A7）。
9. 现有全部金牌仍绿（尤重 `cli-mcp-face` C5/C6、`handover-pack` C1/C2/C3），无冻结金牌被 re-sign（A8）。
10. `casey lint --registry` 干净、本包新增文档 `term-lint` 干净；`gate --prd loop/prd-casey-demo.json` 翻绿（唯一写 `passes`）。

## 五、车道与阶段互锁

- 车道 light：改 `bin` 分发 + help + 提升一个 bin 脚本 + 纯文档（skill/README）；无冻结内核改动，纯加法。实现前必 `casey contract init casey-demo --lane light --reason "样例报告转正为 casey demo 子命令，零真机零凭据看 Casey 产物"`；金牌须先冻结（`acceptance-gate`）方可动 `bin`（护栏 #11）。
- 本包零 baton：未 `contract init`、未 gate、未提交、未写 `tests/` 金牌，只起草三份文档。

## 六、route:human / 开放项

1. D3 甲/乙取舍（提升为 `bin/demo.mjs` 合范式但历史文档失指 vs 脚本原地留门面直通、零失指）。
2. MCP `casey_demo` 是否在 C3/mcp-parity 顺手补（让只走 MCP 的 agent 也能看样例报告），或本轮先只 CLI+skill+README（GRILL D8）。
3. 跨平台路径提示的具体形态（是否给 win32 形态），实现者定稿，金牌只钉「不含 `/mnt/d` 硬编码」。
4. 异构评审：本包 Claude 起草，实现落地后须交 codex 异构评审（评审家族≠实现家族）。
5. 无真机尾巴：本契约 hermetic 完整收口，不排 route:human。
