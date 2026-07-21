# checksum-drift-closure — GRILL

> task #17。本文只冻结问题分型与决策分岔；尚未修改任何 `testChecksums`、`passes`、冻结金牌或
> `loop-kit` 包。状态事实取自 `ratchet verify --json`、git 历史与现役安全撤销回执。

## 目标

把全仓棘轮报告的 4 个 `CHECKSUM_MISMATCH` 分成真实漏签与有意安全撤销，避免两种假动作：

1. 把漏签字节继续留成陈旧绿；
2. 把已撤销的不安全门禁重签成可执行绿，冲掉安全墓碑。

## 只读核账证据

`ratchet verify --root . --json` 退出码为 1，汇总为 120 份 PRD、396 个冻结文件、498 个引用、恰好
4 个问题。主树及两棵暂停改革 worktree 对下表 8 个目标文件均无未提交改动，未发现并发在手。

| owner PRD | 冻结文件 | 期望 sha256 | 当前 sha256 | 分型 |
|---|---|---|---|---|
| `prd-seams-freeze` | `report-model.schema.json` | `6f8647d0…` | `4068ff97…` | 真实漏签 |
| `prd-delete-confirm-causal-binding` | `workflow-delete-causal-binding.static.golden.mjs` | `5055cc25…` | `483b1e50…` | 真实漏签 |
| `prd-teachin-observation-driver-canonical-root` | driver canonical-root 金牌 | `fe58a3e4…` | `a95a02a0…` | 有意安全撤销 |
| `prd-teachin-observation-transaction-root` | transaction-root 金牌 | `189065ab…` | `a95a02a0…` | 有意安全撤销 |

### 真实漏签

- 报告 schema 在 `f78cd97 feat(report): finalize real-run delivery evidence` 合法扩展，owner PRD 最后重签
  停在 `89b29e3`，故 owner 仍记录变更前哈希且 story 保持陈旧 `passes:true`。
- 删除静态金牌在 `3953cf1 fix: bound causal dialog class tokens` 随生产安全修复收严，owner PRD 仍记录
  `825aeb7` 初版哈希且 story 保持陈旧 `passes:true`。
- 两者均须先验证现役零 SUT 验收，再按 ADR-0004 人签重签 owner；`passes` 只能由 gate 按退出码刷新。

### 有意安全撤销

- `1e6c3c5 fix: secure observation runtime trust root` 在同一提交中把两份会递归删除固定用户用例目录的
  旧金牌统一替换为 5 行 exit 78 安全墓碑，因此当前哈希相同不是并发合并污染。
- 原始字节分别保存在 `tests/_golden/revoked/*.archive.gz`；安全撤销回执记录各自原始哈希、
  `ratchetStatus:security-revoked-not-pass`、后继 `teachin-observation-safe-case-lease-v2` 与
  「旧冻结资产由压缩归档保留」策略。
- 两个旧 owner story 已是 `passes:false`。把墓碑当正常后继重签并运行成绿，会违反撤销语义；
  恢复原可执行金牌更会重新引入破坏性删除风险。

## 已排除

- 不是当前三份用户修改 PRD 导致；它们不引用本表四个文件。
- 不是两棵暂停改革 worktree 的未提交改动；目标路径在两树均干净。
- 不是四份文件同时被同一个并发分支误写；git 历史分别指向三个明确提交。
- 不运行 fake-SUT、浏览器、网络或旧撤销金牌；本阶段只读。

## 决策分岔

### D1 · 两份安全墓碑如何进入棘轮总核

甲（推荐）：给独立 `loop-kit` 包的 ratchet 增加严格的安全撤销回执识别。

- 只接受固定 schema、固定 artifactKind、`security-revoked-not-pass`、原始哈希精确等于 owner PRD
  期望值、当前可执行文件精确为 fail-fast 墓碑、归档解压字节哈希精确等于原始哈希、后继 PRD/金牌存在且
  已绿的闭合组合。
- 满足组合时输出具名 `SECURITY_REVOKED` 状态而非普通 mismatch；任一字段缺失、归档不符、墓碑可执行
  成功或后继不成立都保持红。
- 保留旧 owner checksum 与 `passes:false`，不把撤销历史改写成新绿。
- 代价：触通用强制层与兄弟包，须另立 kernel 级 full 契约、双设计审、异构实现审、round-2、双消费者
  受影响面复验和 Steven 人签；包目录不在本工作区写权限内，实施前还需明确授权。

乙：把两个旧 owner checksum 重签为同一墓碑哈希，但维持 `passes:false`。

- 优点：现役 ratchet 无需改代码即可少两条 mismatch。
- 风险：旧 owner 从「冻结原始门禁」变成「冻结墓碑」，历史语义改写；安全撤销回执虽保存原哈希，但
  通用棘轮无法证明归档、墓碑与后继的联合闭合。拒绝作为默认方案。

丙：永久保留两条 mismatch，只修另外两条真实漏签。

- 优点：零强制层改动，安全方向保守。
- 风险：全仓棘轮长期非绿，真实新漂移会混入已知红噪音，违背 task #17「收口」目标。只可作为暂时停点。

### D2 · 两处真实漏签如何收口

甲（推荐）：同一 full 契约内先写零 SUT 验收锁，验证报告 schema 与删除静态金牌的现役行为，再由 Steven
签认两个当前哈希，更新两个 owner `testChecksums`，逐 owner 跑 gate，并复跑全仓 ratchet。

乙：只改 checksum 不补验收证据。拒绝；这会把字节相等冒充语义正确。

### D3 · task #17 是否拆契约

甲（推荐）：本契约负责核账、两处真实漏签的验收与人签收口；D1 若选甲，另立
`ratchet-security-revocation` kernel 级 full 契约改兄弟 `loop-kit` 包。两契约顺序执行，先保持
安全墓碑红，再让棘轮具名理解撤销。

乙：把 owner 重签与 ratchet 强制层改动塞进同一契约。拒绝；冻结写面与通用包强制层的评审、权限和
双消费者影响面不同，合并会扩大回滚与审计半径。

## 推荐裁决

- D1=甲：显式建模安全撤销，严格闭合才从普通 mismatch 转具名撤销态。
- D2=甲：两处真实漏签必须有零 SUT 验收、ADR-0004 人签与 gate 退出码。
- D3=甲：本契约与后续 kernel 契约分开。

## 人签裁决

Steven 于 2026-07-21 明确签认：D1=甲、D2=甲、D3=甲。grill 可推进；本次签认只授权按裁决写
plan 与验收，不等于签认两处真实漏签的当前 sha256。更新 owner `testChecksums` 前，仍须把两个完整当前
哈希交 Steven 另行签认。
