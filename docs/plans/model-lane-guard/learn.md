# model-lane-guard — learn（沉淀）

契约收口：grill(岔三跳)/plan/accept/loop/review/learn 全绿，gate GREEN 2/2，I1+I2 守卫上线。

## 交付

- I2 `bin/config-lane-guard.mjs`：读 `loop/config.json` 断言异构三不变量（review 家族≠implementation 家族 / Claude 族不当 review 主 / `diversity=dissimilar`），`modelFamily` 纯前缀锚定、未映射族 unknown→fail-closed。
- I2 钩子壳 `bin/config-lane-guard-hook.mjs` + `.claude/settings.json` 独立 PostToolUse 条（写 `loop/config.json` 时跑 I2、违反回合内可见拦），不改 loop-kit。
- I1 `bin/verdict-purity-guard.mjs`：静态扫 `bin/verdict.mjs` 依赖闭包无 LLM/网络客户端，接入 `casey selftest --tier1`（护栏 #15 机器守）。
- 回归锁 `tests/_golden/model-lane-guard.golden.mjs`（32 断言，checksum 冻入 prd）。

## 教训

1. **同族盲区是真的。** I1 初版只扫字面 import，作者（Opus）自认周全；codex 异构评审四轮逐层揭出 11 处 fail-open（全局 fetch 成员/可选链、注释插入、目录 index、计算式 import、minified 无空白、未映射族误判、路径穿越、软链）。同族自评绝对看不见这些——这恰是本契约 I2 要机制强制「评审不塌同族」的活证。契约的开发本身 dogfood 了契约的不变量。
2. **威胁模型注释让评审收敛。** regex 扫描器对抗蓄意混淆（eval/Function/unicode 转义）本质不健全，codex 会无限找绕过。一旦在守卫头显式声明威胁模型（面向意外回归的源文本级兜底、健全需 AST），并告诉评审者射程边界，codex 即停止 whack-a-mole、四轮收敛判 PASS。诚实划界 > 假装全能。
3. **fail-closed 是守卫的正确默认。** 家族测不出、相对边解析不到、动态 import 参数非字面量、文件不可读——一律当违反/命中，而非静默放行。宁可误报也不漏放。
4. **逐条钉红 golden（16→32）锁死每个修复。** 每个 codex 发现先加复现红 case（跑红证明真 fail-open、非倒裁），再修到绿，重签 checksum（棘轮只增不减=护栏 #1 允许）。防回退 fail-open。

## 挂账（route:human / 另起辐条）

- hook 真 session 端到端实时拦：hermetic 只验钩子壳对合成载荷的行为，真 PostToolUse 触发为 route:human。
- 三级梯 watcher（读 breaker 状态、跳闸自动 Sonnet 5→Opus 4.8 xhigh 再派）：另起辐条、不在本契约。
- I1 健全化（AST/真实模块加载）：若未来需对抗蓄意混淆再议，当前威胁模型明确不覆盖。
- loop 纪律 hook 坏引用 `docs/decisions/2026-06-12-loop-kit.md`：根在冻结 `loop-kit/bin/hook-loop-triage.mjs:8` 与 `.claude/skills/acceptance-gate/SKILL.md:8`，route:human。
