# 评审收据 · admission-envelope-yield

## R1（双路，首轮双 APPROVE）

| 项 | 值 |
|---|---|
| 被审快照 | `294d787`（分支 `admission-envelope-yield`，基线 dev `5cd36b4`，审前 `git diff HEAD` 空） |
| 实现家族 | Claude（Fable 5 executor） |
| 评审环境 | ext4 克隆树 `~/casey-review/casey-admission-envelope-yield`（`loop-kit` 兄弟克隆） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端 + 自跑金牌/gate），`r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`），`r1-pi-deepseek-v4-pro-high.md` |
| 结论 | **双路 `APPROVE`，零 Critical/High/Medium** |
| 注记（不升 finding） | grok：A4 夹具的拒面先落在「缺 create 信封」，义务白名单条件的独立贡献钉得偏软——测试说明力问题，当前注册表闭集下无实际泄漏面 |

## 双方独立复现的关键证据（并集）

- 豁免四条件与已签设计逐字兑现（GRILL 对照）；additive-only，无字段输入行为同码；
  前置各闸（孤儿信封/邪恶 issuer/五元关联/bindingMode/provenance/重复终端）零接触。
- 八钉金牌自跑绿；红基线 6 过/2 红复现；突变闭环（`git show` 姿势）；同文件邻接
  五金牌 + term-lint + selftest 全绿；gate GREEN 2/2。
- pi 穷举无误放/误拒缺陷；grok 自跑 gate 与金牌验证。
