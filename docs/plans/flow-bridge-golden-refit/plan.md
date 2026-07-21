# plan — flow-bridge-golden-refit（内核收紧未复跑六条陈旧绿统一处置）

> 车道 full。决策源 `GRILL.md`（D1 修夹具侧 / D2 三家族全扫 / D3 全量复 gate，Steven 2026-07-21 裁）。
> **本稿 v4 = 并入 sol max R1-R3 全部阻断**（`review/sol-consensus-reply-r{1,2,3}.md`）。R3 认 C8/B2/执行账消解；v4 补 R3 四硬阻断：① mutant 树内先投影冻结金牌（sha 核一致）+ 同树 baseline GREEN→mutant RED 对照 ② B1 台账基线改「无 loader 跑后台账字节零变化、有 loader 跑后恰增一条 accepted」（正控写过台账，「零台账」不成立）③ B3 的 prd acceptance 保持裸 node 入口（bootstrap 即金牌本体），撤回「acceptance 命令带 loader」旧要求 ④ 人签/checksum 清单闭合：五入口金牌 + worker + support 件全列，support 注册进三个依赖 prd，旧无签名 receipt 夹具保留作负例。**v5 = R4 仅余一处 v3 残留括注（B3 acceptance 命令变更）已删——B3 acceptance 字符串不变、只新增 worker/support checksum。待 R5 终判。**

## 一句话

2026-07-17/18 三波信任根收紧（dfee72c 桥闸实体绑定 / 05573d1 intake 三件套 / edea1f9 canonical 固定根）落地未复跑受影响冻结金牌（护栏 #19），留六条陈旧绿。全部修夹具侧、生产零改：A 家族补显式绑定（happy 与**负向非目标原子**都补）+ 精确拒因断言 + 内核 mutant 突变证伪的反向锁；B 家族换**临时密钥动态签名**先例改形（租约 + 手造三件套 + 动态签 receipt + 测试发布 loader），三列账诚实记语义迁移；C 家族单行术语正名。全部改动与重签**先定稿人签，后按冻结执行账固定顺序一次性复 gate**，接受连带诚实红。

## 取料修正（覆盖 GRILL 背景节两处不准）

- committed 事务条目 **20 字段**（`lib/record-distill.mjs:26-31` 与 `lib/teachin-observation-authority-root.mjs:270-275` 键集一致），非诊断初记的 22。
- A6 不照 05573d1 退役先例：A6 是全仓唯一经 MCP JSON-RPC 调 `casey_intake` 的覆盖（接手金牌零 MCP 触点），改纯负向=MCP 层 intake 成功分支零覆盖。首选重建 happy（B1），降级须过机械判据。

## 家族 A：dfee72c 桥闸（flow-bridge + ingest）

绑定合法形状（`lib/entity-semantic-lock-preflight.mjs:495-507/:446-476/:15`）：恰两字段 `{candidateId, role}`，role ∈ {subject,source,target} 同 step 不重复，按 policy 精确角色集匹配；`workflow.create`（:45）与 `workflow.save`（:419 兜底）均 mutation/恰一 subject。现役绿先例：`teachin-semantic-lock-flow-provenance.zero-sut.golden.mjs:13-16`。

1. **happy 修复**：`flow-bridge.golden.mjs:39-42` 共享 MAPPING 两步 + `ingest.golden.mjs:42-44` 独立 MAPPING 两步，各补 `entityBindings: [{ candidateId: 'candidate-workflow-main', role: 'subject' }]`。级联修复 C2/C3/C6(happy 半段)/C9(happy 半段)/C11 与 ingest C3。
2. **负向分支防错因假绿（R1-① + R2-①）**：C4/C5/C6(badPrefix 段)/C7 两分支/**C8 凭据门**/C15(桥拒半段) 的**非目标/mutation 原子全部补合法 subject 绑定**，断言从「仅非零」收紧到**精确目标诊断**——C4 断「未知原子」拒因、C5 保持「编译知识」精确断言、C6 断 uniquePrefix 拒因、C7 断投影忠实拒因（漏覆盖/凭空 intentId 各自）、**C8 断 exit 1 + 凭据门精确诊断 + 零落盘**（R2 逮：leaky mapping 缺绑定时凭据门回归会被实体闸以另一原因接拒、照样绿）、C15 断原型链原子拒因。C10 保留宽口径（「任一闸拒不留半份」本就是它的语义）。C12-C14/C16 结构闸先于实体闸，零改动。
3. **反向锁**（新增 check）：mutation 步缺 `entityBindings` → exit 65 + stderr 含精确错误码 `ENTITY_BINDING_REQUIRED_ROLES_INVALID`（`preflight.mjs:481/:489`，桥闸 `flow-bridge.mjs:132` 带出）+ 零落盘。
4. **突变证伪（R1-② + R2-② + R3-①：一次性 worktree + 冻结投影 + 同树对照）**：full 车道 accept 未 done 时不得改主树实现（`contract.mjs:69` 互锁），且 worktree 从 HEAD 起、不含主树未提交的新反向锁金牌（`contract.mjs:305`）。流程：起临时树 + 树内 `contract init mutant-probe --lane direct`（独立 baton，护栏 #18）→ **把冻结定稿的 flow-bridge 金牌与其夹具投影进树内并 sha256 核与主树冻结值一致** → **树内先跑 baseline 必 GREEN** → 树内绕掉 `lib/flow-bridge.mjs:132` 的 `requiredFlowEntityBindings` 调用（mutant）→ 同树重跑、**反向锁同一 check 必 RED** 实录 → 删树/临时分支。GREEN→RED 同树对照才能把红归因于 mutant。主树字节全程未动（改前后 sha256 双录核一致）。移除夹具绑定那种「突变」无效。

