# learn · p9-replay-ref-rebuild

## 事实链

- P9 v3 冻结红件（R1–R5）在实现前 exit 1；本轮在 bin/replay.mjs 建表后、准入门前、
  浏览器哨兵前按 I1–I8 校验已签授权边并铸 ref 入表，金牌零字节改动下 R1–R5 全绿。
- 双路异构评审（grok + pi，全仓暴露）合计 11 例独立负探针全 exit 65 + 具名拒因 +
  哨兵缺席；gate 双方各自重跑 GREEN 6/6。

## 教训（可迁移）

1. **共享 scratch 是并行 gate 的竞态面**：多个 gate/金牌进程互抢
   `.golden-scratch-*` 会产生瞬时假红（S5 一例，pi 逮到、grok 定位）。并行验证要么
   隔离 scratch 目录，要么串行收口留最终记录；瞬时红要入账不要静默覆盖。
2. **「逐字未动」只许说 diff 为空的文件**：行为等价重构（抽常量、并分支）与字节级
   未动是两种主张，评审会按字面复核。措辞按证据强度写：diff 空=字面真；重构=
   「语义/行为零漂移 + 实证方式」。
3. **静态咬合金牌对注释与导入写法敏感**：注释里出现 `chromium.launch` 字样、把准入
   函数并进多行导入，都会翻转位置断言。碰这类金牌先读它咬什么，再动手。
4. **红因措辞位移要如实标注**：wiring 金牌首断言因本轮合法导入而后移（红/绿状态与
   计数不变），executor 主动披露、评审确认——这是对的做法，瞒着就会变成「擅改红因」。

## 评审

- R1 双路联审（全仓暴露）：grok-4.5 high + pi deepseek-v4-flash high，快照 `9e85c69`。
- 结论：两路均终局 APPROVE，零 Critical/High；两条 Medium（措辞订正 + scratch 竞态
  瞬时红）均已处置，详见 `reviews/README.md`。

## 遗留

- 出站消费链（page.route 真拦/平台 ID 真核/abort 先于发出）hermetic 证不出，
  route:human；不得宣称破坏链已闭。
- v3 锁产出侧（编译期攒授权边、随草案交签署冻结）由后续契约落。
- `profile.mutationUrlPattern` 编译侧剖面形状门不校验——真机前检查单项。
- 跨树 baton 解析缺口（阶段互锁按 session cwd 而非提交所在树解析）挂账待 Steven 裁。
