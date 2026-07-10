# learn — resign-drift-closure（漂移收口）

## 核心教训:共享冻结文件「只签一处」是复发性合并卫生债
同一个金牌/夹具被多个 prd 的 testChecksums 冻结时,改它只重签其中一个 prd、漏签另一个 → 后者 ratchet 悄悄红(gate 那个 prd 才暴露)。本轮一趟逮出三例同型:
- `p2-verdict`:resolution 契约(0f79adf)收敛 verdict-cases.json 时同步了 verdict/compile/replay/report-model + p3/p5/layer3 金牌,独漏 sha256 冻结的 p2 夹具。
- `prd-mcp-parity`:casey-doctor/distribution 改 cli-mcp-face 金牌加 EXCLUDED、重签了 prd-cli-mcp-face 却漏签也冻它的 prd-mcp-parity。
- 本 session 自己也踩:B+D 合并只重签 prd-p5-replay 的 server.mjs、漏了 D 自己的 prd 也冻 server.mjs（已当场补）。

## 防复发:合并/收敛后跑「全仓 ratchet 总核」
遍历 loop/prd-*.json 的每条 testChecksums、对实际文件 sha256 逐条比对,一次抓全漏签。本轮正是它逮出 prd-mcp-parity(单靠 gate 各 prd 不会碰到跨契约漂移)。建议纳入合并收尾标准动作。

## 词表收敛的完整性边界
resolution 收敛把「多匹配唯一合法字面量」统一到 ambiguous,但 fallback_first/coord_fallback 在 run-history 诊断 locatorResolution 枚举里仍是合法可表征锁值(seams-freeze-v2）——收敛只动裁定链(点击身份门→StepAxes→verdict.mjs),不动只读台账层。改夹具时须分清「裁定链输入」(要收敛)与「台账可表征枚举」(要保留),别一刀切。

## 裁判内核冻结面的人签
verdict-cases.json 是四态判据的冻结地面真值。即便改动客观正确(红先行转绿+异构评审零 findings),仍须人核「对齐收敛、非弱化裁定」后人签(ADR-0004),不自签。