## 家族 B：05573d1/edea1f9 intake-固定根（三条）

**共同机制改用临时密钥动态签名先例（R1-High-1 + R2-⑤ bootstrap/worker 两段式）**：固定 receipt 夹具绑死单一 caseId+三哈希不可复用（`identity-readback-receipt.signed.json:8`）。改按 `observation-identity-contract-closure.zero-sut.golden.mjs:51/:106` 先例：临时 Ed25519 密钥对 + 临时发布模块 + 对每 case 实际三哈希**动态签 receipt**。

**loader 时序（R2 逮 B3 悖论：金牌运行时生成 loader 却要用它启动自己）**：B1/B2 无悖论——金牌本体不需 loader，只有它 spawn 的 CLI 子进程带 `--experimental-loader`（spawn 前 loader 文件已生成）。**B3 改 bootstrap/worker 两段式**：bootstrap 段（金牌入口文件，顶部零 authority-root import）生成临时密钥/发布模块/loader 文件 → 以显式 `--experimental-loader` spawn worker 段（新文件 `teachin-observation-authority-root.worker.mjs`，在 loader 生效的进程里才 import authority-root 并执行全部断言）→ bootstrap 收集 worker 退出码与断言汇总。worker 新文件纳入 B3 prd checksum 与 ADR-0004 签署面；临时材料 finally 清理。

动态签名/发布模块生成逻辑抽为**本契约新增 support 件**（`tests/_golden/support/ephemeral-driver-publication.mjs`，三金牌共用、纳本契约 checksum 面）。既有共享夹具（`observation-runtime-trust-root` 的 loader、`canonical-case-lease.mjs`、safe-case-lease-v2 固定 receipt）**保持字节不变、不扩签**（checksum 归属 `prd-observation-runtime-trust-root:12`、`prd-teachin-observation-safe-case-lease-v2:6`）；确需改则扩 owner prd 重签并入人签（默认避免）。

**租约卫生（R1-High-4，三条通用硬规则）**：每份租约进 `try/finally`；测试体**禁直接 `process.exit`**（`fail()` 改 throw/失败汇总，先例 `observation-cli-authority-wiring.zero-sut.golden.mjs:184`）；`cleanup().ok !== true` → 金牌自红。外部 `cases/` 目录扫描只作第二层验收（`cases/` gitignored，`git status` 看不见残留——本 session 普查污染事故的直接教训）。

**B1 `cli-mcp-face.golden.mjs` A6 —— 重建 happy + 机械降级判据（R1-Medium-5）**：
- happy：租约固定根 + 手造三件套 + 动态签 receipt；起 MCP server 时经 `NODE_OPTIONS` 挂 loader（链路静态成立：`cli-mcp-face.golden.mjs:27` server 起点 → `mcp/casey-server.mjs:142` spawnSync 继承 env → `bin/casey.mjs:46` → `bin/intake.mjs:9` 直接 import 不再 spawn）；断言 isError:false + `[exitCode=0]` + 台账 accepted + 成功回显 output-seal。
- **独立正控先行（R2-③）**：同一份包、同一 loader，**直接 spawn `bin/intake.mjs`（不经 MCP）必须先成功 accepted**——排除 loader 路径错/签名材料错等自伤因素。正控不过=本方缺陷，修，禁谈降级。
- **成对证据**（正控过后，R3-② 台账基线修正——正控已写 committed 台账，「零台账」不成立；authority root 会读旧账递增 generation 提交新字节 `authority-root.mjs:377/:470`）：同包跑两个独立 MCP server——无 loader：精确 `DRIVER_NOT_PUBLISHED` + exit 65 + **台账字节 sha/行数与正控后基线零变化**；有 loader：exit 0 + **台账恰新增一条 accepted（generation 递增）**。同时证 loader 透传真实生效与生产默认拒绝仍在。
- 负向姊妹断言：缺三件套 → isError:true + `[exitCode=65]` + 不回显绝对路径。
- **降级判据（机械，三条件与）**：直调正控成功 ∧ MCP 无 loader 拒于 `DRIVER_NOT_PUBLISHED` ∧ MCP 有 loader **仍**拒于 `DRIVER_NOT_PUBLISHED`（即透传经 MCP 不生效）→ 才降级为纯负向 + observability 显式挂账 MCP happy 零覆盖。其余任何红=缺陷要修。
- 同步改写 `prd-mcp-parity.json:3/:10/:17` 的 task/story/observability——不再声称「真 record→MCP intake」，如实写「手造三件套经 MCP intake」。

