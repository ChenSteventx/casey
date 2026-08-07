# 评审收据 · compile-intent-lineage-rebind

## R1（双路）+ R2（grok delta）

| 项 | 值 |
|---|---|
| 被审快照 R1 | `6082431`（分支 `compile-intent-lineage-rebind`，基线 dev `05800b4`，审前 `git diff HEAD` 空） |
| 被审快照 R2 | `2e4770b`（H1 并集修，复审对象 `git diff 6082431..2e4770b`） |
| 实现家族 | Claude（Fable 5 executor） |
| 评审环境 | ext4 克隆树 `~/casey-review/`（D 盘当日四次挂死，评审搬离 drvfs；克隆 HEAD 与工作树逐提交同哈希、`loop-kit` 兄弟克隆保拓扑） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端、真克隆树 + 自跑金牌/突变/smoke），`r1-grok-4.5-high.txt` / `r2-grok-4.5-high-delta.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| R1 结论 | pi `APPROVE` 零 C/H/M；grok `CHANGES_REQUIRED`（H1 High + M1 Medium） |
| 并集修 | H1：重绑漏 observed/verification 两旁路（emit 时刻已带走自生号）→ draft 存在性闸按 observed 全集拒 authored 草稿。修法=重绑块按 stepId 集同步三通道；金牌补 G1c-1/2 + G2-5（修前红 exit 1 实抓 `accept/red-proofs/…h1-threechannel.delta-red.txt`、修后 16/16 绿、第三轮突变闭环） |
| R2 结论 | grok delta `APPROVE`——三通道同号、assert 折叠与裸步/遗留不误伤（其自跑 smoke 证 assert 不产 event、折叠锚 authored）、slice 隔离成立、diff 未越白名单 |
| M1 处置 | 冻结 `events.schema.json:78` intentId pattern `^intent_[0-9]+$` 与 authored 号张力（teach-in 同形多年、生产无 schema 强制层）——Steven 2026-08-07 裁**挂账**：本契约不碰冻结 schema，十四跑真证后与基数门修向统一处置、一次人签（初点「现在放宽」经完整上下文说明后撤回改甲，过程如实入 PRD notes） |
| 残留（grok r2 注记） | teach-in lineagePlan 块同样只改 events+lastIntentId（本 PRD G4 冻结零漂移属非目标）；若日后 teach-in 正式产物也过 draft 存在性闸需另开面——挂账 |

## 双方独立复现的关键证据（并集）

- pi：`entityBindingProvenance` 在重绑之后读 `event.intentId`（已是 authored）、观察归档直用
  `step.sourceIntentId`、`evidenceStepId` 按 stepId join——出处链/绑定桥/观察三面零破；
  R5 边界（空流/空白串/非对象步）行为合理。
- grok：`wouldDraftReject` 探针 hermetic 复现 H1（authored ∉ observed 全集 → exit 65 幽灵
  intent 拒）；R2 修后自跑 smoke：`threeChannel=true`、`assertFoldedToAuthored=true`、
  assert 不增 observed 行；突变按 `git show 6082431:` 覆写复现三红、恢复 sha256 同、16/16 绿。

## 过程事故记录

- R1 首次派发误用 `--prompt-file` 单轮模式（只吐意图即退），纠正为 tmux 伪终端多轮；
  pi 首两次派发分别因模型样式走错 openrouter 入口、D 盘挂死读不到提示词而失败——均如实
  弃置，未计入评审记录。第三次起双方在 ext4 克隆树上完整完成。
