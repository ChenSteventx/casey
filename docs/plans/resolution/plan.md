# resolution — 多匹配 `resolution` 词表统一（触裁判内核，full）

> 起草态（零-baton）：本文只落计划骨架，未 `contract init`、未 gate、未提交。实现者继承时先 `casey contract init resolution --lane full --reason "..."`。
> 兑现 `docs/HANDOFF.md` 2026-07-08 快照「挂账另立 full 契约（触裁判内核，DDD 视角揪出）」条。决策见 `docs/plans/resolution/proposed/GRILL.md`（D1–D9），红金牌断言清单见 `docs/plans/resolution/proposed/GOLDEN-TESTPLAN.md`。

## 背景

裁判内核有一处词表分裂造成的哑口：三扇门对「同一件事——多匹配、点没点对存疑」各说各话。

- 编译门 `lib/compile-atoms.mjs` 说 `multi`（`candidateCount>1`）；
- 回放通用门 `lib/replay-actions.mjs`（`gateAndAct`/`doDragTo`/`doSelect`）说 `fallback_first`；
- 回放 `doOpenNode` 门（`replay-actions.mjs:133`）说 `ambiguous`——这是第一扇说出 `CONTEXT.md` 已登记词 `ambiguous` 的门。

裁判 `bin/verdict.mjs` 的 `deriveActionPerformed`（`verdict.mjs:38`）只认 `fallback_first` 与 `coord_fallback` 两个字面量为多匹配歧义，**不认 `ambiguous`**。于是 `doOpenNode` 吐的 `ambiguous` 落不进歧义分支、掉进 `return false`（`verdict.mjs:40`）→ 走 `ap===false` 的 fail-safe 兜底 → 终判 `NEEDS_HUMAN` 但 reason 泛化成 `INDETERMINATE`。CONTEXT 已登记的精确词 `AMBIGUOUS_ACTION` 反被裁判丢弃。

而 `coord_fallback` 在裁判里是幽灵：全仓无任何门吐它进动作轴（grep 确证：只出现在 `verdict.mjs:38` / `report-model.mjs:57` 的识别分支、`bin/replay.mjs:73` 的透传枚举、以及 run-history 诊断 schema），是识别端的死枝。

本契约把裁判链（点击身份门 → 动作轴 `resolution` → `verdict.mjs`）上的多匹配字面量收敛到 CONTEXT 登记词 `ambiguous`、让裁判与 `report-model.mjs` 认它、并删掉裁判识别端的幽灵 `coord_fallback`。**fail-safe 不破**：多匹配前后都终判 `NEEDS_HUMAN`——只是 `doOpenNode` 那一路的 reason 从泛化的 `INDETERMINATE` 提精到 `AMBIGUOUS_ACTION`；此外一律零行为差。

> **本契约最危险的红线**：绝不能把多匹配翻成 `PASS` 或任何终判。改的是 reason 子类的精度，不是终判的方向。golden 必须钉死「多匹配仍 `NEEDS_HUMAN`、只是 reason 更精确」。

## 0. 涟漪勘定与重签（先勘后动）

动 `bin/verdict.mjs` 属动裁判内核——涟漪要列全、只加严不放松。

### 0.1 裁判双镜像必须同步改（一致性门会 fail-closed）

`lib/report-model.mjs` 的 `deriveActionPerformed`/`expectedVerdict`（`report-model.mjs:52-90`）是 `verdict.mjs` 判定树的**只读复算镜像**，供报告装配的一致性自守门（护栏 #14/#15）。两处识别分支必须一字同步：改 `verdict.mjs:38` 就必须同改 `report-model.mjs:57`，否则 `layer3-wiring-coverage.golden.mjs` 的 verdict⋈axes 一致性门（C2/C2b）会 fail-closed 抛。**这是本契约耦合最紧的核心，必须由起草/实现者一手保一致，不外包。**

### 0.2 `coord_fallback` 张力（核心决策，见 GRILL D4）—— 裁判识别端 ≠ 诊断 schema

任务书要「删幽灵 `coord_fallback`（无门吐、死枚举）」。**但** `coord_fallback` 被一道**冻结的 full 车道金牌显式钉死保留**：`tests/_golden/seams-freeze-v2.golden.mjs:499` 强制 run-history 的 `locatorResolution` 枚举（`tests/_golden/schemas/run-history.schema.json:121`）须含 `coord_fallback`/`fallback_first`，理由是 codex R1-F3「可表征锁」+ R3 措辞修正——只读诊断台账须**能**如实记录「坐标/首命中兜底」这一结局，删则漏记 = 诊断层 fail-open；裁定链上另由点击身份门 → 动作轴 → `verdict.mjs` 强制 `ambiguous→NEEDS_HUMAN`，run-history 本身绝不进裁判。

