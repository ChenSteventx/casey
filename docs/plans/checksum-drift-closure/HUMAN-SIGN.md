# checksum-drift-closure 冻结面人签清单（ADR-0004）

## 签署记录

Steven 于 2026-07-21 明确回复「签认以上两个 sha256」。签认发生在新增零 SUT 验收 6/6、现役删除静态
金牌 12/12、新 PRD gate 1/1 GREEN 之后；据此只更新下列两个原 owner 的对应 `testChecksums`。

| owner PRD | 冻结文件 | 旧 sha256 | 已签新 sha256 |
|---|---|---|---|
| `loop/prd-seams-freeze.json` | `tests/_golden/schemas/report-model.schema.json` | `6f8647d0242a0a60198749df25a3599fd156161050a3c4d6586bcfe165923e38` | `4068ff977ccdefc571de28880debdc7975c7cdc525c0a5d2d1787f17f816ed23` |
| `loop/prd-delete-confirm-causal-binding.json` | `tests/_golden/workflow-delete-causal-binding.static.golden.mjs` | `5055cc2526182621f10cd2b560a7d4da96bec6849517120bda3d2bf363204830` | `483b1e50908427e05f3c4a11ebf00dd4435d9ef10b1afa1fac2071e14b819abb` |

## 边界

- 本签认不覆盖 driver canonical-root 或 transaction-root 两份安全撤销墓碑；其 owner checksum 与
  `passes:false` 保持不变。
- 本签认不授权修改生产实现、现役冻结金牌或兄弟 `loop-kit`。
- 两个 owner 的 `passes` 仍只由 gate 写；本次人工写入仅限已签 checksum。

## 签后机器动作

1. 新 PRD gate GREEN 1/1；`passes` 由 gate 从 false 写为 true。
2. `prd-seams-freeze` gate GREEN 1/1；report schema checksum 对齐已签值。
3. `prd-delete-confirm-causal-binding` gate GREEN 1/1；删除静态金牌 checksum 对齐已签值。
4. 全仓 ratchet 复核为 121 份 PRD、397 个冻结文件、499 个引用、恰 2 条 mismatch；仅剩两份已知
   安全撤销墓碑，零普通漏签、零新增漂移。该 exit 1 是本契约预期停点，不冒充全绿。
