# p2-intent-compile — learn（契约收尾复盘，2026-06-29）

> 契约最后一阶段。grill / plan / accept / loop / review 全 done 后的留存学习。

## 这条契约证明了什么

裁判内核（`verdict.mjs` 多态裁定 + `compile-gate.mjs` 编译门 + `forensics.mjs` 取证 + `check.mjs` 词表闸）可在零 LLM、hermetic、8 态 golden 钉死下站住「确定性是默认、fail-safe 不 fail-open」的内核。loop 绿后又过了一轮真异构评审 + 对抗核验，未被推翻。

## 留存的学习

1. **fail-open 多藏在条件门的耦合里。** 本轮最危险的缺口 B4：破坏性前缀硬闸（护栏 #14）被裹进 `checkStateMachine`、只在 `registry.states` 存在时跑 —— 一个看似无关的「v2 注册表」条件，把最关键的安全闸静默旁路。教训：安全硬闸要独立成闸、不搭别的条件的便车。已抽成 `checkDestructivePrefix`、不依赖 states。

2. **三层评审各司其职、缺一不可。** 真异构（codex gpt-5.5，非同族）负责找出我和同族都锚定盲掉的缺口（11 条）；同族三镜头对抗核验负责审「我的修复有没有改出新洞」（全 sound）；确定性 gate + 13 探针负责兜底、不靠任何一方自报。护栏 #9（评审只喂 spec+diff+证据）与 #2（只认 exit code、不认自报）在这条链上都真有牙。

3. **工具现实要记账。** codex 的 Windows 实验性只读沙箱在本机起不了进程（`CreateProcessWithLogonW 267`），`codex review` / `codex exec` 凡需跑命令的路径都不可用。可靠绕法：把评审包 inline 进 stdin、明令「不跑任何 shell」，让模型纯静态分析 —— 既绕过沙箱，又顺带把护栏 #9（只看我给的料）锁死。

4. **review 阶段的修复也守冻结契约。** 7 条 fail-safe 修复全部不动冻结 golden、gate 仍 GREEN；新引入的 fail-closed 分支（C1-C4 + B1/B2/B3 新行为）不在 loop/review 里改 golden 补冻，而是登记到延后项、走下轮 acceptance-gate 契约更新。冻结只读（护栏 #1/#5）在 review 阶段同样不松。

## 交到下一阶段的账

- 延后项 C1-C4 + 新 fail-safe 行为 → 下轮 acceptance-gate 补成冻结 golden（见 `HANDOFF.md`「真异构评审」节）。
- 飞轮方向、第二条 flow 移植、端态运行时 A/B/C 待拍板 → 见 `docs/FLYWHEEL.md` 与 `flywheel-schedule.md`。
- push 待人确认（review 已解锁 push）。
