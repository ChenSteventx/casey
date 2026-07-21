# checksum-drift-closure — plan

> 车道 full。决策源为 `GRILL.md`；Steven 于 2026-07-21 签认 D1=甲、D2=甲、D3=甲。

## 目标

收口 task #17 中两处真实漏签，同时不冲掉两份安全撤销墓碑：

1. 以新增零 SUT 验收锁证明 `report-model.schema.json` 的真实报告交付扩展仍保持闭合、只读且不覆盖裁定；
2. 以现役静态金牌和新增独立断言证明删除确认弹层的 class token 边界与空 `expectedName` fail-closed；
3. 在验收证据齐备后，把两个完整当前 sha256 交 Steven 按 ADR-0004 人签，再只更新两个 owner PRD；
4. 逐 owner 跑 gate，并复跑全仓 ratchet，确认普通 mismatch 从 4 条降为且仅余 2 条有意安全撤销。

## 非目标

- 不修改 `lib/`、`bin/`、报告 schema、现役删除金牌或任何生产实现。
- 不重签两个安全墓碑，不恢复被撤销的旧可执行金牌，不把其 `passes:false` 改绿。
- 不在本契约修改兄弟 `loop-kit`；安全撤销回执识别另立 `ratchet-security-revocation` kernel 级 full 契约。
- 不启动、连接或回放 fake-SUT、fixture SUT、浏览器、网络或真实 SUT。
- 不把本轮零 SUT 绿外推为真机报告交付或真实删除时序已完成。

## 当前红基线

- `ratchet verify --root . --json` 退出码 1：120 份 PRD、396 个冻结文件、498 个引用、恰 4 个
  `CHECKSUM_MISMATCH`。
- 两处真实漏签：
  - `loop/prd-seams-freeze.json` 期望 `6f8647d0…`，当前 report schema 为 `4068ff97…`；
  - `loop/prd-delete-confirm-causal-binding.json` 期望 `5055cc25…`，当前静态金牌为 `483b1e50…`。
- 两处有意安全撤销：driver canonical-root 与 transaction-root 旧 owner 期望各自原始哈希，当前均为
  `a95a02a0…` 安全墓碑；这两条在本契约中必须保持红且 owner `passes:false`。

## 验收设计

新增 `tests/_golden/checksum-drift-closure.zero-sut.golden.mjs`，只读 schema、生产源码和现役静态金牌，
只调用纯函数或无页面触碰的 fail-closed 分支；禁止 spawn、端口、网络、Playwright 与任何 SUT。

### C1 · 报告 schema 扩展闭合

- 顶层 `artifacts` 与 `visualReview` 都是加法可选字段，不进入顶层 `required`。
- `artifacts` 是数组；item 恰有 `kind/file/label` 三个必填字符串，`additionalProperties:false`。
- `visualReview` 为 `object|null`；必填 `status/reviewer/reviewedAt/summary/verdictImpact/evidence`；
  `status` 只允许三态，`verdictImpact` 恒为 `none`，证据条目闭合并限制 `videoAt>=0`。
- 调用 `buildArtifactManifest` 与 `projectVisualReview` 的正例必须满足上述冻结形态；非法
  `verdictImpact` 必须被生产纯函数拒绝。验收不复制裁定逻辑。

### C2 · 删除因果绑定收严

- 现役 `workflow-delete-causal-binding.static.golden.mjs` 必须 exit 0；它自身不启动浏览器或 SUT。
- 新验收独立确认生产 `DIALOG_SELECTOR` 同时覆盖 token 边界形态
  `[class*="message-box "]` / `[class$="message-box"]` / `[class*="popconfirm "]` /
  `[class$="popconfirm"]`，并拒绝会抓内部子类的裸 `class*=` 形态。
- 对 `performWorkflowDeleteTrigger(page, '   ')` 传入会在任意属性读取时抛错的 page 代理；必须零页面读取并
  返回 `action_failed`、`candidateCount=0`、身份回读失败。
- 该函数只从 `lib/workflow-delete-domain.mjs` 直接导入；现役模块无顶层 import。验收仍须静态确认其导入
  闭包不含 Playwright 或启动副作用；若未来导入即初始化浏览器能力，立即停止，不运行该路径。