**B2 `record-distill.golden.mjs` —— 改形 + 三列账（R1-High-2）**：`seamAccepted()`（:33-45）改「手造三件套（租约固定根、动态签）→ 真 `bin/intake.mjs`（loader）→ 真 `bin/distill.mjs`（loader）」。**逐段 check 出「保留/迁移/丢失」三列账**（accept 已冻结为审计件 `accept/b2-migration-table.md`；段数定谳 **14**——文件注释边界切分、与本节 checkId 列举精确对应，早期「17」为粗估据审计件订正；字母级子断言 33）：
- **保留**：真 intake、真 distill、三件套哈希互锁、签名根验证、committed 台账、候选投影忠实（C3/C5/C6/C4/C4f）、TOCTOU capture 篡改（C2b）、跳过 intake 拒（C2a）、软链拒（C2c）、写盘错误捕获（C2g）、门面（C1/C7）。
- **迁移（拒因换新链路、诚实改断言，R2-④ 修）**：C2d 改断 authority 闭合包路径的**实测精确拒因**（sol 预核候选 `CAPTURE_URL_LEAK`，`teachin-identity-package-validator.mjs:199`；accept 红基线实录定谳后冻）；C2f/C2h 编码凭据/不收敛现由闭合 validator 前置拒（`:167/:175`）→ 改断精确 `CRED_GATE_HIT` + exit 65，红证走**直调闭合 validator 导出纯函数**（lib 件、可 import、零 SUT——这是新链路的真实执法点）。
- **丢失（挂账 `record-three-piece-producer`，登记精确内容非只留名字；审计件定谳四项）**：record producer 段真 CLI 产出、record→intake 字节接缝、旧单文件布局兼容（隐性成立→隐性作废，审计件补逮）、**distill 内联本地编码门的行为级覆盖**（R2-④ 撤回纯函数直调方案：该门内联于 `bin/distill.mjs:130/:183`、未导出且 import 即跑 main，生产零改前提下不可直调——不伪称已迁移，如实记丢失；接手条件=后续契约导出该 helper 并让 CLI 调它，或 producer 契约一并处置）。挂账条目含：丢失断言清单（file:line 原文）、接手条件、route（机器可做，非 route:human）。
- 同步改写 `prd-record-distill.json:3/:10/:25` task/observability/story 措辞。

**B3 `teachin-observation-authority-root.zero-sut.golden.mjs` —— 承认断言语义变更（R1-⑧b/c + R3-③ 撤回带 loader 的 acceptance）**：mkdtemp 改租约固定根；receipt 从旧无签名形态升级为完整签名信封（动态签，`authority-root.mjs:828` 要求 keyId/algorithm/signature）——**「其余断言语义不动」撤回**，受影响断言逐条列变更。**prd acceptance 保持裸 `node <金牌>` 不变**（`prd-teachin-observation-authority-root.json:33`）：金牌本体即 bootstrap（顶部零 authority-root import、不需 loader），loader 只出现在 bootstrap spawn worker 的子进程命令里——R2-⑤ 两段式恰好消掉了 prd 命令变更需求。**旧无签名 receipt 夹具**（`fixtures/teachin-observation-authority-root/identity-readback-receipt.json`）**保留作负例**：新增一条负向 check 喂它给 authority root、断精确拒因（无签名信封必拒），其 checksum 保留于 B3 prd 冻结面。

## 家族 C：术语正名（单行）

`docs/plans/bootstrap/plan.md:85` 弃用旧称改「原子候选」。改后 `prd-p2-intent-compile` s3 acceptance 转绿。同文件 20 处历史加粗英文与「候选原子」字序变体（词表守卫盲点）挂账不动。

## 复 gate 与重签（R1-Medium-6：先定稿人签、后一次性执行）

