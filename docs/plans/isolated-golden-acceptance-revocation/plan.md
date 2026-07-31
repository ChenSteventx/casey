# isolated-golden-acceptance-revocation（lane=light）

Steven 2026-07-31 两条裁定的落地计划。核心是**撤销对隔离件的非法引用**，不是删红验收让门禁好看。

## 背景事实（已实测核对，非转述）

2026-07-20 一份人签重裁（`loop/prd-hermetic-golden-zero-sut-lifecycle.json`，commit `b3bee6b` + `95bb6bb`）把 27 枚启夹具 SUT 的历史金牌判入隔离态：`agentExecution: forbidden`、`route: human`、`coverageRelation` 取 `partial|none|uncertain`。义务账在
`tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json`（239 条义务 / 27 个 live executable）。

该重裁同时把各 prd 里引用隔离件的验收命令搬空。已核 git：

- `prd-p5-replay#s1-replay`：重裁前 `[p5-replay.golden.mjs, tier1]` → 重裁后只剩 `[tier1]`，并**刻意留 `passes: false`**；
- `prd-replay-settle-mount#s2-regression-and-resign`：重裁前 8 枚金牌 + `tier1` → 重裁后只剩 `[p5-replay-coverage.golden.mjs, tier1]`（8 枚里 7 枚是隔离件），同样刻意留 `false`；
- `prd-chief-bringup#s1`：重裁前 `[chiefcomplaint-smoke.golden.mjs, tier1]` → 只剩 `[tier1]`；
- `prd-login-traffic-drop#s1`：重裁前 `[replay-login-bootstrap.golden.mjs, chiefcomplaint-smoke.golden.mjs, tier1]` → 只剩 `[tier1]`。

`selftest --tier1` 只查术语表/熔断器/门禁/裁判纯度，与上述 story 的义务毫无关系，留它当验收即空心。

## 已定位的根因（本轮新证）

2026-07-22 的 `stale-red-admission-refit` 契约**直接改了两枚已被 07-20 判入隔离的金牌**
（`tests/_golden/p3-compile.golden.mjs`、`tests/_golden/report-diagnostics.golden.mjs`），并把它们重新塞回活验收。实测两处后果同源：

1. `hermetic-golden-prd-reverse-closure` 报三条非法引用；
2. `hermetic-golden-isolation-pending` 由设计上的 `exit 78`（保持旧 story 非绿）跌成 `exit 65` 的**失败即关闭**态——因为隔离账里冻结的 `originalFileSha256` 与改后字节不符：

   | 隔离件 | 账内 sha256 | 实际 sha256 |
   | --- | --- | --- |
   | `tests/_golden/p3-compile.golden.mjs` | `4f56c276…` | `b955b67a…` |
   | `tests/_golden/report-diagnostics.golden.mjs` | `2b12caab…` | `78e2b5e3…` |

隔离账是人签件，**摘要漂移不由代理回填**（回填等于替违规洗白），挂 `route:human`。

## 既有形制（照抄，不新造机制）

隔离件所属 story 的合法验收面已有约定：`node tests/_golden/hermetic-golden-isolation-pending.zero-sut.golden.mjs`。
它静态读隔离账、零执行任何旧金牌/SUT/浏览器，并以非零退出保持 story 非绿。
现有 6 份 prd 已在用：`prd-flow-bridge#s2`、`prd-layer3-wiring#s1`、`prd-replay-nth-visible-hardening#s1`、
`prd-replay-settle-mount#s1`、`prd-sign#s2`、`prd-video-login-carry#s2`。本轮沿用，不发明新哨兵。

**为什么不能把验收清空**：`loop-kit/bin/gate.mjs` 对空 `acceptance` 数组的 `storyGreen` 恒为 `true`，会把 story 写成
`passes: true`。清空 = 空心绿，正是本轮要治的病。

## 落地步骤

### 裁定一：撤三条非法验收

