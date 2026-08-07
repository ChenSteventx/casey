# 评审收据 · terminal-coverage-yield

## R1（双路，首轮双 APPROVE）

| 项 | 值 |
|---|---|
| 被审快照 | `0642e36`（分支 `terminal-coverage-yield`，基线 dev `643d3a9`，审前 `git diff HEAD` 空） |
| 实现家族 | Claude（Fable 5 executor） |
| 评审环境 | ext4 克隆树 `~/casey-review/casey-terminal-coverage-yield`（同哈希即同字节；`loop-kit` 兄弟克隆） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端 + 自跑金牌/补测），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 结论 | **双路 `APPROVE`，零 Critical/High/Medium** |
| 人签 | schema 改版（pattern 放宽 + `yieldedToPlatformId` 属性）Steven 2026-08-07 当轮点选签字，两份实际冻结该件的归属 PRD（page-topology-auth-continuity / seams-freeze）`checksumAmendments` 均录 signerId/signedAt |

## 双方独立复现的关键证据（并集）

- 四条件豁免逐条对钉金牌（Y1–Y6 映射表，grok 制）；grok 自补对抗探测：错 kind 的
  subject 行、空串/空白/数值型字段 → 均拒；生产路径 list scan 的 `nonEmpty` 已保证
  `matched.platformId` 恒非空 string，与门内判据类型同构。未见第五条 fail-open 泄漏。
- 加法门控：无字段输入回同一拒码（cardinality-reverse 18/18、wiring 18/18 自跑）；
  非让位路径实测不盖字段、照常归档 source。
- 盖字段耦合：仅 `priorSameId` 分支；`r.stepId` 来自 emit 唯一 `atstep_N`；让位判据
  与 notes 文本零改。
- schema 爆炸半径：pattern 仅放宽到 `intent_[A-Za-z0-9_]+`（连字符/点分/无前缀仍非法）；
  新属性可选 + `minLength:1`；seams 系归属金牌全绿。
- Y8 harness 诚实性：真实 `compileFlow` 让位路径盖字段（非桩）；种子行 + 合成锚定
  click 为流中态补位且已在金牌注释与 PRD notes 声明。
- 突变闭环：三件实现整体还原 → 6 红 → 恢复 sha 同 → 14 断言绿（双方 `git show` 姿势复现）。

## 注记（不升 finding）

- plan.md 冻结字节保留「三份归属 PRD」笔误（实为两份冻结该件 + drawer-lock 仅行文
  提及）——grok 判文档笔误不构成失败面；PRD task 措辞已在收据轮修正并留痕。
