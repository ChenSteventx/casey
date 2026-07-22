你是 Casey 仓 drafter-patch-intent-guard 契约的异构评审员（评审家族≠实现家族：Claude 实现→codex 评）。这是一个 light 车道小修单：封「bin/draft.mjs --patch 错位 intentId 静默新建孤儿 intent」的工装缝（real-uat-attestation R2 真机实证：错位断言冻进 expected 但回放永不匹配）。工作目录 /mnt/d/ctx/heren/casey（只读）。

【材料】
1. 契约件：docs/plans/drafter-patch-intent-guard/{GRILL.md, plan.md, accept/red-proofs/draft-cli-d10.red.txt}
2. 修复提交：git show ced85db（bin/draft.mjs 存在性闸 + 金牌 D10/D11 + owner prd checksumAmendments + 契约 prd）
3. 现成证据（勿重跑）：红先行 D10 实证修前 exit 0 落孤儿；修后 draft-cli 11/11、output-seal 27/27、caseid-echo-mask/p4-drafter/tier1 全 exit 0；prd-draft-cli 与契约 prd 双 gate GREEN。

【评审维度】
R1 闸的正确性：存在性闸置 validateDraft（词表硬闸）之后、credentialGate/落盘之前——闸序是否确实不动 output-seal F4 冻结面（F4 的 observed 无 steps、patch 携词表外 kind/op 种子）；基准=observed.steps 全集（而非 skeleton intents）是否正确防误杀；对 compile-report 侧 assertionAtoms 造出的 observed 外 intent 是否同样拦住（这是刻意的同病同封，见提交注释）。
R2 遮值纪律：违例值不回显、报 intents[序号]——与 output-seal 遮值+可诊断定位词的既有口径是否一致；有无新的内容泄漏面。
R3 金牌钉质量：D10 负控（65+零落盘+stderr 定位词）与 D11 正控（合法新建不误杀+草稿不含 observed 外 intent）是否足钉本缝；红证是否真实（修前 exit 0）。
R4 记账：owner prd checksumAmendments 修单账与契约 prd 是否账实相符。

【输出要求】
逐维度裁定 OK / FINDING（给 文件:行号 与级别）；最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。
