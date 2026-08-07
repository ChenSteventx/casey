# 评审任务 · wf-open-observation-yield R1（异构只读评审）

你是异构评审方（实现家族=Claude，独立复核，不采信实现者结论）。本工作树只读评审：
可读文件、跑金牌与 git 命令取证；**不得**修改工作树文件（红证复现用
`git show <rev>:<file> > /tmp/...` 姿势）；**不得**启动 SUT/浏览器；**不得**读取
`.auth/`、`site.json` 或任何凭据与真实目标地址。

## 快照与基线

- 候选快照：HEAD `4d05447`（分支 `wf-open-observation-yield`）；审前核 `git diff HEAD` 空。
- 基线：dev `b6880e3`。差异集 = `git diff b6880e3..4d05447`。
- 白名单：`lib/compile-atoms-workflow-nav.mjs`（唯一实现变更：`compileWorkflowOpen`
  声明分支归档一处加让位判据）、`tests/_golden/wf-open-observation-yield.zero-sut.golden.mjs`、
  `loop/prd-wf-open-observation-yield.json`、`docs/plans/wf-open-observation-yield/`。
- 背景事实源（只读参照）：`lib/compile-atoms-agent.mjs` 的 `armDestructiveTargetContinuity`
  （C3 守卫「同名多条不取 first」语义）、`tests/_golden/entity-workflow-source-readback.wiring.zero-sut.golden.mjs`
  的 H1i（多身份原子同流 issuer fail-closed）、`lib/compile-atoms-flow.mjs` 观察归档、
  `tests/_golden/wf-open-readback-requery.zero-sut.golden.mjs`（open 独跑场景 S1e 归档全档）。

## 变更主旨（事实陈述）

B4 十二跑（22s）：删除搜索修达阵（计数门通过）后，停 C3 守卫「同名观察多条
（create subject + open source 同 flow）→ 不取 first」。守卫与 H1i 无缺陷。修法
（Steven 裁甲案）：open click 成功后若 `run.identityObservations` 已含同 platformId 行
则跳过归档 source 观察并记让位 notes；点击前双证原样；无同 platformId 行照旧归档。

## 风险清单（逐条给结论）

1. 让位判据正确性：同 platformId 精确匹配（非同名、非「有观察就让」）；matched.platformId
   来源（resolveDualIdentity 唯一行）可信度。
2. 独跑零回归：flow 无 create 时 open source 观察归档全档不变（readback 契约金牌 20/20
   自跑核）；successor amendment 的 open [source] 语义保留。
3. 双证不缩水：让位只影响归档、不影响扫描/卡锚/判定表/过门才点/TOCTOU 任何一环。
4. 下游效果论证：让位后连续性 ref 由 create 观察唯一铸造、issuer 单原子走 H1b/H1h
   已钉通道——按 armDestructiveTargetContinuity 与 deriveObservationIssuerAtom 实码核证
   （不是只看注释）。
5. 边界：同 flow 打开「与 create 不同的既有工作流」（异 platformId）→ 两行并存——
   金牌 S3 钉此形态；该形态后续撞 H1i 属预期 route:human（非本契约债），确认无静默放行。
6. 金牌质量与红证：S1-S4 断言强度；红证（2 红）在基线 `git show b6880e3:` 下可复现；
   PRD 三条 sha256 自算。
7. 邻接：readback 契约金牌、删除搜索修金牌、wiring、cardinality-reverse、v3 created-in-run
   自跑核绿；门面拆分族两既存红基线同码。

## 已有证据（可复核，不必采信）

金牌 12/12；gate GREEN 2/2；全仓 297 金牌双态零回归（异码项与前两契约完全一致的
环境集：主树残件污染 4 项、树缺未跟踪产物 2 项）。

## 输出格式（严格遵守）

- 逐条 finding：`[Critical|High|Medium] 文件:行 —— 一句话缺陷 + 失败场景 + 证据`；首轮只报 C/H/M。
- 风险清单逐条给结论。
- 末行单独一行：`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`。
