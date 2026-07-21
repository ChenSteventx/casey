# sol max 共识请求 R1 — flow-bridge-golden-refit plan v1

你是异构共识评审（gpt-5.6-sol max）。Steven 定的流程：plan 由 Claude 主笔，**须与你讨论到达成一致才能进 accept**。对抗式审，默认怀疑；此前多个契约你逐轮逼出 Claude 自审看漏的洞（弱证/假绿/闭合漏洞），本轮同标准。

## 只读这些 + 核其引用

- `docs/plans/flow-bridge-golden-refit/plan.md`（主审）
- `docs/plans/flow-bridge-golden-refit/GRILL.md`（Steven 三裁决 + 背景）
- 允许只读访问仓库核验一切承重声明。**绝不运行任何金牌/夹具 SUT**（SKILL.md:107，禁跑清单=hermetic-golden-sut-census 的 27 条闭包及其传递 spawn 者）。

## 背景一句话

2026-07-17/18 三波信任根收紧未复跑受影响冻结金牌（护栏 #19），六条陈旧绿。Steven 裁：修夹具侧生产零改 / 三家族全扫 / 全量复 gate 接受诚实红。plan 已按三路取料定形到行级。

## 承重风险清单（请逐条对抗核）

1. **A 家族级联修复声明**：MAPPING 两行补绑定真能级联修复 flow-bridge 五条 happy 且零误伤负向分支？逐 check 核（尤其 C6 的 badPrefix 半段、C9 的 caseId 不一致半段、C11 的三分支——它们有的靠先于实体闸的检查拒、有的靠实体闸拒，补绑定后拒因会不会漂移导致断言错因假绿）。
2. **反向锁设计**：「mutation 缺绑定必拒」断言冻结即绿（回归保护型）——它能否被反例突变证伪（若内核回退放宽，它必红）？断言拒因要不要精确到 ENTITY_BINDING 类错误码防错因假绿？
3. **B1 A6 重建 happy 的 NODE_OPTIONS loader 透传**：`mcp/casey-server.mjs:143` spawnSync 继承 env 的推理成立吗？`--experimental-loader` 经 NODE_OPTIONS 透传到孙进程（MCP server → bin/casey.mjs → bin/intake.mjs 若有再 spawn）的链路有没有断点？降级判据（accept 红先行实证不可行）够不够机械？
4. **B2 语义收窄的诚实性**：「手造三件套→真 intake/distill」替代「真 record→intake」后，原金牌防的哪些假绿保住了、哪些真丢了？C2d/C2f/C2h 三段重写方案（改 20 字段 committed 形）是否会把原防护语义偷换成新链路的碰巧拒绝？挂账 `record-three-piece-producer` 的边界清不清？
5. **B3 租约机制在金牌失败路径下的残留风险**：本 session 实证过金牌 exit 1 时 cleanup 不走、`cases/` 留残（普查污染事故）。plan 的「跑后核无残留」验收点够不够——要不要金牌内 try/finally 强制 cleanup + 残留即金牌自红？
6. **复 gate 顺序与连带翻红面**：全量复 gate 的执行顺序有没有依赖（先修先 gate 会不会把后修金牌的 prd 提前翻红又翻绿、制造噪音 evidence）？连带诚实红的完整清单 plan 没枚举——要不要 accept 前先确定性预演一遍（dry-run 分类）？
7. **搭车判**：env-coupled 超时单行（30s→180s）搭车本契约还是另立？给明确判词。
8. **scope 完整性**：六条之外，本 plan 的修法会不会把现绿金牌打红（尤其 flow-bridge 金牌被 14 个 prd 引用、cli-mcp-face 被 6 个引用——修字节后所有引用处复 gate，有没有引用方断言金牌旧行为的）？

## 产出

逐条判（成立/不成立/需补证）+ file:line。总判：**plan v1 可进 accept，还是有阻断项**。阻断项按严重度排 + 具体修法。诚实划界你没核到的。共识标准：直到你明说「可进 accept」为止，Claude 会逐轮修订再送你复审。
