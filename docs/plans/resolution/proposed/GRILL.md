# resolution — grill 决策记录（多匹配 `resolution` 词表统一，full）

> 起草态（零-baton）：本文只落决策，未 `contract init`、未改 `lib`/`bin`/`tests`/`mcp`、未 gate、未提交。授权链待 Steven grill 签核。
> 事实源：`docs/HANDOFF.md` 2026-07-08 快照第 34 行「挂账另立 full 契约（触裁判内核，DDD 视角揪出）」；裁判现状 `bin/verdict.mjs`、镜像 `lib/report-model.mjs`、三门 emitters `lib/compile-atoms.mjs`/`lib/replay-actions.mjs`；护栏 #14/#15/#17；`CONTEXT.md` 已登记的 `AMBIGUOUS_ACTION`（:75）与点击身份门（:78）。

## 背景

DDD 视角揪出的裁判内核词表分裂：多匹配（点没点对存疑）这一件事，三扇门三个字面量——编译门 `multi`、回放通用门 `fallback_first`、回放 `doOpenNode` 门 `ambiguous`。而裁判 `verdict.mjs:38` 只把 `fallback_first`/`coord_fallback` 认成歧义，不认 `ambiguous`——于是第一个说出 CONTEXT 登记词 `ambiguous` 的 `doOpenNode` 门反被裁判丢弃，多匹配 reason 从精确的 `AMBIGUOUS_ACTION` 掉回泛化 `INDETERMINATE`。同时 `coord_fallback` 在裁判识别端是无门吐的死枝。

目标：把裁判链（点击身份门 → 动作轴 `resolution` → `verdict.mjs`）上的多匹配字面量收敛到 CONTEXT 登记词 `ambiguous`，裁判与 `report-model.mjs` 认它，删裁判识别端幽灵 `coord_fallback`，补金牌钉 `AMBIGUOUS_ACTION`。**fail-safe 现不破、改后也不破**：多匹配恒 `NEEDS_HUMAN`，仅 `doOpenNode` 一路的子类由 `INDETERMINATE` 提精到 `AMBIGUOUS_ACTION`。

## D1 车道：full

- 定夺：full（HANDOFF 明标「触裁判内核」）。三条判据全中：① 直接改 `bin/verdict.mjs`（零 LLM 裁判内核）的 `deriveActionPerformed`——动内核须 full；② 碰 fail-safe 红线（护栏 #14）——多匹配终判不得因收敛松动，值一道红先行金牌把「仍 `NEEDS_HUMAN`、绝不 `PASS`」钉死；③ 涟漪面宽（约 18 个既有 prd 因金牌字面量收敛重签），须逐一勘定重签、只加严不放松。
- 不选 light：这不止「加一道 fail-closed 分支」，而是改裁判识别语义 + 双镜像同步 + 跨编译/回放两门字面量收敛 + 宽涟漪重签，够 full。
- 实现者动 `lib`/`bin`/`tests/_golden` 前须先 `casey contract init resolution --lane full`；本起草文档只读+写自身，未 `contract init`。

## D2 根因与词表现状（吃准再动）

现状三门 emitters（多匹配分支）：

| 门 | 位置 | 多匹配吐的 `resolution` |
| --- | --- | --- |
| 编译门 | `compile-atoms.mjs:264/277/285/290` | `multi` |
| 回放通用门 | `replay-actions.mjs:163`(`doDragTo`)/`:209`(`gateAndAct`)/`:240`(`doSelect`) | `fallback_first` |
| 回放 openNode 门 | `replay-actions.mjs:133`(`doOpenNode`) | `ambiguous` |

裁判识别端 `verdict.mjs:38`：认 `{fallback_first, coord_fallback}` → ap `'ambiguous'`；判定树 `decide():79` 对 ap `'ambiguous'` 出 `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`。**缺口**：`resolution==='ambiguous'`（openNode 吐的）与 `resolution==='multi'`（compile 吐的）都不在识别集里 → 落 `return false`（`:40`）→ ap `false` → fail-safe `INDETERMINATE`。`coord_fallback` 在识别集里但**全仓无门吐它**（grep 确证）= 死枝。

镜像 `report-model.mjs:52-90` 与 `verdict.mjs` 判定树逐分支同构，供报告装配一致性自守门（护栏 #14/#15）——改一个必须同改另一个。

## D3 收敛方向（核心决策，推荐 Option A）

