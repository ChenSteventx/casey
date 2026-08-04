# 评审收据 · wf-delete-card-layout

## 轮次总账（模型 / 输入提交 / 结论 / 运行错误，如实分列）

| 轮 | 评审方 | 输入提交 | 结论 | 备注 |
|---|---|---|---|---|
| 前提审 R1 | `grok-4.5` high | 7e39f78 | PREMISE_SOUND | 对 5e376b2 的首轮因树变异整轮作废未采信；`pi` 当日上游三败（503/挂死/503）挂账，Steven 亲裁单路过闸 |
| 实现审 R1 | `grok-4.5` high + `pi` `deepseek-v4-flash` high | 408883f | grok CHANGES_REQUIRED（金牌钉力四条，无实现 Critical）/ pi APPROVE | 并集处置 → 0a1c267 |
| R2 | `pi` + `gpt-5.6-sol` xhigh | 0a1c267 | pi 批准该旧候选并指出 shape-probe 证据缺席；Sol 逮 schemaVersion/收拾所有权/Escape 复验 | 并集处置 → ced9fcf（含证据补齐） |
| R3 | `pi` + `gpt-5.6-sol` xhigh + `grok` | ced9fcf | pi CHANGES_REQUIRED（唯一 Medium：重渲染换节点洗绿）；Sol 受限上下文不作独立终局；grok 调用约 904 秒超时**无终局**（不冒充已批） | `gpt-5.6-luna` 尝试因 Windows runner `CreateProcessWithLogonW` 报 267/1312，记 HARNESS_ERROR，非供应方不可用；无 Luna 结论 |
| **R4 终审** | `grok-4.5` high + `pi` `deepseek-v4-flash` high | **7b9e40a** | **双方 PLAN_VERDICT: APPROVE + IMPLEMENTATION_VERDICT: APPROVE** | 产物 `r4-grok-4.5-high.txt` / `r4-pi-deepseek-v4-flash-high.md` |

## R4 双方独立复现的关键证据

- pi R3 Medium 干净闭合：重渲染反例全部变体（换节点/多菜单残留/读取抛错）都落
  `failed`；判据只读无 pin 副作用；无为过 R25 越权收拾基线菜单的缝。
- 双方各自 /tmp 突变「删形状兜底」→ R24/R25 恰双红；红证头 sha256 与现役金牌实算一致、
  输出与对 ced9fcf 实跑逐字符相符。
- 接管点仅 `none`（unique/ambiguous/action_failed 全短路）、三道锁、因果菜单授权、
  审计环零悬停零菜单交互、确认环零改动（408883f..HEAD 无一行触碰）、菜单档默认关、
  R16 投影棘轮零生产消费者——全量复核成立。
- 账本：testChecksums 五件实算全符；amendment #8 逐 hunk 只加严（金牌纯加 37 行，
  plan 仅重写被加严行）；回归十项 exit 0；term-lint/node --check/diff --check 过。

## 遗留（非阻塞，如实挂账）

- grok R4 一条 Low 残差：残留判据的文本扫描不含 root 自身（对 MENU_SELECTOR 形状不现实）。
- 三枚历史基线红不由本契约改写：`p3-compile.golden.mjs`（启夹具 SUT，agent 禁跑）、
  `real-run-trust`、`hermetic-golden-isolation-pending`。
- 真机门未关：卡片路径与 B4 重编译链 route:human；不 merge 不 push（等 Steven 授权）；
  P9 整体不宣称 PASS。
