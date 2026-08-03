# 评审收据 · zero-shot-typed-progress-predicate

## R1（代码联审，两路并行）

| 项 | 值 |
|---|---|
| 被审快照 | `446881b`（不可变，评审期间作者零改动） |
| 基线 | `a3a9a28` |
| 作者家族 | Claude（Opus 5） |
| 评审家族 | 非 Claude —— 满足异构冗余（`CONTEXT.md` Dissimilar Redundancy、护栏 #9） |
| 评审方 1 | `grok-4.5`，reasoning-effort high，tmux 真 TTY 多轮 agent 循环，`--cwd` 指真工作树 |
| 评审方 2 | `pi.dev` `deepseek-v4-flash`，thinking high，`-p` 单轮但自带工具循环 |
| 评审输入 | `r1-review-input.md`（spec + diff 范围 + 真仓只读访问 + 风险清单；不含作者推理叙述） |
| 产物 | `r1-grok-4.5-high.txt`、`r1-pi-deepseek-v4-flash-high.md` |
| 结论 | 两路均 `VERDICT: CHANGES_REQUIRED` |

> `codex` 本轮无额度（Steven 2026-08-03 告知），按 `docs/runbooks/review-model-budget.md`
> 改由 grok 与 pi 顶上；两者均非实现家族，异构门成立。

### R1 确认的 finding 与处置

| 编号 | 级别 | 提出方 | 内容 | 作者独立复现 | 处置 |
|---|---|---|---|---|---|
| F1 | High | pi | driver 层截断（`playwright-page-driver.mjs:71-72`，`MAX_DISCOVERED=1000`）在 `pageCount` 计数前丢候选，`roleVisible` 假绿；证伪首版「`pageCount` 不受截断影响」的豁免理由 | 已读码坐实丢弃点先于 `projected` | R2 修：读目录判据统一吃完整性前置 |
| F2 | High | grok | before 侧脱敏抑制可达（`observationBlocker` 不查 `redactionSuppressed`），判据由假翻真，因果闸放行未发生的进展 | 已由 P22 端到端复现 | R2 修：before/after 两份都查 |
| F3 | Medium | pi | 动作后空目录使 `roleHidden` 平凡成立 | 已由 P24 复现 | R2 修：缺席类加 after 目录非空闸 |
| F4 | Medium | 两方 | 金牌钉不住 `visible === true` 与 `pageCount === 1` 两条腿 | 已亲手变异复现，两次均仍 20/20 | `visible` 腿由 P23 补钉；`pageCount` 腿见下方开口项 |

### R1 明确判「无发现」的面

闭集封闭性（原型污染 / symbol 键 / `Object.create(null)` / 数组形态 / `urlPathname` 字节兼容）、
因果合取规则本身、授权链（伪造 `redactionSuppressed:0` 的 observation 被
`OBSERVATION_AUTHORITY_MISMATCH` 拒）、护栏合规（恒降权、`conditionKinds` 无下游被破、
未触 `verdict.mjs`/三轴/`check.mjs`）、以及「截断 before 不可达」主张（两方独立复测均成立）。

### 开口项（如实挂账，未闭）

`pageCount === 1` 单独删除后金牌仍不红。收敛后 `matched.length === 1 && pageCount > 1` 蕴含目录
截断，而截断已对 `roleVisible` fail-closed，故该状态经生产路径不可达，无法用生产路径钉住。
保留该判据是直接表达唯一性不变量并防止将来重新可达；不可达性由 P21 守住。
**这是已知的测试不可达面，不是已覆盖面。**

## R2 复审（修复 hunk 聚焦审）

| 项 | 值 |
|---|---|
| 被审快照 | `446881b..981b4a3` |
| 评审方 | `grok-4.5` high，tmux 真 TTY 多轮（pi `deepseek-v4-flash` 首跑网络挂起：1h43m 仅 1s CPU 零输出，按实际输出记 HARNESS_ERROR 后换跑方） |
| 结论 | `CHANGES_REQUIRED`——F1/F2/F3 代码修复全部独立坐实、P21-P24 四路变异扎实、`pageCount` 生产路径不可达主张被第三方证实；唯一 finding 为 Medium：plan.md 残留 R1 旧段与 ATDD #14 旧措辞和 R2 统一规则对撞（修回风险） |
| 产物 | `r2-rereview-grok-4.5-high.txt` / 输入 `r2-rereview-input.md` |

## R3 订正 + 聚焦复核

| 项 | 值 |
|---|---|
| 订正提交 | `e752418`（删旧段并写明订正理由、#14 改纯 `urlPathname`、金牌 P14 标题同步；断言体零变化；amendment R3 入账） |
| 复核方 | `grok-4.5` high，聚焦 `e6e7ea1..e752418` |
| 结论 | 终局 `APPROVE`——Medium 干净收口、金牌 diff 仅 1 行标题、PRD 账本与 sha256 实物一致、复核方自跑金牌 24/24 exit 0 |
| 产物 | `r3-recheck-grok-4.5-high.txt` / 输入 `r3-recheck-input.md` |
| 遗留（注释级） | P14 断言体内失败文案仍有「存在性断言不受完整性前置约束」字样，复核方判不构成矛盾（场景仅 URL）；记 learn 不动字节 |
