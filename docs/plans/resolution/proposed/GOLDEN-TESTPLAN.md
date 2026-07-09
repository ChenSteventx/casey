# resolution — 红先行金牌测试计划

> 起草态：本文只给断言清单与形态意图，**不写完整测试代码**（实现者据此写红金牌、验红、再实现）。
> 载体：新建 `tests/_golden/resolution.golden.mjs`（本契约的 `AMBIGUOUS_ACTION` 钉 + fail-safe 不破钉 + 双镜像同判钉），外加对三个既有金牌的字面量收敛（`p5-replay-coverage`/`layer3-wiring-coverage`/`p3-compile`，见 §涟漪）。
> 主体是**裁判纯函数注入测试**——直接 `import` `bin/verdict.mjs` 的 `decide`（或经 `verdictOf` 包装，镜像 `p5-replay-coverage` 先例）与 `lib/report-model.mjs` 的 `expectedVerdict`，构造合成 `StepAxes` 三轴，断言四态与 reason。零真机、零外部依赖、零 LLM——full 车道 hermetic 可验的支点。
> 红先行：先把断言写全 → 跑一遍确认红（现 `verdict.mjs` 不认 `resolution==='ambiguous'` → 出 `INDETERMINATE`，`AMBIGUOUS_ACTION` 断言红；`resolution.golden.mjs` 未冻、`prd-resolution` 未建）→ 再改识别端 + 收敛 emitters + 收敛既有金牌字面量。
> 不 rig：注入的是**门已解析的 `resolution` 字面量**（`ambiguous`/`unique`/…），不倒着裁定；fail-safe 钉复现 `decide()` 的短路顺序既有接缝、不手写假裁定蒙混（记忆 `dont-rig-fixtures-reproduce-frozen-seams`）。

## 现状红基线（实现前跑，应红在这些点）

- 新金牌 `import { runDoctor... }` 式引 `resolution.golden.mjs` 自身载体未建——文件先不存在。
- 关键红点：`decide({ stepId:'s1', action:{ resolution:'ambiguous' }, postAssertions:[], forensics:emptyForensics })` 现返回 `{verdict:'NEEDS_HUMAN', reason:'INDETERMINATE'}`（识别端 `verdict.mjs:38` 不认 `ambiguous`）——断言 `reason==='AMBIGUOUS_ACTION'` 红。这是根因的红证。
- 只改识别端未收敛 emitters 时：既有 `p5-replay-coverage:62`/`layer3-wiring-coverage:67` 注入 `fallback_first` 的金牌翻红（识别端已不认 `fallback_first`）——证识别端与 emitters 必须同轮收敛（红先行的中间红态）。

## 断言清单（新金牌 `resolution.golden.mjs`）

### A1 根因回归：`ambiguous` → `AMBIGUOUS_ACTION`

- 注入 `action:{ resolution:'ambiguous', candidateCount:2, identityReadback:{ ok:false } }`、`postAssertions:[]`、干净取证。
- 断言 `decide(step)` → `verdict==='NEEDS_HUMAN'` 且 `reason==='AMBIGUOUS_ACTION'`。
- 语义注释：收敛前此步落 `INDETERMINATE`（识别端丢弃 `ambiguous`），收敛后提精到 `AMBIGUOUS_ACTION`——`doOpenNode` 说的词终于被裁判听见。

### A2 fail-safe 不破 · 多匹配 + 全过硬断言 ≠ PASS（最危险红线）

- 注入 `action:{ resolution:'ambiguous' }` + `postAssertions:[{ ok:true },{ ok:true }]`（全过硬断言）+ 干净取证。
- 断言 → `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`，**断言 `verdict !== 'PASS'`** 显式钉。
- 语义：证 `decide()` 的 `ap==='ambiguous'` 短路（`verdict.mjs:79`）先于 `ap===true` 的 `hard.every(ok)→PASS`（`:84`）——点没点对存疑时，断言全过也不许判 PASS。这是本契约最容易被「优化」成假绿的方向，必须显式反证。

### A3 fail-safe 不破 · 多匹配 + 5xx 背书 ≠ SUT_DEFECT

- 注入 `action:{ resolution:'ambiguous' }` + 一条失败硬断言 + `forensics.network:[{ status:500, attributedStepId:'s1', errorEnvelope:{ ok:false } }]`（本步 5xx 背书）。
- 断言 → 仍 `NEEDS_HUMAN`/`AMBIGUOUS_ACTION`，**断言 `verdict !== 'SUT_DEFECT'`**。
- 语义：歧义短路先于 `backed→SUT_DEFECT`（`:85/:90`）——点没点对都存疑，5xx 也不足以坐实是 SUT 缺陷。

### A4 fail-safe 不破 · 多匹配 + 无硬断言仍 `AMBIGUOUS_ACTION`

- 注入 `action:{ resolution:'ambiguous' }` + `postAssertions:[]`（无硬断言）。
- 断言 → `AMBIGUOUS_ACTION`（**非** `ap===true` 无硬断言那条 `INDETERMINATE`）。
- 语义：歧义比「无断言可判」更早短路——区分 `ambiguous`（`:79`）与 `ap===true && hard.length===0`（`:83`）两条都出 `NEEDS_HUMAN` 但 reason 不同。

### A5 双镜像同判（`verdict.mjs` ⋈ `report-model.mjs`）

