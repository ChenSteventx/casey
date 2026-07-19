# 方向转向：codex 讨论 + Steven 裁决后的两阶段路线

> Steven 2026-07-19 就 codex gpt-5.6-sol high 讨论的两个承重问题裁决（AskUserQuestion 记录）：
> - Q1「SKILL.md:107 fake-SUT 只读规则作用域」= **也约束 dev gate/golden**；
> - Q2「trust-root 缺口 + 暂停波2-4」= **先修信任根分离再迁移（codex 荐）**。
>
> 这两裁决**推翻**本契约原执行路径（重跑 fake-sut 金牌 + 注入测试锁 → 锁绿）。本文记录转向后的正确方向。原 `plan.md` 的波1-5 执行编排作废，`PROPOSAL.md` 路 a「测试签名锁注入 + 金牌迁移」被信任根缺口证伪为「利用现有 trust-root 缺口、非零削弱」，不采。

## 已作废 / 已回滚

- **波1 settle 锁绿（提交 0e8e189）已 `git revert`（3c32e75）**：它靠跑 fake-sut 把 settle 翻 16/16 绿——违 Q1（golden/gate 不得启动/回放假 SUT）；且其测试锁依赖尚不存在的信任根分离。settle 金牌恢复原冻结态（honest 准入门红）。
- **mint-admission-authority.mjs 随 revert 删除**：codex 判其「结构对、语义授权不可信」（占位 candidate/receipt 不绑真实业务对象、execute 生成与校验同源盲区、未登记 atom 默认 subject 与门共谋假绿）。若信任根分离后重启迁移，须按 codex 建议重造（改名结构 fixture builder、mutation 不合成 candidate 须来自 committed provenance、未登记 atom 直接拒、独立测试信任根签可验 receipt）。

## 保留（诚实且durable）

- **波0 五核心 prd 翻红（passes:false）保留不动**：这些金牌启动 fake-sut、按 Q1 不该被 agent 跑，故 honest 状态就是红。**注意约束：按 Q1 不得再跑 gate（会启动 fake-sut），故这些 passes:false 不能撤了重生——保留即权威。**
- 债务登记表 `DEBT-REGISTER.md`（钉死全套件 ~24 金牌 / 40 prd 陈旧绿全貌）、drift/vanished 决策包（含 codex 修正，见下）、codex 讨论全文 `review/codex-sol-strategy-20260719.md`、复签 sweep 工具（`tests/_golden/support/resign-changed-goldens.mjs`，生命周期工作仍可用）。

## 正确方向：两阶段（顺序，均须各自立契约 + Steven 参与）

### 阶段一（前置 kernel 契约）：生产/测试信任根分离

codex 逮到的承重缺口（本契约调查证实是**既有**缺口，enforcement 只是把它暴露得更实）：
1. 测试锁绑 events 字节却**不绑 `--sut`**——同一测试锁 + 模板化基址可被指向真 SUT（`bin/replay.mjs:226` 准入后才读任意 `--sut`）。
2. 生产 reader（`readIdentityAdmissionAuthorityFromPrd`）**不检查** signerId 属不属生产信任根、artifact 是否出自 `bin/sign.mjs`、receipt 是否真实、test/prod audience、SUT 身份、不可变发布根/撤销（代码注释 `entity-semantic-lock-preflight.mjs:274` 自承发布根/撤销未补）。

修复面（kernel 车道，需 grill/plan + 护栏 #14/#15 审 + Steven 人签；这是强制层改动）：
- 生产 reader 只读**不可变发布 manifest**，不直接信任开发工作树 PRD；
- artifact 带**不可伪造 audience**（prod/test），由不同信任根签发；生产 reader 拒测试 signer/test root；
- 授权至少绑**环境或 SUT scope**，不只绑 flow/events；
- 生产读路**验 receipt 内容**（或 receipt bundle）；
- 测试 reader / 发行物物理分离，不靠调用者自报 `--hermetic`；
- **反向验收（强制）**：测试锁交给生产 reader 必须被拒。

### 阶段二（前置解完后）：hermetic 浏览器金牌套件生命周期重裁

Q1 判定 fake-sut 金牌不该被 agent 跑 → 不能靠「重跑 fake-sut 锁绿」恢复。按 codex 的更干净边界，对 ~24 个 hermetic 浏览器金牌**逐个按生命周期分类**（而非按「5 核心 prd s2 闭包」这种耦合边界）：
- **(a) 仍有效、可转 zero-SUT 确定性**：把行为断言从「跑 fake-sut」重构成「喂冻结 axes/事件夹具给纯裁判/纯函数」——不启动 SUT，符合 Q1 与 SKILL.md:107 允许的「不接触 SUT 的纯函数检查」。这是主力出路。
- **(b) 仍有效、只能真机 UAT**：退成真机 UAT-only（route:human，ADR-0009 真机升必过闸），fake-sut 金牌墓碑，行为验收改联网驱真站。
- **(c) 教义已作废**：墓碑 + 命名后继（如 p5 drift/vanished，见下）。

### drift/vanished 处置（codex 修正后，属阶段二 (c)）

`DRIFT-VANISHED-DECISION.md` 的墓碑方向对，但 codex 纠正一处**假绿风险**：
- 原 `prd-p5-replay` 的 s1 story 明确冻结 10 案 + 漂移探针 + fake-sut replay（`prd-p5-replay.json:27`）。**不应借删 drift/vanished 两案让原 story 翻绿**——那把「契约被取代」伪装成「原契约通过」。
- 正确（仓内先例 `supersession-revocation.json:3` = `superseded-tombstoned-not-pass`，旧 story 保持 false）：原 p5 story 保持 false/superseded + 出案级吊销收据（冻原 hash/作废因/后继）+ 新建 successor PRD 承 8 存活案。
- 连带：**自愈门（护栏 #13）在现役 replay 内核已无活触发器**（正向漂移 HARNESS_ERROR 仅单元可达、非活性可达）。另立自愈 liveness 契约——须从真实 replay action 输出一路到 verdict 证至少一现役 atom 能产 HARNESS_ERROR；若自愈不再需要，正式退役相5活性要求与死码，而非保留名义开闸。

## 本契约（replay-admission-hermetic-migration）收口姿态

调查成功（逮出「enforcement 打全套件陈旧绿 + 与真机规则冲突 + 信任根缺口」三真问题、异构讨论证实），执行路径作废。本契约转为**调查/决策契约**：交付 = 债务登记表 + 两阶段方向 + codex 验证 + 五核心 prd honest 翻红。阶段一/二各另立契约。cert 金牌与 assert 脚本（测已废锁登记法）清除。
