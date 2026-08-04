# 评审收据 · p9-replay-ref-rebuild

## R1（代码联审，两路并行，全仓暴露）

| 项 | 值 |
|---|---|
| 被审快照 | `9e85c69`（不可变，评审期间实现方零改动） |
| 基线 | `96f6107` |
| 实现家族 | Claude（Opus 5 subagent 执行） |
| 评审方 1 | `grok-4.5` high，tmux 真 TTY 多轮，`--cwd` 指真工作树（只读 + /tmp 变异负探针） |
| 评审方 2 | `pi.dev` `deepseek-v4-flash` thinking high，`-p` 带工具跑真工作树 |
| 评审输入 | 同料同指令（背景 + 白名单 + 七点风险清单；不含实现者推理） |
| 产物 | `r1-grok-4.5-high.txt`、`r1-pi-deepseek-v4-flash-high.md` |
| 结论 | 两路均终局 `APPROVE`，零 Critical/High |

> `codex` 无额度；grok 与 pi 双路，均非实现家族，异构门成立。

## 两路独立复现的关键证据

- 冻结金牌零字节 diff + sha256 `238215d0…` 双方自算吻合；单跑 exit 0（R1–R5 全绿）。
- 负探针：pi 八例（重复边/外键错指/空段/类型错/同名歧义不取 first/位序/意图/步不存在）、
  grok 三例，全部 exit 65 + 具名拒因 + 哨兵缺席——I1–I8 未见 fail-open 缝。
- pi 结构审计确认：ref 只由签名验证过的观察行铸成，边自报字段仅对账不采用；指纹门先于
  重建块；签名算法覆盖 destructiveContinuity 段；v1/v2 锁携 v3 字段被闭合面拒。
- 双方独立重跑 gate：GREEN 6/6 exit 0；基线 8 枚他家红逐枚实跑，与 evidence.md 计数红因
  一致，未增未减未擅改。

## Findings 与处置（零 Critical/High）

| 级别 | 提出方 | 内容 | 处置 |
|---|---|---|---|
| Medium | 两方收敛 | 「v1/v2 分支逐字未动」措辞过满：实为共享身份面的行为等价重构（字段集/校验序逐项等价、门禁全量实证零漂移），非字节级未 diff | evidence.md:33 已订正为「校验语义与闭合面行为零漂移…非字节级未动」；准入门半句字面真（diff 空）保留 |
| Medium | pi | S5 门禁一次瞬时转红未入账（01:47–01:55 工作树记录），与快照账本相悖 | grok 定位根因：并行 gate 互抢共享 `.golden-scratch-c3-refrebuild`，非产品逻辑；评审后串行重跑 gate GREEN 6/6 已留干净全绿记录（refrebuild-gate-serial.log）；S5 稳定性列入观察 |

## 诚实边界（评审确认未夸大）

浏览器前授权链闭合；出站消费链（page.route 真拦、平台 ID 真核、abort 真在发出前）hermetic
证不出，route:human 挂账不变——不得宣称破坏链已闭。v3 锁产出侧（编译期攒边、随草案交签）
本轮不落。`profile.mutationUrlPattern` 编译侧剖面形状门不校验，真机前检查单项。
