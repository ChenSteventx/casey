# 计划：补齐四态徽章渲染覆盖

lane = `light`（只改冻结夹具与两份 prd 的换签账，不碰 `lib/` `bin/` 实现；触人签门故不走 `direct`）。

## 一句话

给共享夹具 `tests/_golden/fixtures/seams/report-model.fixture.json` 加两步——一步 `HARNESS_ERROR`、
一步 `NEEDS_HUMAN`（带理由子类）——让 `tests/_golden/p7-report.golden.mjs` 已有的逐步徽章断言
天然覆盖到那两态，并把裁定概览计数改到与步级数据自洽。渲染器与黄金标准断言均不改。

## 改动面

| 文件 | 动作 |
| --- | --- |
| `tests/_golden/fixtures/seams/report-model.fixture.json` | 加 `atstep_2`（`HARNESS_ERROR`）、`atstep_3`（`NEEDS_HUMAN` + `reason`）；`verdictSummary` 两个 0 改成 1 |
| `loop/prd-p7-report.json` | 换签：`testChecksums` 该夹具项改新 sha + `checksumAmendment` |
| `loop/prd-seams-freeze.json` | 换签：同上（同一夹具被两份 prd 同时冻结） |
| `tests/_golden/fixtures/seams/.pre-report-badge-four-state-coverage-amendment.archive.gz` | 原件 gzip 存档，回验 sha 等于原冻结值 |

不改：`lib/report.mjs`、`tests/_golden/p7-report.golden.mjs`、`tests/_golden/schemas/report-model.schema.json`。

## 两步的形状（复现真实形状，不凑数）

新步必须合 `tests/_golden/schemas/report-model.schema.json`（处处 `additionalProperties: false`），
且形状要与 `bin/verdict.mjs` 的判定树自洽——不是随手贴个 `verdict` 字段。

- `atstep_2` / `HARNESS_ERROR`：动作没做成（`resolution` 为 `none`）+ 只读漂移探针正命中（同稳定签名唯一元素仍在）
  → 判定树落 `HARNESS_ERROR`，`reason` 为 `null`，`defectTicket` 为 `null`，取证不背书本步。
  对齐 `tests/_golden/fixtures/p2/verdict-cases.json` 的 `harness_error` case。
  注：报告模型的 `action` 只留 `kind` / `describe` / `resolution` 三键（schema 已投影删去漂移探针细节）。
- `atstep_3` / `NEEDS_HUMAN`：动作唯一 + 硬断言失败 + 取证干净 → `reason` 为 `SUT_DEFECT_OR_STALE`，
  `defectTicket` 为 `null`。对齐同夹具的 `sut_defect_or_stale` case，也是 publish 真机四轮实际落的那一态。

## 验收点

1. `node tests/_golden/p7-report.golden.mjs` 退出码 0，且其逐步徽章断言实际走到「过程错误」「待人裁决」两条文案，
   以及 `NEEDS_HUMAN` 的「理由子类」分支。
2. **变异验证有判别力**：在临时副本里把 `lib/report.mjs` 的 `VERDICT_ZH.HARNESS_ERROR`、
   `VERDICT_ZH.NEEDS_HUMAN`、`VERDICT_CLS` 对应项、以及理由子类那一段分别改坏，`p7-report` 必须变红（退出码非 0）。
   只证「加了夹具还是绿」不算数。副本做完按 sha256 校验主树 `lib/report.mjs` 未被污染。
3. **邻接零回归**（护栏 #19）：`grep -rl "report-model.fixture" tests/_golden/` 列出的全部消费者逐个复跑，
   只信退出码。既有陈旧红须与改动前 `HEAD` 基线对比，证明不是本轮引入。
4. 两份 prd 的 `checksumAmendment` 齐备：`files` 列全、`reason` 写清为什么改与变异验证结果、
   `signedBy` 先挂 `PENDING_STEVEN`；原件存档回验 sha 等于原冻结值。
5. `node loop-kit/bin/gate.mjs --prd loop/prd-p7-report.json` 与 `--prd loop/prd-seams-freeze.json` 到 GREEN。
6. `node tests/_golden/support/prd-drift-scan.mjs` 退出码 0；`node loop-kit/bin/term-lint.mjs --registry` 退出码 0。

## 纪律

不跑真机、不碰 `.auth/` 与 `site.json`；`passes` 只有 `loop-kit/bin/gate.mjs` 有权写；不提交、不推送。