**Option A（全收敛到 `ambiguous`，推荐、任务/HANDOFF 所定）**：emitters 三门多匹配全吐 `ambiguous`（compile `multi`→`ambiguous`、replay `fallback_first`→`ambiguous`、openNode 不变）；识别端只认 `ambiguous`、删 `fallback_first`/`coord_fallback` 死枝。
- 利：DDD 词表真统一——一件事一个词；`AMBIGUOUS_ACTION` 与动作轴 `ambiguous` 与 CONTEXT 登记词三处同源；裁判识别集从两枚字面量瘦成一枚。
- 弊：涟漪最宽——`p3-compile`（C8 `=== 'multi'`）+ `p5-replay-coverage`（注入 `fallback_first`）+ `layer3-wiring-coverage`（注入 `fallback_first`）三金牌改字面量、约 18 个 prd 重签。但全属加严/字面量收敛（护栏 #1 合法棘轮），行为零弱化，gate 复跑应 GREEN。

**Option B（识别端多认，不动 emitters，小涟漪备选）**：`verdict.mjs`/`report-model.mjs` 识别集扩成 `{ambiguous, fallback_first, multi}`（保 `coord_fallback` 或删）。
- 利：不动 emitters、不动 fake-sut、`p3-compile:340` 不漂——涟漪最小（只加新金牌 + 双镜像同步）。
- 弊：词表仍三门分裂——违「统一多匹配字面量口径 → 收敛」（任务 item 4）；裁判识别集反而更胖。治标不治本。

**倾向 Option A**（任务硬性要「收敛」，且 DDD 统一是本契约的立契理由）。宽涟漪是一次性重签、非重复成本，且都在加严方向。**留给 Steven 拍**：接受 Option A 的 18-prd 重签，还是先 Option B 止血、词表统一挂账续做。

## D4 `coord_fallback` 张力（最关键决策）—— 裁判识别端删、诊断 schema 不删

任务书 item 3 要「删幽灵 `coord_fallback`（无门吐、死枚举）」。勘定发现它被一道**冻结的 full 车道金牌显式钉死保留**：

- `tests/_golden/seams-freeze-v2.golden.mjs:499` 强制 `schemas/run-history.schema.json` 的 `locatorResolution` 枚举须含 `coord_fallback`/`fallback_first`，理据（codex R1-F3「可表征锁」+ R3 措辞修正）原文钉在金牌里：「坐标/首命中兜底这一结局须能被只读台账如实记录、删则漏记 = 诊断层 fail-open；裁定链上由点击身份门 → StepAxes → verdict.mjs 强制 ambiguous→NEEDS_HUMAN，run-history 本身绝不进裁判」。

所以「幽灵」在两个不同位置有两种性质，必须分开处置：

- **裁判识别端**（`verdict.mjs:38` / `report-model.mjs:57`）：`coord_fallback` 是死识别分支——本就无门吐它进动作轴，删它行为中性。Option A 收敛时它随 `fallback_first` 一并从识别集消失。**此处删——名副其实的删幽灵。**
- **run-history 诊断 schema**（`schemas/run-history.schema.json` + `bin/replay.mjs:73` `RH_LR_ENUM`）：`coord_fallback`/`fallback_first` 是 seams-freeze-v2 的可表征锁保留项，删则翻 codex R1-F3 决定、与「可表征即 fail-safe」理据相悖、须重评审重签 seams-freeze 家族。**默认不删**（推荐）。收敛后多匹配以 `ambiguous` 流入诊断台账，`fallback_first`/`coord_fallback` 双双成「无门吐但可表征」——与 `coord_fallback` 一贯地位一致，诊断层不 fail-open。

**推荐**：把任务 item 3 的「删幽灵」精确落在裁判识别端；run-history 诊断 schema 的两枚可表征锁保留。**留给 Steven 拍**：认可这个「识别端删、schema 留」的拆分，还是坚持连诊断 schema 也删（那要另开一轮 seams-freeze-v2 翻案 + 重评审）。这是本契约与既有冻结决策的唯一硬碰撞点、grill 必须收口。

## D5 `CONTEXT.md` `resolution` 枚举登记方案

- 加一行四列词条（对齐既有裁判术语一族的四列制）：
  - 概念：`resolution`（动作轴解析态）
  - 中文名：定位解析态
  - 定义：点击身份门为每个动作步吐的解析结果，枚举 `unique`（唯一命中，可动作）/ `ambiguous`（多匹配，点没点对存疑、绝不变更 SUT）/ `none`（录制 locator 全失配，走漂移探针）/ `action_failed`（唯一但动作抛错）/ `absent`（编译期候选零命中）；`verdict.mjs` 据此推 `actionPerformed`。**多匹配的唯一合法字面量 = `ambiguous`**。
  - 弃用别名：`multi`/`fallback_first`（收敛前多匹配旧写法，**仅动作轴/裁定链语境弃用**）。
- **登记纪律要点（防 term-lint 误伤）**：`coord_fallback`/`fallback_first` 在 run-history 诊断 `locatorResolution` 枚举里仍合法（D4 可表征锁）。故弃用别名列须显式圈定「弃用仅限动作轴 `resolution`」，**绝不把它们登成全仓黑名单**——否则写钩的 `term-lint` 会扫红冻结的 `seams-freeze-v2.golden.mjs`/`run-history.schema.json`。登记措辞由 grill 定死这条边界。
- 挂账（非本契约）：`absent`(compile) vs `none`(replay) 是相邻的缺席态口径分裂，非多匹配范畴，本契约不收敛、记 observability 另案。