故必须把「删」拆成两个互不相干的位置：

- **裁判识别端**（`verdict.mjs:38` / `report-model.mjs:57`）：`coord_fallback` 是死识别分支，随收敛一并删（识别集从 `{fallback_first, coord_fallback}` 收敛到 `{ambiguous}`）。行为中性——本就无门吐它进动作轴。**本契约在此删。**
- **run-history 诊断 schema**（`schemas/run-history.schema.json` + `bin/replay.mjs:73` 的 `RH_LR_ENUM` 透传）：`coord_fallback`/`fallback_first` 是可表征锁保留项，由 seams-freeze-v2 治理。收敛后多匹配以 `ambiguous` 流入诊断台账（`ambiguous` 本就在枚举内、校验通过），`fallback_first`/`coord_fallback` 双双变成「无门吐但可表征」——与 `coord_fallback` 一贯的地位一致。**本契约默认不动此处**（推荐默认，见 GRILL D4）；若要动须先翻 seams-freeze-v2 的 R1-F3 决定、重评审重签 seams-freeze 家族，与「可表征即 fail-safe」的理据相悖。

### 0.3 收敛字面量驱动的金牌漂移与重签

采「全收敛到 `ambiguous`」方案（GRILL D3 推荐 Option A）时，改动 emitters 与识别端会漂以下金牌，各属加严/字面量收敛的合法棘轮（护栏 #1）：

- `tests/_golden/p5-replay-coverage.golden.mjs`（注入 `fallback_first` 期望 `AMBIGUOUS_ACTION` → 改注入 `ambiguous`；注释同步）。冻它的 prd（12 个）：`prd-chiefcomplaint-smoke` / `prd-kinds-harden` / `prd-noerrenv-absence` / `prd-p3-compile` / `prd-p4-drafter` / `prd-p5-replay` / `prd-plan-debt-sweep` / `prd-replay-login-bootstrap` / `prd-replay-video` / `prd-report-fidelity` / `prd-run-history` / `prd-wf-publish-states`。
- `tests/_golden/layer3-wiring-coverage.golden.mjs`（`ambig = axStep({ action:{ resolution:'fallback_first' } })` → `'ambiguous'`；C2/C2b 一致性门文案同步）。冻它的 prd：`prd-layer3-wiring` / `prd-replay-video` / `prd-report-fidelity`。
- `tests/_golden/p3-compile.golden.mjs`（C8 `v.resolution === 'multi'` → `'ambiguous'`；:374 的 `/ambiguous|fallback_first/` 正则已含 `ambiguous`、无需改）。冻它的 prd（12 个）：`prd-caseid-echo-mask` / `prd-compile-caseid-shape` / `prd-flow-bridge` / `prd-noerrenv-absence` / `prd-output-seal` / `prd-p3-compile` / `prd-plan-debt-sweep` / `prd-replay-login-bootstrap` / `prd-wf-add-node` / `prd-wf-connect-nodes` / `prd-wf-open-node` / `prd-wf-open-smoke`。
- 新金牌 `tests/_golden/resolution.golden.mjs`（本契约的红金牌，钉 `AMBIGUOUS_ACTION`），冻进新 `loop/prd-resolution.json`。

去重后需重签的既有 prd 全集（约 18 个，凡冻上述三金牌者）见 GRILL D8。全部属「字面量收敛/加严」——gate 复跑应 GREEN（金牌已改成断言 `ambiguous`、实现已吐 `ambiguous`）。

### 0.4 不漂 / 不动清单（勘定确认）

- `tests/_golden/run-history.golden.mjs`：walk 表（`want[]`）只有 `nav`/`fill`/`click` 且 `lr ∈ {null, unique, none}`、无多匹配行；`locatorResolution` 只校验枚举成员（`ambiguous` 在枚举内）。**不漂。**
- `tests/_golden/wf-add-node.golden.mjs` C4d：断言 `ax.action.resolution === 'none'`（页面级多匹配对同刻域锁门是源域零命中）+ `v.verdict !== 'PASS'`——不钉 `fallback_first` 字面量、只注释提及。**不漂**（注释可留旧词、不改无碍）。
- `tests/_golden/p2-verdict*.golden.mjs`：注入 `unique`/`none`/`missing`，不注入多匹配字面量。**不漂**（除非把新 `AMBIGUOUS_ACTION` 钉加进 p2-verdict-coverage——本契约另起独立金牌，不并进）。
- `tests/fixtures/fake-sut/server.mjs:157` 注释「resolution=fallback_first」收敛后失准（实为 `ambiguous`）。server.mjs 被 `prd-p5-replay` 冻结——**改注释会漂 checksum**。默认不改（GRILL D8 挂账），避免为一行注释牵动 p5-replay 重签；若批量重签窗口顺带修则同签。
- `bin/replay.mjs:73` `RH_LR_ENUM`：默认不动（0.2）。
- 术语纪律：写入前 `term-lint`；英文走代码体、加粗只给中文（ADR-0004）；简体。

