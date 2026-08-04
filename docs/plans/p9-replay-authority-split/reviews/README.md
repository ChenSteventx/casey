# 评审收据 · p9-replay-authority-split

## 轮次总账（模型 / 输入提交 / 结论 / 运行错误，如实分列）

| 轮 | 评审方 | 输入提交 | 结论 | 备注 |
|---|---|---|---|---|
| 前提 R1 | `grok-4.5` high | 设计稿（96f6107 上未跟踪） | PREMISE_FLAWED（C1 核销时序写反 / C2 once 不在临界路径 + 3H4M5L） | 修订 → r2 稿 |
| 前提 R2 | `grok` + `pi` 双路 | 修订稿 | grok PREMISE_FLAWED（新 Critical：批级一票×分进程拓扑矛盾）/ pi PREMISE_SOUND | 任一 Critical 即退回 → 批会话协议 |
| 前提 R3 | `grok` + `pi` 双路 | 三修稿 | 双 PREMISE_SOUND | Steven 过 grill 人闸后放行实现 |
| 实现 R1 | `grok-4.5` high | 6d67fc2 | CHANGES_REQUIRED（H1 采集死导出 / H2 旗标断链 / M1 / M2） | 修 → 46d6533 |
| 复审 | `grok` + `pi` 双路 | 46d6533 | pi CHANGES_REQUIRED（唯一 Medium：R11c 源形态钉空转——indexOf 首命中函数定义，删调用留导出突变恒绿）；grok 一次 904 秒超时**无终局**（不冒充）；另一次会话限额中断 | 修 → 9013f42 |
| **终审 r5** | `grok-4.5` high + `pi` `deepseek-v4-flash` high | **9013f42** | **双方 PLAN_VERDICT: APPROVE + IMPLEMENTATION_VERDICT: APPROVE** | 产物 `final-r5-grok-4.5-high.txt` / `final-r5-pi-deepseek-v4-flash-high.md` |

> 其间 codex 会话（`gpt-5.6-sol` xhigh 编排）承接过一段实施与验证（Windows/WSL 双环境
> 结论：Windows 下 2/13 假红系 Linux `node_modules` 软链，WSL 13/13 为准）；其提交
> `ab861dc` 为 gate evidence 收账。`gpt-5.6-luna` 调用因 Windows runner
> `CreateProcessWithLogonW` 267/1312 记 HARNESS_ERROR，无 Luna 结论。

## r5 双方独立复现的关键证据

- R11c 重锚真钉调用点：双方各自外科式「删调用留导出」突变（语法完好）→ R11c 恰红
  （红因=死导出）、R11b 同突变仍绿（反证其本就不证接线，标题已诚实化「不证接线」）、
  还原 cmp 字节全同、10/10 复绿。grok 补推演 lastIndexOf/独有文本锚的绕过面：窄，
  且需同时骗过唯一性与次序断言——残余风险已在 route:human 账上。
- H1/H2/M1 修复本体复核成立：成员循环筛调用在 spawn 前、无票零 spawn+回执；顶层入口
  双旗标必填透传、台账根唯一；三态拒因+fsync+有界上界。
- 账本：testChecksums 七件实算全符；两条 amendment 只加严逐 hunk 核；四处 v3 金牌
  amendment 请签件 new sha256 与实物一致（待 Steven C2 签回 v3 PRD，如实挂账）。
- 回归：pure-suite 10/10、cli-session 13/13、八枚 v3 全 0、gate GREEN 5/5；
  p9-tier2-selftest 两红为他家在册（T7 环境性 + T9a 计划内 replayGrantPath）。

## 遗留（非阻塞，如实挂账）

- executeTier2 运行期真行为（真读票据/真拒跑落回执/真零 spawn）hermetic 证不出
  （耦合 doctor 环境与站点探针），route:human 归 B4 真机窗口。
- 四处 v3 金牌 amendment 待 Steven C2 签回 v3 PRD；本契约不 merge 不 push 待授权。
- 出站消费链与 grant 真机全链（签票→占用→回放）仍属签署会话 C/D 段。