### C3 · 负控与安全边界

- 对 schema 的内存副本逐项删必填、放宽 `verdictImpact` 或加入额外字段时，结构验收必须红；不得改磁盘
  冻结件制造红证。
- 静态扫描新验收及其 acceptance 闭包，确认不导入/启动 fake-SUT、fixture server、Playwright、网络、
  子进程或浏览器；只允许 Node 标准库、报告纯函数与删除域纯函数。
- `node --check` 与 `git diff --check` 必须通过。

### C4 · 棘轮与人签闭包

1. 写验收后先记录当前 ratchet 的 4 条 mismatch 红基线；新增验收应直接验证既有正确语义，不冒充实现前
   失败，当前契约的真实红是 owner checksum 漂移。
2. 冻结新增验收进 `loop/prd-checksum-drift-closure.json`，`passes:false` 起步且只准 gate 写。
   新增零 SUT 验收的执行结果预期直接绿；`passes:false` 只表示新 PRD 在 gate 前的起始状态。ratchet 红
   只来自 owner checksum 漂移，不来自刻意制造的验收失败。
   新 PRD 只冻结新增 `checksum-drift-closure.zero-sut.golden.mjs`；report schema 与删除静态金牌继续分别
   由原 owner 单独持有，不在新 PRD 重复登记。两目标的直接执行/读取属于验收证据，其字节棘轮由两个
   owner gate 与全仓 ratchet 负责。
3. 验收全绿后，计算两个目标文件完整当前 sha256，并停下交 Steven 明确签认；未签不得改 owner。
4. 人签后只更新：
   - `loop/prd-seams-freeze.json` 中 report schema 的 checksum；
   - `loop/prd-delete-confirm-causal-binding.json` 中静态金牌的 checksum。
5. 分别运行新 PRD gate 与两个 owner gate；最后复跑全仓 ratchet。预期：新增/两 owner gate 全绿；ratchet
   仍 exit 1，但恰只剩两个安全撤销 mismatch，零普通漏签、零新增漂移。不得把“仅余安全撤销红”写成全绿。

## touchesFiles

- `docs/plans/checksum-drift-closure/GRILL.md`（已记录签认，此后只读决策源）
- `docs/plans/checksum-drift-closure/plan.md`
- `tests/_golden/checksum-drift-closure.zero-sut.golden.mjs`
- `loop/prd-checksum-drift-closure.json`
- `loop/prd-seams-freeze.json`（仅第二次 ADR-0004 人签后的一个 checksum）
- `loop/prd-delete-confirm-causal-binding.json`（仅第二次 ADR-0004 人签后的一个 checksum）
- `loop/active-contract.json`

## 执行顺序

1. plan 通过 Grok / `pi.dev` 只读设计复核后推进 plan。
2. 用 `acceptance-gate` 写新增零 SUT 验收，验证安全闭包与真实 ratchet 红基线，冻结新 PRD。
3. 推进 accept；实现阶段只执行验收与证据整理，不改生产实现。
4. 计算两个完整当前 sha256，停在人签门。
5. Steven 签认后更新两个 owner checksum，运行新增 `prd-checksum-drift-closure` gate，以及
   `prd-seams-freeze`、`prd-delete-confirm-causal-binding` 两个 owner gate，再与全仓 ratchet 对账。
6. 以 Grok 做异构实现审，以 `pi.dev` 作独立复核；两者均只收 spec、diff 与门禁证据。
7. 完成 review / learn；另立 `ratchet-security-revocation` 契约，取得兄弟 `loop-kit` 写权限后再实施 D1。

## 停止条件

- 任一验收需要浏览器、网络、fake/fixture SUT 或真实 SUT，立即停止并重设为零 SUT 证据。
- 两个当前哈希未获 Steven 明确签认，立即停在人签门，不改 owner。
- ratchet 出现除两份已知安全撤销外的任何 mismatch，视为新缺陷，停止收口。
- 需要修改生产实现、现役冻结金牌或兄弟 `loop-kit`，停止并重新裁范围。