## 1. 改动清单

1. `CONTEXT.md`（登记 `resolution` 枚举，GRILL D5）
   - 加一行四列词条：`resolution`（动作轴解析态）——枚举 `unique`/`ambiguous`/`none`/`action_failed`/`absent`，定义各值语义，**多匹配的唯一合法字面量 = `ambiguous`**（点击身份门 count>1 的收口词）。
   - 弃用别名列**只在动作轴/裁定链语境**记 `multi`/`fallback_first` 为收敛前旧写法；`coord_fallback`/`fallback_first` 在 run-history 诊断枚举里仍合法（可表征锁）——登记须显式圈定「弃用仅限动作轴」，绝不全仓拉黑（否则 `term-lint` 会误伤冻结的 seams-freeze schema，GRILL D5）。
2. `lib/compile-atoms.mjs`（编译门收敛，4 处）
   - `resolution = ... 'multi' ...`（:264/:277/:285/:290）四处 `'multi'` → `'ambiguous'`；`:310` note 文案随之说 `ambiguous`。`absent`/`unique`/`action_failed` 不动（非本契约多匹配范畴）。
3. `lib/replay-actions.mjs`（回放通用门收敛，3 处）
   - `gateAndAct`（:209）/ `doDragTo`（:163）/ `doSelect`（:240）的 `resolution: 'fallback_first'` → `'ambiguous'`；`doOpenNode`（:133）已是 `ambiguous`、不动。行间注释「fallback_first」措辞同步为 `ambiguous`（不改动作语义）。
4. `bin/verdict.mjs`（裁判识别端收敛 + 删幽灵，:38）
   - `if (action.resolution === 'fallback_first' || action.resolution === 'coord_fallback') return 'ambiguous';` → `if (action.resolution === 'ambiguous') return 'ambiguous';`。判定树 `decide()`（:79 `ap==='ambiguous' → AMBIGUOUS_ACTION`）本体一字不动——它早就对 `'ambiguous'` 这个 ap 值出 `AMBIGUOUS_ACTION`，缺的只是识别端把 `resolution==='ambiguous'` 认成这个 ap。头注 :30 措辞同步。
5. `lib/report-model.mjs`（裁判镜像同步，:57）
   - 与第 4 步一字同步（0.1）。`expectedVerdict`（:79）本体不动。
6. `tests/_golden/resolution.golden.mjs`（新，红先行金牌，断言清单见 GOLDEN-TESTPLAN）
   - 钉：`resolution:'ambiguous'` → `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`（回归根因）；fail-safe 不破（多匹配 + 全过硬断言 / + 5xx 背书，均仍 `AMBIGUOUS_ACTION`、绝不 `PASS`/`SUT_DEFECT`）；`verdict.mjs` 与 `report-model.mjs` 双镜像同判；收敛后无门再吐 `multi`/`fallback_first` 进动作轴。
7. `loop/prd-resolution.json`（新，acceptance 门）
   - 冻 `resolution.golden.mjs` 的 sha256；`stories` 挂本契约金牌 + tier1 回归。
8. 既有金牌字面量收敛 + prd 重签（0.3、GRILL D8）
   - 改 `p5-replay-coverage` / `layer3-wiring-coverage` / `p3-compile` 三金牌的注入/断言字面量，重算 checksum，重签全部冻它们的 prd（约 18 个）。

## 2. 实现次序（红先行）

1. `contract init resolution --lane full --reason "..."`。
2. 先写新金牌 `resolution.golden.mjs`：注入 `resolution:'ambiguous'` 断言 `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`、fail-safe 三向不破、双镜像同判。跑一遍验**红基线**（现 `verdict.mjs` 不认 `ambiguous` → 出 `INDETERMINATE` → 金牌红；`resolution.golden.mjs` 未冻、`prd-resolution` 未建）。
3. 改识别端 `verdict.mjs:38` + `report-model.mjs:57`（双镜像一手同步）→ 新金牌根因项 + 双镜像项转绿。此步单独跑一遍：只改识别端、未动 emitters 时，既有 `fallback_first`/`multi` 注入的金牌会红（识别端已不认 `fallback_first`）——证明识别端与 emitters 必须同一轮收敛，不留半拉子。
4. 收敛 emitters：`compile-atoms.mjs`（`multi`→`ambiguous`）+ `replay-actions.mjs`（`fallback_first`→`ambiguous`）。
5. 同轮改既有金牌字面量（`p5-replay-coverage`/`layer3-wiring-coverage`/`p3-compile`）注入/断言 `ambiguous` → 全绿。
6. 登记 `CONTEXT.md` `resolution` 词条（过 `term-lint --registry` + 写钩）。
7. 重签受影响 prd（约 18 个）+ 新签 `prd-resolution`；`contract advance` + gate 全绿；tier1 selftest（含 `verdict-purity-guard`）无回归。

