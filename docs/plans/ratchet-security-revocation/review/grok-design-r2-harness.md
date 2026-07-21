# Grok 设计审 round 2：HARNESS_ERROR

- 输入：当前 GRILL 真实 diff；内联 `loop-kit/bin/ratchet.mjs`、安全撤销回执、owner/successor/closure PRD 与
  golden、ADR-0008、C0/C2/C6、反向索引金牌与 ratchet baseline。凭据闸先行通过。
- 评审姿势：仓外临时包、零工具、禁联网、禁子代理；只收结构化 Critical/High/Medium findings。
- 结果：三次均由 xAI 上游以 `stopReason=Cancelled` 中止；其中两次 stderr 还报告
  `max turns reached`。可靠性闸按约定退出 8，拒收为空结果，未判 PASS/FAIL。
- pi.dev：本轮错误调用了未配置的裸 WSL CLI，又错误搜索公开配置。Steven 已明确 pi.dev 可用、认证由既定
  调用链内联；这些裸入口输出只能证明调用方式错误，不能证明供应方或额度不可用。按用户要求未调用 CC。

## 当前闸状态

round 1 的 1 HIGH / 6 MED / 3 LOW 已全部处置进 GRILL，但 kernel 级双设计审尚未取得第二份有效结论；
`contract.stages.grill.done` 必须保持 false。不得进入 plan/accept，不得写兄弟 `loop-kit`。

## 恢复条件

满足其一后重新送审：

1. 用项目既定的已配置 pi.dev 入口取得有效跨族结论；或
2. Grok 上游恢复，可靠性闸取得 `EndTurn` 且结构化输出通过引用校验；或
3. Steven 明确签署一次性治理例外：接受 round 1 有效审 + round 2 HARNESS_ERROR，并同时签认 GRILL D4。

第 3 项只豁免本次第二设计审的可用性，不豁免 acceptance red、精确 sha256 人签、实现异构审与全部 gate。
