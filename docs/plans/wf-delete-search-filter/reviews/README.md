# 评审收据 · wf-delete-search-filter

## R1（双路）+ R2（grok 增量复核）

| 项 | 值 |
|---|---|
| 被审快照 | R1：`5d059a8`；R2 增量：`5d059a8→41498de` |
| 基线 | dev `ef81f78` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high（tmux 真 TTY、真工作树只读 + /tmp 硬拷贝红证复现，pipe-pane 留痕，R1 实工 12m27s），`r1-grok-4.5-high.txt`、`r2-grok-delta.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（`-p` 非交互带工具、同树只读、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 结论 | pi `APPROVE` 零 C/H/M；grok `CHANGES_REQUIRED`（1 Medium）→ 并集修 `41498de` → grok `DELTA_VERDICT: APPROVE` |

## R1 发现与处置

**grok Medium（已修 `41498de`）**：冻结 plan 正文与 PRD task/s1 文案停在 v2 规格
（「两处 Enter 全退役 / 非 Enter / S4 计数恒等正控」），与 v3 实现+金牌（惰性 Enter
保留 + 序钉 + S4 锚不改判）矛盾——同一 PRD 的双冻结面（plan sha 与金牌 sha）对
「Enter 是否退役」给出相反规格；后人照 plan 干会撞三 PRD 冻结的 post-nav S2 包含式钉。
修：plan 修法/验收章、GRILL 修法条、PRD task/s1 全改写 v3 口径，plan sha 重签
（金牌与红证字节不变）。R2 增量核对五项全收口、无新矛盾。

grok R2 残留注记（不升 finding，如实挂）：PRD notes 红面括注仍有「零 Enter」史迹措辞
（与同段「S1d 恰一处 key:Enter」并存），属历史红证描述非现行验收规格。

## 双方独立复现的关键证据（并集）

- 快照双方各核 `git diff HEAD` 空；差异集=白名单六文件、实现仅 `compileWorkflowDelete` 两处。
- 验收金牌 16/16 双方自跑绿；红证双方在基线 `ef81f78` 下独立复现 9 过 7 红
  （grok /tmp 硬拷贝树 + `git show` 姿势；ms 归一后与提交红证集合全等）。
- 冻结面：`post-nav-anchor-wait` 金牌**字节零变更**（sha 与其 PRD 冻结一致）且本快照下
  自跑 5/5 绿——「实现让路」达成目的双方证实。
- 惰性 Enter 双触发风险双方独立论证同词幂等（边界如实记：仅当未来 Enter 语义变为
  非过滤副作用才需重审，且那时影响面远大于本处）。
- 锚预算语义与 open 前奏「真发起搜索才授新预算」同构（`unique && acted` 制门）；
  锚只等不判（S3/S4 双态钉）。
- PRD 三条 sha256 双方自算全符；邻接五族双方自跑全绿；门面拆分族两既存红基线同码。

## 开口项（如实挂账）

1. 端到端真证=B4 十二跑（乙授权、一例一跑、新 `atl_` 长名令牌）——预期
   create→open→详情断言→删除→删后归零全链首过；计数恒等正控真机承载。
2. PRD notes 史迹措辞「零 Enter」括注（grok 残留注记）——非规格面，随下次触碰该 PRD 顺手清。
3. 若未来被测方 Enter 语义恢复过滤：双触发幂等论证需随 seam-1 重验（系统性面，非本契约债）。
