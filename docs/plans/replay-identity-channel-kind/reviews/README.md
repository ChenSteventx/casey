# 评审收据 · replay-identity-channel-kind

## R1（双路，首轮双 APPROVE 五连）

| 项 | 值 |
|---|---|
| 被审快照 | `dd46467`（分支 `replay-identity-channel-kind`，基线 dev `8d7a7f3`，审前克隆树 `git diff HEAD` 空） |
| 实现家族 | Claude（Fable 5 executor） |
| 评审环境 | ext4 克隆树 `~/casey-review/replay-identity-channel-kind`（`loop-kit` 随仓、node_modules 软链主树） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端、克隆树自跑金牌 + checksum 逐字节核对），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 结论 | **双路 `APPROVE`，零 Critical/High/Medium** |
| 审后克隆树完整性 | `git diff HEAD` 空（tracked 零改动，仅两份评审产出落盘） |

## 双方独立复现的关键证据（并集）

- R1 agent 零行为差三退化态逐分支对照（缺 listApi / v1 锁 / 无锁），期望映射形状与
  账本门控等价；grok 注记：agent 拒因文案因 kind 参数化多插「agent 」一词，邻接金牌
  按子串+退出码断言不受影响（双方均判非 finding）。
- R3 豁免判据三路绕过尝试全拒（步不存在/锚非覆盖原子/跨 kind 锚），覆盖集为 v3 权威
  边派生非锁自报；R4 四路绕过全拒；R2 锁驱动选段与 C2 单通道约束等强。
- R5 `:398` v3 判据不动的 fail-closed 后果双方确认方向安全（grok 注记拒因文案在
  「指纹已核后」偏诊断精度，不升格）。
- R6 执法时机分层（plan-amendment-1）实证动机成立，延迟窗口无静默降级面。
- 六场景金牌、C3 failclosed（25/25）、注册表脊柱（51/51）克隆树自跑 exit 0；
  PRD 三件 checksum 与磁盘逐字节一致。

## 已知挂账（双方确认披露充分、不计 finding）

1. plan §2 表 W3 描述笔误（金牌为准，冻结字节不动，随下次触碰清）。
2. 「段声明非良构 ∧ 锁点名」延迟执法路径无 hermetic 钉——补钉走 checksumAmendment +
   人签，待裁。
