# 评审收据 · post-nav-anchor-wait

## R1（聚焦代码审，双路，全仓暴露）

| 项 | 值 |
|---|---|
| 被审快照 | `d96d833`（不可变） |
| 基线 | dev `04803c1` |
| 实现家族 | Claude（Fable 5 executor） |
| 评审方甲 | `grok-4.5` high，tmux 真 TTY、真工作树只读 + /tmp 变异，产物 `r1-grok-4.5-high.txt` |
| 评审方乙 | `pi.dev` `deepseek-v4-flash` high，同树只读 + /tmp 变异，产物 `r1-pi-deepseek-v4-flash-high.md` |
| 结论 | **双双 `IMPLEMENTATION_VERDICT: APPROVE`；grok 零 C/H/M，pi 零 C/H + 1 Medium（同面挂账）+ 3 Low** |

## 双方独立复现的关键证据（并集）

- 锚与闸探针定位器语义完全同一（`getByText(instantiate(openName), {exact:true})` 逐字段）；
  多命中极端时序仅 resolution 标签 absent→ambiguous（同 route:human 不 acted，无安全位移）。
- 真缺席路径 rollback/候选 evidence/note 逐字节保持；锚轮询零事件副作用（S4 钉实证）。
- 红证 /tmp 复现逐字节一致；PRD 三条 sha256 双方自算全符；突变闭环还原红/复原字节同/绿。
- `sleep` 导入正源无环无遮蔽；nav 模块其余导出零改；上一契约 S4 普查钉自动覆盖新消费点。
- 邻接四金牌 + term-lint + tier1 全绿。

## 开口项（如实挂账）

1. **pi Medium（同面累计）**：失败路径最坏时长本契约再 +15s×2，全耗尽链路估算 ~85–100s
   vs 看门狗 120s，余量收窄至 ~20–35s——与 login-nav-budget 的 pi Medium 同一观察面。
   兑现点：**B4 六跑记录全链路总耗时**；逼近则做锚点预算共享或抬看门狗（另立契约）。
2. **新逮既存陈旧红**：`wf-open-smoke` 金牌在基线 `04803c1` 即红（原子数钉 18 vs 26 +
   身份绑定环境），非本契约引入（pi 双态实证）——照「他家历史基线红」纪律入账，
   owner 待查、另期重钉（连带 pi Low#2：open 容器归属闸的 fail-closed 面现仅由该
   陈旧红金牌钉，重钉时一并覆盖）。
3. pi Low#1 加严候选：`CASE_DEFECT` 候选 evidence 可补 `waitedMs` 标志区分「即时缺席」
   与「轮询 15s 后缺席」（诊断增强，不挡合入）。
4. pi Low#3：S5 结构钉文本耦合属本仓惯例、PRD 已声明措辞避让纪律，可接受。
