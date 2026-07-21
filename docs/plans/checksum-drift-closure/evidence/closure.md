# checksum-drift-closure 收口证据

## 验收点去向

| 验收面 | 去向 |
|---|---|
| 报告 schema 的 `artifacts` / `visualReview` 闭合形态、生产纯函数投影与负控 | 新 PRD story `s1-zero-sut-semantic-closure` |
| 删除弹层 class token 边界、空 `expectedName` 零页面读取 fail-closed | 同一 story + 原 owner 静态金牌 |
| 浏览器、网络、子进程、SUT 禁入与导入闭包检查 | 同一 story 的 C3 |
| 两个完整当前 sha256 | `HUMAN-SIGN.md`，ADR-0004 route:human 已签 |
| 真实报告附件/视觉复核与真实 Heren 删除时序 | 新 PRD observability，route:human |
| 两份安全撤销的 ratchet 具名建模 | 后续 `ratchet-security-revocation` 独立契约 |

## 红基线

签前 `node loop-kit/bin/ratchet.mjs verify --root . --json`：exit 1；120 份 PRD、396 个冻结文件、498 个
引用、4 条 `CHECKSUM_MISMATCH`。两条为真实漏签：

- report schema：期望 `6f8647d0242a0a60198749df25a3599fd156161050a3c4d6586bcfe165923e38`，
  当前 `4068ff977ccdefc571de28880debdc7975c7cdc525c0a5d2d1787f17f816ed23`；
- 删除静态金牌：期望 `5055cc2526182621f10cd2b560a7d4da96bec6849517120bda3d2bf363204830`，
  当前 `483b1e50908427e05f3c4a11ebf00dd4435d9ef10b1afa1fac2071e14b819abb`。

另两条是 driver canonical-root / transaction-root 的有意安全撤销墓碑，不在本契约重签。

## 回归保护验收

- `node tests/_golden/checksum-drift-closure.zero-sut.golden.mjs`：exit 0，6/6。
- `node tests/_golden/workflow-delete-causal-binding.static.golden.mjs`：exit 0，12/12。
- `node --check tests/_golden/checksum-drift-closure.zero-sut.golden.mjs`：exit 0。
- `git diff --check`（本契约文件）：exit 0。
- 新验收 sha256：`a3fb3bdf7e576784678552ed0c832877c08382fdaee3b082c0c38bc173354cc5`。
- 新 PRD dry gate：exit 0；ratchet 与术语检查通过，4 条 acceptance 均被识别。

新增测试是存量正确语义的回归保护，执行预期直接绿；本契约的真实红基线是两个 owner checksum 漂移，
未刻意制造验收失败冒充 ATDD 红证。验收及两个 owner 的 acceptance 都不启动浏览器、网络、fake/fixture
SUT 或真实 SUT。

## 人签与 gate

Steven 明确签认 `HUMAN-SIGN.md` 所列两个完整当前 sha256 后，只更新两个 owner checksum：

- 新 `prd-checksum-drift-closure` gate：GREEN 1/1；
- `prd-seams-freeze` gate：GREEN 1/1；
- `prd-delete-confirm-causal-binding` gate：GREEN 1/1。

三个 PRD 的 `passes` 均只由 gate 写；两份安全撤销 owner 的 checksum 与 `passes:false` 未改。

## 签后 ratchet

全仓 ratchet：exit 1；121 份 PRD、397 个冻结文件、499 个引用、恰 2 条 `CHECKSUM_MISMATCH`：

1. `teachin-observation-driver-canonical-root.zero-sut.golden.mjs`：原始期望 `fe58a3e4…`，当前安全墓碑
   `a95a02a0…`；
2. `teachin-observation-transaction-root.zero-sut.golden.mjs`：原始期望 `189065ab…`，当前安全墓碑
   `a95a02a0…`。

结论：两处普通漏签已收口，零新增漂移；仅余两条已签决策要求保留的安全撤销红。本证据不把 ratchet
exit 1 写成全绿，D1 的具名撤销态仍待后续独立契约。
