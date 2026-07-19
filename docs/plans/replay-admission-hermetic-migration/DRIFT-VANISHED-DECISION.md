# 决策包：p5 drift/vanished 两案的处置（呈 Steven 拍板）

> 背景：replay-admission-hermetic-migration 契约波 1-4 迁移中确证——`p5-replay` 金牌 10 案里 drift/vanished 两案**在现役内核下不可满足**，且根因不是准入门、而是更早的 delete 域锁化演进。本契约其余迁移面不受影响照常推进；这两案红会卡 `prd-p5-replay` 翻绿，从而卡本契约验收点 1 的完整达成。

## 事实链（file:line 亲核）

1. 两案的教义（冻结于 `tests/_golden/fixtures/p5/replay-cases.json`）：录制期脆性定位器（纯位置 `fallbackCss` + `nth`，无语义、无 `text`/`value`）回放失配 → `resolution:'none'` → 只读漂移探针查同稳定签名 → drift 判 `HARNESS_ERROR`（自愈门开闸证据，护栏 #13）/ vanished 判 `NEEDS_HUMAN(INDETERMINATE)`。
2. 内核演进（2026-07-16 系，`4cd5397`/`4326e27`/`3fc0032`）把 `workflow.deleteByName` 收进域锁路径：
   - `lib/replay-actions.mjs:31-40`：delete click 在进入通用定位路（`resolveCandidate`→`gateAndAct`）**之前**被截走，label（`semantic.name`/`text`）与 `value`（目标名模板）缺任一即 `action_failed`；有则走 `lib/workflow-delete-domain.mjs` 按名定位——**录制定位器完全不参与**。
   - `bin/replay.mjs:221`（`lib/workflow-delete-spec.mjs:7-23`）：delete click 缺合法 label/`value` 时启动浏览器前即 exit 65（两案波 0 实测红即此门）。
   - `lib/workflow-delete-domain.mjs`：全路径**不发漂移探针**（grep 零命中）。
3. 连带内核级发现：漂移探针 canonical 表只登记一个原子（`lib/drift-probe.mjs:8-10` 仅 `workflow.deleteByName`），而该原子已到不了发探针的通用路——**正向漂移 `HARNESS_ERROR` 在现役回放内核全局不可达**，自愈门（护栏 #13）失去活触发器。探针代码仍在（`replay-actions.mjs:589/642/675` 供 dragTo/通用路/select 调用），但对这些原子 canonical 恒 null → `sameSignatureUniquePresent:false` → 永不满足 `driftHolds`。
4. 为什么不能改夹具凑绿：给两案补 `text:'删除'`+`value` 会让回放走域锁按名定位——drift 场景目标行存在会**删成功**（教义从「漂移侦测」变「删除成功」）、vanished 场景变普通缺席——两案要证的探针语义荡然无存，属倒着裁夹具（禁）。

## 选项

- **A（推荐）墓碑吊销两案 + 命名后继**：照 `semantic-lock-cert-closure` 先例（`tests/_golden/fixtures/semantic-lock-cert-closure/supersession-revocation.json`，benign SUPERSEDED 式样）出收据吊销这两案（案级变体：从 `replay-cases.json` 移除/标记 + 收据记原字节 sha + 教义作废理由 + 后继指名），漂移判别的后继面指 `teachin-semantic-lock-runtime-discrimination-successor`（0/26 前瞻红基线，本就是运行时判别的收纳地）+ 单元层 `p2-verdict`（verdict 映射已有单元证）。需 Steven 人签（ADR-0004 冻结断言变更）。
  - **codex gpt-5.6-sol high 修正（2026-07-19，已采纳）**：**不得借删两案让原 `prd-p5-replay` s1 story 翻绿**——原 story 明确冻结 10 案 + 漂移探针 + fake-sut replay（`prd-p5-replay.json:27`），删两案标绿 = 把「契约被取代」伪装成「原契约通过」（假绿）。仓内先例 `supersession-revocation.json:3` = `superseded-tombstoned-not-pass`、旧 story 保持 false。正确：原 p5 story 保持 false/superseded + 出案级吊销收据（冻原 hash/作废因/后继）+ **新建 successor PRD 承 8 存活案**。此项归 DIRECTION-AFTER-CODEX.md 阶段二 (c)，前置于阶段一（信任根分离）之后。
- **B 保持红、挂账等内核裁决**：本契约验收点 1 无法完整达成（`prd-p5-replay` s1 恒红 → 契约 s2 恒红），契约以「余账明示」姿态收口。诚实但把基础债留在原地，mountdelay 继续被卡。
- **C 按新教义重写两案**：改成「合法 delete 绑定 + 域锁删除成功/缺席」的用例——证的是删除域锁而非漂移探针（该面已有 `workflow-delete-spec-preflight.static` 等覆盖），漂移证被静默丢弃，最不推荐。

## 附带上报（独立于 A/B/C，建议入 backlog）

正向漂移不可达 = 自愈门（相 5）在现役内核无活触发器。若自愈路线仍要保，需在语义锁 v2 运行时判别（successor 面）或新探针挂点上重建「同稳定签名仍在」的可达证据链；若 delete 域锁化即新教义（漂移侦测由语义锁 v2 承接），则 `lib/drift-probe.mjs` 与 `verdict.mjs` 的 `driftHolds` 分支成了死码面，值得单独立契约清理或显式保留注记。