| 位置 | 动作 | 撤后验收面 |
| --- | --- | --- |
| `prd-stale-red-admission-refit#s1-report-diagnostics-refit` | `report-diagnostics.golden.mjs` → `isolation-pending` | 无机器验收面，挂 `route:human` |
| `prd-stale-red-admission-refit#s2-p3-compile-refit` | `p3-compile.golden.mjs` → `isolation-pending` | 无机器验收面，挂 `route:human` |
| `prd-entity-destructive-continuity-guard#s7-round5-compile-admission-closure` | 只删 `p3-compile.golden.mjs` 一行 | 仍留 `entity-destructive-continuity-guard.compile-admission.golden.mjs`（真机器面，本 story (A) 半边的对抗自证金牌） |

同 story 其他验收命令一条不碰；两枚隔离件路径之外一律不动。

### 裁定二：重裁账本三处收尾

1. **闭集漂移 27 → 30**：`hermetic-golden-sut-census` 的 `EXPECTED_REPO_CLOSURE` 补进 07-22 新落三枚
   （`agent-id-readback.chat-sut`、`entity-ui-wiring.bindagent-replay`、`entity-ui-wiring.searchopen`）。该金牌冻结，走
   `checksumAmendment` + `signedBy: PENDING_STEVEN`，原件 gzip 存档并回验 sha。
   **三枚补进隔离义务账一节停手待裁**，理由见下节。
2. **两处翻转判无效**：`prd-p5-replay#s1` 与 `prd-replay-settle-mount#s2` 的验收面改成如实反映义务
   （前者原义务件 `p5-replay.golden.mjs` 已隔离 → 换 `isolation-pending`；后者保留仍可跑的 `p5-replay-coverage.golden.mjs`
   与 `tier1`，另加 `isolation-pending` 记 7 枚隔离件的缺口），再跑 `gate.mjs` 让它按实翻。`passes` 全程只由门禁写。
3. **两份空心 prd**：`prd-chief-bringup#s1`、`prd-login-traffic-drop#s1` 的原义务件全是隔离件，
   配不出真后继 → 换 `isolation-pending` + `observability` 如实挂 `route:human`，不拿 `tier1` 充数。

每条撤销/改动都在所属 prd 的 `observability` 记一条：撤了哪条、为什么撤、撤后验收面、有无新增 `route:human`。

## 停手边界（不做，待人裁）

**三枚新金牌补进隔离义务账**一节停手，不由代理自产。三条硬理由：

1. 本 prd 自己的 `observability` D9 明写「全量原子化 obligations 在冻结前仍须逐项人工复核 source span、覆盖关系与生命周期，
   **禁止由模型自产自签**」。补账正是自产原子义务。
2. 补账不是往一个文件加三行：`hermetic-golden-lifecycle-closure` 要求 `source-obligations`（349 条）与 `subsumption-matrix`
   （349 条）按 `obligationId` **等集**，且每条须带 `sourceSpan`、`executionRequiresSut`、`assertionConsumesSutEvidence`、
   `shapeProducedByBrowser`、`judgmentCanRunZeroSut`、`lifecycle`、`successors`、`partialSuccessors`。三枚金牌得逐检查原子化并逐条判覆盖关系。
3. 一旦入账，`hermetic-golden-prd-reverse-closure` 会立刻判**另外 4 条现绿 story 非法**：
   `prd-agent-id-readback#s5-browser-recipe`、`#s6-regression-locks`、`prd-entity-ui-wiring#s1-searchopen-joint-targeting`、
   `#s3-bindagent-replay`。这是两份在跑线上的 prd，连带转红的面远超本轮三条撤销。

另：裁定里提到的「现有 52 条」与实测不符——隔离账是 239 条 / 27 件，`source-obligations` 与 `subsumption-matrix` 各 349 条，
`surviving-unit-cases` 99 条，无一为 52。形制照抄前须先对齐这个数。

隔离账两处 `originalFileSha256` 漂移同样停手（见上「根因」），只记账。

## 验收

- 全部改动跑 `node loop-kit/bin/gate.mjs --prd loop/<prd>.json`，**只信退出码**；
- `hermetic-golden-prd-reverse-closure` 由 exit 1 转 exit 0（三条非法引用清零）；
- `hermetic-golden-sut-census` 由 exit 1 转 exit 0（闭集钉到 30）；
- 因撤销而由绿转红的 prd 如实留红，红即正确结果；
- 改动的 md/json 跑 `node loop-kit/bin/term-lint.mjs --file <路径>`。