## D6 fail-safe 不破怎么在 golden 钉死（本契约最危险红线）

判定树 `decide()`（`verdict.mjs:74`）里 `ap==='ambiguous'` 的短路（`:79`）先于 `ap===true` 的 PASS 支（`:84`）与 `backed→SUT_DEFECT`（`:85/:90`）。收敛只改「谁被认成 ap `'ambiguous'`」，不改这个短路顺序。golden 三向钉死：

- 多匹配 + **全过硬断言** + 干净取证 → 仍 `AMBIGUOUS_ACTION`，绝不 `PASS`（证歧义短路先于 PASS——最危险的假绿方向）。
- 多匹配 + **本步 5xx/pageerror 背书** → 仍 `AMBIGUOUS_ACTION`，绝不 `SUT_DEFECT`（点没点对存疑，取证不翻歧义）。
- 多匹配 + 无硬断言 → 仍 `AMBIGUOUS_ACTION`（区别于 `ap===true` 无硬断言的 `INDETERMINATE`——歧义比「没断言」更早短路）。

红基线：实现前注入 `resolution:'ambiguous'` 现出 `INDETERMINATE`（识别端不认）→ 断言 `AMBIGUOUS_ACTION` 的金牌先红，改识别端后转绿。

## D7 判定树双镜像一致性

- `report-model.mjs` 的 `deriveActionPerformed`/`expectedVerdict` 是 `verdict.mjs` 的只读复算镜像（源真理在裁判进程），供报告装配一致性自守门（`layer3-wiring-coverage` C2/C2b，护栏 #14/#15）。
- 改识别端必须两处一字同步；金牌须用同一批 `ambiguous` 输入喂两个 `expectedVerdict` 断言 `{verdict,reason}` 全等——防两处漂移导致一致性门 fail-closed 或（更糟）静默分叉。
- 这是本契约耦合最紧处，由实现者一手保一致、不外包子代理（记忆 `prefer-subagent-fanout`：耦合核心自己保一致）。

## D8 涟漪勘定与重签清单

Option A 下漂移的既有金牌与需重签 prd（去重）：

- 金牌改字面量：`p5-replay-coverage.golden.mjs`（`fallback_first`→`ambiguous`）/ `layer3-wiring-coverage.golden.mjs`（`fallback_first`→`ambiguous`）/ `p3-compile.golden.mjs`（C8 `multi`→`ambiguous`）。
- 需重签 prd（凡冻上述三金牌者，约 18 个）：`prd-chiefcomplaint-smoke`、`prd-kinds-harden`、`prd-noerrenv-absence`、`prd-p3-compile`、`prd-p4-drafter`、`prd-p5-replay`、`prd-plan-debt-sweep`、`prd-replay-login-bootstrap`、`prd-replay-video`、`prd-report-fidelity`、`prd-run-history`、`prd-wf-publish-states`、`prd-layer3-wiring`、`prd-caseid-echo-mask`、`prd-compile-caseid-shape`、`prd-flow-bridge`、`prd-output-seal`、`prd-wf-add-node`、`prd-wf-connect-nodes`、`prd-wf-open-node`、`prd-wf-open-smoke`。（实现者以 `grep -l` 冻结引用为准复核，别照抄——名单是勘定值、须现场核对。）
- 新签：`prd-resolution`（冻新 `resolution.golden.mjs`）。
- 挂账不改（避额外重签）：`tests/fixtures/fake-sut/server.mjs:157` 注释（冻在 `prd-p5-replay`）；`bin/replay.mjs:73` `RH_LR_ENUM`（D4 保留）。
- 不漂确认：`run-history.golden.mjs`（walk 表无多匹配行、只校枚举成员）；`wf-add-node.golden.mjs` C4d（断言 `none`/`verdict!==PASS`、不钉 `fallback_first` 字面量）；`p2-verdict*.golden.mjs`（不注入多匹配字面量）。

## D9 非目标（本契约不做）

- 不动终判方向（多匹配恒 `NEEDS_HUMAN`）；不新增 reason 子类；不改 `decide()`/`expectedVerdict()` 结构。
- 不删 run-history 诊断 schema 的 `coord_fallback`/`fallback_first`（可表征锁，D4）——除非 grill 明确翻 seams-freeze-v2。
- 不收敛 `absent`/`none` 缺席态（相邻词表分裂，另案，D5 挂账）。
- 不引 LLM/网络进裁判（护栏 #15）；不碰取证归因/漂移门/自愈门。
- 不改动作门行为（多匹配绝不点、绝不变更 SUT）——只换字面量。
