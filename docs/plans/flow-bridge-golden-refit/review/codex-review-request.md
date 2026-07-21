# codex 异构评审请求：flow-bridge-golden-refit 实现

你是异构评审方（codex gpt-5.6-sol），评审 Claude 家族的实现。只评本请求列出的文件与风险，不全仓漫游、不派子代理、不改任何文件（read-only）。

## 基线与目标

契约修 2026-07-17/18 三波信任根收紧（dfee72c 桥闸实体绑定 / 05573d1 intake 三件套 / edea1f9 canonical 固定根）落地未复跑受影响冻结金牌（护栏 #19）留下的六条陈旧绿。全部**修夹具侧、生产零改**（lib/ bin/ 字节不动）。设计判定：桥闸不代猜实体角色是正确设计意图，金牌该显式给绑定。

spec：`docs/plans/flow-bridge-golden-refit/plan.md`（v5，sol max 五轮共识 R5 终判可进 accept）、`GRILL.md`、`accept/`（红基线/执行账/B2 三列账审计件，均 accept 时冻结）。

## 评审文件白名单

修改（跑 `git diff -- <path>` 看变更）：
- `tests/_golden/flow-bridge.golden.mjs`（A：happy+负向补 entityBindings、精确拒因、C17 反向锁）
- `tests/_golden/ingest.golden.mjs`（A：MAPPING 补 entityBindings）
- `tests/_golden/cli-mcp-face.golden.mjs`（B1：A6 重建 MCP intake happy）
- `tests/_golden/record-distill.golden.mjs`（B2：改形 + 三列账迁移）
- `tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs`（B3：改 bootstrap 段）
- `docs/plans/bootstrap/plan.md`、`docs/plans/integrate-regress-agent-tool-slice/plan.md`、`docs/plans/p2-intent-compile/plan.md`（C：弃用别名改「原子候选」）

新增（直读全文）：
- `tests/_golden/teachin-observation-authority-root.worker.mjs`（B3 worker 段：loader 生效进程内跑全部断言）
- `tests/_golden/support/ephemeral-driver-publication.mjs`（三金牌共用：临时 Ed25519 动态签名/发布件）
- `tests/_golden/support/refit-regate-verify.mjs`（s4 复 gate 校验器）

生产侧（只读核实零改，别改）：`lib/flow-bridge.mjs`、`bin/distill.mjs`、`lib/teachin-identity-package-validator.mjs`、`lib/teachin-observation-authority-root.mjs`。

## 风险清单（逐条给判断）

1. 夹具是否倒着裁到预定裁定（rig）：金牌补的 entityBindings / 手造三件套是否忠实复现已冻接缝，还是为过而造。C17 反向锁断言是否真验「mutation 缺绑定必拒 ENTITY_BINDING_REQUIRED_ROLES_INVALID + exit 65 + 零落盘」。
2. B2 迁移拒因是否名副其实：C2d 断 CAPTURE_URL_LEAK、C2f/C2h 断 CRED_GATE_HIT，这些是内核真实吐出的拒因（`lib/teachin-identity-package-validator.mjs` / `bin/distill.mjs` 执法链），还是断言迁就。直调纯函数红证（record-distill.golden.mjs 尾段）是否真打在执法点。
3. B2 四丢失项挂账是否诚实：record producer 真产出 / record→intake 字节接缝 / 旧单文件布局 / distill 内联编码门行为覆盖——是否如实记丢失（非伪称已迁移），接手条件是否可执行。
4. B1 未降级是否成立：MCP intake happy（有 loader → exit 0 + 台账 generation 2 accepted）+ 独立正控（直调 intake accepted generation 1）+ 成对证据（无 loader 拒 DRIVER_NOT_PUBLISHED + 台账字节零变化）是否构成真覆盖，正控/成对基线逻辑是否自洽。
5. 租约卫生：每份租约 try/finally、测试体无裸 process.exit（B3 bootstrap 末尾统一算退出码）、cleanup().ok 校验、cases/ 零残留。
6. 生产零改是否属实：lib/ bin/ 字节未动（git 应无 lib/bin 变更），拒因全从既有执法点带出。
7. SKILL.md:107 底线：无任何 agent 起/连/回放 fake-SUT；zero-SUT 金牌是否真零 SUT。
8. mutant 突变红证是否有效（见证据），s4 复 gate 校验是否真对账预期翻转而非放水。

## 现成证据（读，别复跑金牌）

- `docs/plans/flow-bridge-golden-refit/evidence/mutant-proof.md`：反向锁内核 mutant——隔离树 baseline GREEN(17/0) → mutant RED(16/1，唯一翻红 C17) + 主树字节前后 sha 一致。
- `docs/plans/flow-bridge-golden-refit/HUMAN-SIGN.md`：ADR-0004 冻结面人签清单（六 owner 重签 old→new、两新件纳入、B2 三列账、B1 未降级），Steven 已签三项。
- 复 gate 收口：全 22 prd 已复 gate，s4 校验器 `refit-regate-verify.mjs` 报 41 过 / 0 败（35 绿刷新 + 4 红→绿 + 2 隔离恒红保持诚实 false）；契约 prd gate GREEN 4/4。
- B 三金牌本地退出码：cli-mcp-face 12/0 exit 0、record-distill exit 0、authority-root（重签后）11/11 exit 0。

## 产出格式

给结论 `PASS` 或 `FAIL`，逐条风险给判断（成立/存疑/缺陷），缺陷标严重度（Critical/High/Medium）+ file:line + 具体失败场景。只报你真核到的，别臆测。若判 PASS，明说依据。
