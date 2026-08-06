# 评审收据 · wf-open-search-first

## R1（聚焦代码审，双路，全仓暴露）+ R2（pi 增量复核）

| 项 | 值 |
|---|---|
| 被审快照 | R1：`f417c3e`；R2 增量：`f417c3e→25943bb` |
| 基线 | dev `909c101` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high，tmux 真 TTY、真工作树只读 + /tmp 变异，产物 `r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，同树只读 + /tmp 变异，产物 `r1-pi-deepseek-v4-flash-high.md`、`r2-pi-delta.md` |
| 结论 | R1 双双 `APPROVE`（grok 1 Medium、pi 2 Medium，均非阻断）；按发现并集修（2 条采纳、1 条维持挂账）→ R2 增量 `DELTA_VERDICT: APPROVE` |

## R1 发现并集与处置

1. **grok Medium（已修 `25943bb`）**：放大镜事件带 `fieldLabel: '搜索'` 有同名 label
   抢锚面——改纯 fallbackCss，照 `chat.sendAndWait` 送出图标先例。
2. **pi Medium#2（已修 `25943bb`）**：`openSearched` 两 emit 后无条件置位、与「真发起
   搜索才授新预算」表述不符——改为图标点击 `unique && acted` 才置位。
3. **pi Medium#1（维持挂账）**：open 搜索后列表过滤态与后续 deleteByName 互扰无
   hermetic 覆盖——泄漏时计数对账门硬阻断 route:human 绝不误删（fail-closed 已证）；
   核验点=B4 七跑现场（PRD observability 在案）。

## 双方独立复现的关键证据（并集）

- 双目标轮询/条件预算三路径预算账核算（见目标 ~0s+15s、真搜索 ≈0-15s+15s、双缺席恒
  ~15s 封顶）；与冻结 post-nav 金牌（S1 必真轮询/S3 <20s）共存双方实跑证实。
- 事件面与 `chat.sendAndWait`（纯 fallbackCss）、`deleteByName`（fill 模板原样）先例
  真同构；回放零 schema 变更。
- 红证 /tmp 复现逐字节一致；PRD 三条 sha256 双方自算全符；突变闭环；邻接全绿。

## 开口项（如实挂账）

1. pi Medium#1（过滤态互扰）→ B4 七跑现场核。
2. R2 非阻断注记：金牌桩 emit 恒 unique/acted，r1 两条修复的机制由生产 emit 契约 +
   plan 承载而非金牌判别——测试逼真度加严候选。
3. 失败路径「搜索已发但目标缺席」支路仍可 ~30s（非双缺席封顶面）——与前两契约同面
   账本，B4 七跑记录总耗时。