## 3. 验收（红金牌，断言清单见 GOLDEN-TESTPLAN）

- **根因回归**：`decide({action:{resolution:'ambiguous'}, postAssertions:[]})` → `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`（收敛前是 `INDETERMINATE`——红基线证）。
- **fail-safe 不破（最危险红线）**：`resolution:'ambiguous'` + 全过硬断言 + 干净取证 → 仍 `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`，**绝不 `PASS`**（证歧义短路先于 `ap===true` 的 PASS 支）；`resolution:'ambiguous'` + 本步 5xx 背书 → 仍 `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`，**绝不 `SUT_DEFECT`**（点没点对存疑，背书不翻歧义）。
- **双镜像同判**：同一批 `ambiguous` 输入喂 `verdict.mjs` 与 `report-model.mjs` 的 `expectedVerdict`，`{verdict,reason}` 全等（一致性门不 fail-closed）。
- **收敛完备**：收敛后 `compile-atoms.mjs`/`replay-actions.mjs` 全仓无 `'multi'`/`'fallback_first'` 作动作轴 `resolution` 值（emitters 只吐 `ambiguous`/`unique`/`none`/`action_failed`/`absent`）；`verdict.mjs`/`report-model.mjs` 识别端无 `coord_fallback`/`fallback_first`。
- **既有多匹配金牌收敛后仍绿**：`p5-replay-coverage`（多匹配→`AMBIGUOUS_ACTION`）/ `p3-compile` C8（多匹配拒动作 exit 65、记 `ambiguous` acted=false）/ `layer3-wiring-coverage`（C2 PASS 但 ambiguous 复算冲突 fail-closed、C2b 一致放行）字面量换 `ambiguous` 后全绿。
- **诊断台账不 fail-open**：run-history schema 仍含 `coord_fallback`/`fallback_first`（seams-freeze-v2 可表征锁不破）；多匹配以 `ambiguous` 流入 run-history、`run-history.golden` 无回归。
- **裁判零 LLM 不破**：`selftest --tier1` 的 `verdict-purity-guard` exit 0（未引入任何 LLM/网络进裁判进程）。
- **门禁**：`node loop-kit/bin/gate.mjs --prd loop/prd-resolution.json` 全 acceptance exit 0；受影响 18 prd 重签后 gate 复跑全 GREEN。

## 4. route:human 尾巴（非阻断，非本契约 hermetic 验收）

- **真机 openNode 多匹配复现**：`doOpenNode` 域内多匹配（`.lf-canvas-overlay` 内同名节点 ≥2）在真机稀有——收敛后该路应报 `AMBIGUOUS_ACTION` 而非 `INDETERMINATE`，须真机造多匹配态核验，route:human（openNode 真机保真度复核家族，压后合并跑）。hermetic 侧由合成动作轴注入 `ambiguous` 足额覆盖。
- **fake-sut 注释校准**：`server.mjs:157` 注释校准为 `ambiguous`——因牵动 `prd-p5-replay` 重签，挂账待下次批量重签窗口顺带修（GRILL D8）。

## 5. 非目标（本契约不做）

- **不动终判方向**：多匹配恒 `NEEDS_HUMAN`，只精化 reason 子类；绝不因收敛把任何多匹配翻成 `PASS`/`SUT_DEFECT`/`HARNESS_ERROR`。
- **不删 run-history 诊断 schema 的 `coord_fallback`/`fallback_first`**（可表征锁，seams-freeze-v2 治理，GRILL D4）——只删裁判识别端的死枝。
- **不收敛 `absent`(compile) vs `none`(replay) 的缺席态口径**——那是另一处相邻的编译/回放词表分裂，非本契约多匹配范畴，另案（GRILL D5 挂账）。
- **不改判定树结构**（`decide()`/`expectedVerdict()` 本体一字不动）、不引入新 reason 子类、不碰取证归因/漂移门/自愈门。
- **不引入任何 LLM/网络进裁判**（护栏 #15）、不碰 `bin/replay.mjs` 的 `RH_LR_ENUM` 与 seams-freeze 冻结面（除非 GRILL D4 翻案）。
- **不改动作门的行为**（多匹配绝不点、绝不变更 SUT，护栏 #15）——只换它吐的字面量。