**顺序（硬规则，不边修边 gate）**：
1. 全部金牌/夹具/prd 语义文本改动定稿；
2. checksum 全批重签 + ADR-0004 人签（**含顺序依赖**：`record-distill` checksum 须与 `authority-root` 金牌同批先行——后者 `:420/:426` 会读并复核前者的 checksum）；
3. 静态安全闭包复核（每条 acceptance 过启动闭包 + 传递 spawn 两层过滤）；
4. 按冻结执行账固定顺序一次性复 gate。

**冻结执行账（R2-⑥ 准入硬条件：accept 时实际生成并冻结、非「届时生成」的计划句）**：22 个唯一 prd × 每条 acceptance × 安全结论 × **预期翻转**（绿→绿刷新 / 红→绿 / 绿→诚实红逐条预判），落成审计件入 accept 交付物，首个 gate 前必须已存在。`gate --dry` 只验形状不跑 acceptance（`gate.mjs:89-92`），不能作红绿分类——预期翻转靠根因诊断 + 修复面推导，gate 实跑落账、偏差=缺陷。

**checksum 重签面**：`prd-flow-bridge`、`prd-integrate-regress-agent-tool-slice`、`prd-ingest`、`prd-mcp-parity`、`prd-record-distill`、`prd-teachin-observation-authority-root`。B3 只新增 worker/support checksum，**acceptance 命令字符串不变**（裸 `node <金牌>`）。共享冻结件不动不扩签；动则扩 `prd-observation-runtime-trust-root`、`prd-teachin-observation-safe-case-lease-v2` 并入人签。

## 验收点（交 acceptance-gate 铸可执行规格）

- 修前红基线：六条逐金牌重录（确定性退出码 + 关键 stderr 摘要）。
- 修后：五金牌 + term-lint acceptance 全 exit 0。
- A 家族：反向锁存在且过 + 内核 mutant 突变红证（改前 sha、mutant 红实录、还原后 sha 一致）；负向分支逐条精确拒因断言过。
- B1：独立正控实录（直调 intake + loader 成功 accepted）先行；成对证据两跑实录（MCP 无 loader 精确 `DRIVER_NOT_PUBLISHED`/有 loader accepted）；降级判据未触发（或触发则走三条件与判据+挂账）。
- B2：三列账审计件冻结；直调闭合 validator 纯函数的 `CRED_GATE_HIT` 红证；C2d 实测拒因定谳实录。
- B 家族通用：每金牌 try/finally 就位、失败注入一次实证 cleanup 仍走且 `cases/` 零残留；测试体零 `process.exit` 直调（grep 证）。
- 复 gate：执行账逐项落 evidence；诚实红翻转与预期逐条对账，偏差=缺陷。
- ADR-0004 人签清单（R3-④ 闭合枚举，gate 只校验显式登记 `testChecksums` 的文件、不递归冻结依赖 `gate.mjs:50`）：
  - 字节变更五入口金牌：flow-bridge / ingest / cli-mcp-face / record-distill / authority-root(bootstrap 形)；
  - **新增件**：`teachin-observation-authority-root.worker.mjs`（注册进 B3 prd testChecksums）+ `tests/_golden/support/ephemeral-driver-publication.mjs`（**注册进三个依赖 prd**：`prd-mcp-parity`、`prd-record-distill`、`prd-teachin-observation-authority-root`——gate 不递归冻结、三处显式登记才闭合）；
  - 六处既有 checksum owner 重签（`prd-flow-bridge`、`prd-integrate-regress-agent-tool-slice`、`prd-ingest`、`prd-mcp-parity`、`prd-record-distill`、`prd-teachin-observation-authority-root`）；
  - 旧无签名 receipt 夹具保留作负例（B3 prd 冻结面保留其 checksum）；
  - B2 语义迁移三列账 + prd-mcp-parity/prd-record-distill 语义文本改写 + （若触发）B1 降级 + （若动既有共享件）扩签 `prd-observation-runtime-trust-root`、`prd-teachin-observation-safe-case-lease-v2`。

## 不在范围（挂账）

- 〖教义已取代〗七条、`prd-casey-demo`、detector 传递 spawn 洞（任务 #12/#13）——另裁另契约。
- `bin/record.mjs` 三件套产出——命名后续 `record-three-piece-producer`（B2 三列账登记精确丢失面）。
- `observation-active-suite-contract-v2` 超时 30s→180s——**另立 direct 小契约**（sol R1-⑦ 判词：不同根因不同 checksum 归属，不扩入 Steven 已裁的六条）。
- `bootstrap/plan.md` 20 处加粗英文 + 「候选原子」字序变体登记。
