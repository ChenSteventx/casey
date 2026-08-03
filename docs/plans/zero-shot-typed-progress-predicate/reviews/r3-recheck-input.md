# 聚焦复核：R3 订正是否干净解决你上一轮的 Medium finding

你上一轮（对 446881b..981b4a3）判 CHANGES_REQUIRED，唯一 finding（Medium）：
plan.md 残留旧段（L103-104「存在性含 roleVisible 豁免完整性约束」）与 ATDD #14 旧措辞，
与 R2 统一规则/#17 自相矛盾，存在被「修回」而请回 F1 假绿的风险。你建议：删旧段、#14 改纯 urlPathname、与 #17/R2 对齐。

仓库（只读勿改）：/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate
订正 diff：git diff e6e7ea1..e752418

只需回答四点：
1. 该 Medium 是否被干净解决（旧段删净、#14 只剩 urlPathname、无新矛盾）？全文再扫一遍「存在性」相关表述，历史叙述（描述被证伪的旧理由）不算矛盾。
2. 金牌改动是否真的只有 P14 标题措辞（断言体零变化）？git diff 里核。
3. PRD 的 R3 amendment 与新 checksum 是否与实物一致（自己跑 sha256sum 核两件）？
4. 跑 node tests/_golden/zero-shot-typed-progress-predicate.zero-sut.golden.mjs，只信退出码。

不修改任何文件。结尾一行 VERDICT: APPROVE 或 VERDICT: CHANGES_REQUIRED。