- 同一批 A1–A4 的合成步，分别喂 `bin/verdict.mjs` 的 `decide`（或 `verdictOf`）与 `lib/report-model.mjs` 的 `expectedVerdict`。
- 断言两者 `{verdict, reason}` 对每个步全等。
- 语义：识别端改动必须两处同步；此金牌即两处漂移的看门狗（防一致性自守门 `layer3-wiring-coverage` C2 fail-closed 或静默分叉，护栏 #14/#15）。

### A6 收敛完备 · emitters 不再吐旧字面量（源码级断言）

- 读 `lib/compile-atoms.mjs` 与 `lib/replay-actions.mjs` 源文本，断言无 `'multi'`/`'fallback_first'` 作动作轴 `resolution` 值出现（多匹配分支只吐 `'ambiguous'`）。
- 读 `bin/verdict.mjs` 与 `lib/report-model.mjs` 的 `deriveActionPerformed`，断言识别端无 `coord_fallback`/`fallback_first`（只认 `ambiguous`）。
- 语义：收敛的完备性证据——防「改了金牌注入值但漏改某扇门 emitter」的半拉子（源码文本断言是 hermetic 可测的收敛闭合锁）。注意排除注释/字符串日志里的历史提及（只扫作 `resolution` 赋值/比较的字面量），避免误伤说明性文字。

### A7 非多匹配态零回归（回归护栏）

- 注入 `unique`（+全过硬断言）→ `PASS`；`unique`+失败硬断言+本步 5xx → `SUT_DEFECT`；`none`+漂移探针命中 → `HARNESS_ERROR`；`none`+无探针 → `INDETERMINATE`；`action_failed` → `INDETERMINATE`。
- 断言各态与收敛前一致（本契约只碰多匹配识别，其余分支一字未动）——防收敛误伤别的 ap 分支。

## 涟漪：三个既有金牌的字面量收敛（同轮改、随实现转绿）

> 这些不是新断言，是把既有金牌注入/断言的多匹配旧字面量换成 `ambiguous`；换后须对新实现全绿，并重签所有冻它们的 prd（清单见 GRILL D8）。

- `tests/_golden/p5-replay-coverage.golden.mjs`：`:62` 注入 `resolution:'fallback_first'` → `'ambiguous'`；`:63`/`:7`/`:61` 注释里的 `fallback_first` 措辞同步；断言仍 `verdict==='NEEDS_HUMAN' && reason==='AMBIGUOUS_ACTION'`（不变）。
- `tests/_golden/layer3-wiring-coverage.golden.mjs`：`:67` `axStep({ action:{ resolution:'fallback_first' } })` → `'ambiguous'`；C2（PASS 但动作 ambiguous 复算冲突 → fail-closed 抛）/C2b（NEEDS_HUMAN(AMBIGUOUS_ACTION) 与 ambiguous 一致 → 放行）断言不变、只换注入字面量。
- `tests/_golden/p3-compile.golden.mjs`：C8 `:340` `v.resolution === 'multi'` → `'ambiguous'`（编译门多匹配收敛后记 `ambiguous` acted=false）；`:335` 的 exit 65（多匹配拒动作 fail-safe）不变；`:374` 的 `/ambiguous|fallback_first/` 正则已含 `ambiguous`、无需改（收敛后 note 说 `ambiguous`、仍命中）。

## 涟漪回归（金牌外，gate acceptance 覆盖）

- `node bin/casey.mjs selftest --tier1` 无回归——尤其 `verdict-purity-guard` exit 0（裁判零 LLM 不破，护栏 #15）。
- run-history 链路无回归：`run-history.golden.mjs` 全绿（walk 表无多匹配行；多匹配以 `ambiguous` 流入诊断台账、`ambiguous` 在 schema 枚举内、校验通过）。
- seams-freeze 家族无回归：`seams-freeze-v2.golden.mjs`/`seams-freeze.golden.mjs` 全绿——诊断 schema 的 `coord_fallback`/`fallback_first` 可表征锁不动（若 grill D4 判「schema 也删」则本条改为该家族重评审重签，属另开动作）。
- `CONTEXT.md` 写入过 `term-lint`（写钩 PostToolUse 扫）——`resolution` 词条的弃用别名列须圈定「仅动作轴弃用」，不误伤冻结 schema 里合法的诊断枚举值（GRILL D5）。
- 受影响约 18 个既有 prd 重签后 `gate` 复跑全 GREEN（字面量收敛属加严棘轮，行为零弱化）。
- 门禁：`node loop-kit/bin/gate.mjs --prd loop/prd-resolution.json` 全 acceptance exit 0。

## 不做（本金牌不覆盖，留 route:human）

- **真机 openNode 域内多匹配复现**：`.lf-canvas-overlay` 内同名节点 ≥2 的真机态稀有，收敛后该路报 `AMBIGUOUS_ACTION` 的真机核验是 route:human 尾巴（openNode 真机保真度家族，压后合并跑）。hermetic 侧由合成动作轴注入 `ambiguous` 足额覆盖，不造真浏览器多匹配夹具。
- **不 mock 真回放门**：金牌注入门已解析的 `resolution` 字面量即可裁判；门本身「count>1 → 吐 `ambiguous`」的行为由既有 `p3-compile` C8（编译门）与 `p5-replay`/`wf-add-node` 回放门金牌顺带覆盖，本契约不额外造多匹配浏览器夹具。
- **不动诊断 schema 的可表征锁**（除非 grill D4 翻案）——本金牌只钉裁判识别端与 emitters 的收敛，run-history schema 的删改属 seams-freeze-v2 治理面。
