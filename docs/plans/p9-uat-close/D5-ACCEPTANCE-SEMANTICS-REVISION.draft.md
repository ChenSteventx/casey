# D5 · P9 验收口径修订（草案，待 Steven 明签）

> 依据：`docs/plans/p9-tier2-live-smoke/GRILL.md` D5（v2 补全，**须 Steven 明签
> 不代签**）。本文是给 Steven 签的**草案**，不是已生效修订——签字前
> `docs/plans/bootstrap/plan.md`、`CONTEXT.md`、`README.md` 三处一字未动。
>
> 起草人：Claude（2026-07-31 凌晨，Steven 睡前授权自行推进 P9 期间）。
> **本文不代签**：D5 在契约里明写「须 Steven 明签不代签」，故此处只备好文本与
> 证据，签与不签、改不改文本，都由 Steven 定。

## 一、要修的是什么（事实，我逐条实测过）

`docs/plans/bootstrap/plan.md` 的 P9 段这样描述 tier-1：

> **tier-1** hermetic：`data:` URL 假 SUT，只验**编译→spec→确定性回放→报告**
> 管线 + 给分类器喂**合成 actionPerformed/postAssertions/forensics 四元组**
> 逐一触发 4 态，证 §4.2 树与徽章。零外部依赖。

验收点写的是：`node bin/casey.mjs selftest --tier1` 全链路 exit 0，**4 态徽章
全覆盖**。

**实现不是这样。** `bin/casey.mjs:180-230` 的 `selftestTier1()` 实际只做五步：

| # | 实际检查 | 落点 |
|---|---|---|
| 1 | 统一语言注册表完整（白名单方向） | `term-lint --registry` exit 0 |
| 2 | 弃用别名被拦红（黑名单方向，证机制真有牙） | `term-lint --file` exit 1 |
| 3 | 熔断器可清零 | `breaker --reset` exit 0 |
| 4 | 质量门禁消费单 story 契约并翻绿 | `gate` exit 0 且 `passes` 翻 `true` |
| 5 | 裁判零 LLM（护栏 #15） | `verdict-purity-guard` exit 0 |

**没有假 SUT 管线，没有喂四元组，没有徽章。** 它证的是「确定性内核 + 统一语言
双向有效」，不是「编译到报告的管线跑通」。

## 二、三层证据分别交代（GRILL D5 要求的形制）

### ① 管线义务处置：明记 waiver + 替代证据，不许只删

「`data:` URL 假 SUT 验编译→spec→回放→报告管线」这条义务**tier-1 没有兑现**，
且我不建议现在往 tier-1 里塞——tier-1 的价值恰恰在「零外部依赖、npm install
前即可跑」，而管线端到端要 chromium。

替代证据（各自独立可跑，不占 tier-1 的零依赖属性）：

- `node bin/casey.mjs demo` —— 零真机零凭据出一份自包含 `PASS` 报告（含裁定
  徽章），落 `runs/sample-wf-publish/`；**需 chromium，不是零依赖**（README:37-38
  已如实标注两者区别）；
- 管线分段金牌：`p3-compile`（编译）、`p5-replay`（确定性回放）、
  `p7-report`（报告渲染）各自冻结。

**建议口径**：把 bootstrap plan 里 tier-1 的管线义务改成「由 `demo` 子命令 +
分段金牌承担，tier-1 保持零依赖只验确定性内核」，并在原处**留一行 waiver 记号**
说明这是有意为之而非漏做。

### ② 四态分类证据 = `p2-verdict` 金牌 —— ✅ 成立，我核过

`tests/_golden/p2-verdict.golden.mjs` 喂合成三轴、逐 case 验四态；其夹具
`tests/_golden/fixtures/p2/verdict-cases.json` 实测**四态齐全**：
`HARNESS_ERROR`、`NEEDS_HUMAN`、`PASS`、`SUT_DEFECT`。

该金牌只核 `verdict.json` 的四态，**不核徽章**——这正是 D5 当初要拆三层的原因。

### ③ 徽章渲染证据 = `p7-report` 金牌 —— ⚠ **只成立一半，这是本次实测新逮到的缺口**

`tests/_golden/p7-report.golden.mjs` 确实逐步校「多态裁定徽章正确」
（`:73`、`:79-81`：该步态名必须在其片段内出现）。**但它的夹具只有两步、只覆盖
两态**：

- `tests/_golden/fixtures/seams/report-model.fixture.json` 实测步级 `verdict`
  取值集合 = {`PASS`, `SUT_DEFECT`}；
- 该夹具里 `HARNESS_ERROR` 与 `NEEDS_HUMAN` 只作为汇总**计数出现且值为 0**
  （`:13-14`），没有任何一步真是这两态；
- 另一枚碰徽章的 `casey-demo.golden.mjs:62-65` 只钉了 `class="badge pass"` 与
  「通过」，同样不覆盖那两态。

**结论：`HARNESS_ERROR` 与 `NEEDS_HUMAN` 两态的徽章渲染，全仓没有任何金牌
证过。** 所以 bootstrap plan 验收点那句「4 态徽章全覆盖」，无论挂在 tier-1
还是挂在 `p7-report` 上，**现在都不成立**。

**这条不许含糊过去。** 两个处置选项，请 Steven 择一：

- **甲（补齐）**：给 `p7-report` 的夹具加两步（`HARNESS_ERROR` 一步、
  `NEEDS_HUMAN` 一步），让四态徽章真被渲染并断言。代价：改冻结夹具 → 换签
  `p7-report` 所在 prd；工作量小（夹具加两步 + 断言天然覆盖，渲染器可能一行
  不用改），但要走一次换签人签。
- **乙（如实降级口径）**：把「4 态徽章全覆盖」改成「四态**分类**全覆盖
  （`p2-verdict`）+ 徽章渲染覆盖 `PASS`/`SUT_DEFECT` 两态（`p7-report`）」，
  另两态徽章**挂账**待补。代价：零，但 P9 带着一个已知覆盖洞关账。

我的推荐是**甲**：这个洞小、补起来便宜，而且 `NEEDS_HUMAN` 恰恰是 fail-safe
内核最常落的那一态（publish 四轮真机全落它）——它的徽章没被证过，是真的不该
带进 P9 关账。但这要多花一次人签往返，所以最终由 Steven 定。

## 三、三处文本的具体改法（签后再落，现在一字未动）

### 3.1 `docs/plans/bootstrap/plan.md`（P9 段）

原文：

> - **tier-1** hermetic：`data:` URL 假 SUT，只验**编译→spec→确定性回放→报告**管线 + 给分类器喂**合成 actionPerformed/postAssertions/forensics 四元组**逐一触发 4 态，证 §4.2 树与徽章。零外部依赖。

拟改为：

> - **tier-1** hermetic：零外部依赖的**确定性内核自检**——统一语言注册表白名单
>   与弃用别名黑名单双向有效、熔断器可清零、质量门禁消费可执行规格并翻绿、
>   裁判零 LLM（护栏 #15）。
>   *（口径修订 2026-XX-XX，Steven 签）：原写「`data:` URL 假 SUT 验编译→回放→
>   报告管线 + 喂四元组触发 4 态证徽章」，实现未纳入且不宜纳入——tier-1 的价值
>   在零依赖，管线端到端需 chromium。该义务改由 `casey demo` 子命令（含徽章的
>   自包含报告，需 chromium）与分段金牌 `p3-compile`/`p5-replay`/`p7-report`
>   承担，此处**明记 waiver 而非删除义务**。*

验收点原文：

> - [命令] `node bin/casey.mjs selftest --tier1` 全链路 exit 0，4 态徽章全覆盖。

拟改为（**此句的最终措辞取决于第二节③的甲/乙裁定**）：

> - [命令] `node bin/casey.mjs selftest --tier1` 全链路 exit 0（确定性内核五项）。
> - [金牌] 四态**分类**全覆盖 = `tests/_golden/p2-verdict.golden.mjs`（夹具四态齐）。
> - [金牌] 四态**徽章渲染** = `tests/_golden/p7-report.golden.mjs`。
>   〔甲案措辞〕夹具补齐四态后全覆盖。
>   〔乙案措辞〕现覆盖 `PASS`/`SUT_DEFECT` 两态；`HARNESS_ERROR`/`NEEDS_HUMAN`
>   徽章渲染**挂账待补**，P9 带此已知洞关账。

### 3.2 `CONTEXT.md:157-158`（tier-1 / tier-2 两层定义）

`tier-1` 现行释义：

> hermetic 自检：假 SUT、零外部依赖，验编译→回放→报告管线 + 给分类器喂合成四元组逐一触发四态

拟改为：

> hermetic 自检：零外部依赖，验确定性内核（统一语言双向 + 熔断器 + 质量门禁翻绿 + 裁判零 LLM）；管线与四态徽章由 `demo` 与分段金牌承担（口径修订见 P9 关账账本）

`tier-2` 释义不动。

### 3.3 `README.md:33-38`

第 33 行现写「**机制自检**（零外部依赖，npm install 前即可跑）」——**这句本来
就是对的**，README 是三处里唯一没说错的。第 37-38 行已如实标注 `demo` 与
`selftest --tier1` 的区别（demo 需 chromium、不是零依赖）。

拟改：只在第 33 行的括号后补一句「验确定性内核五项，不含管线端到端」，让读者
不必翻计划才知道它到底验了什么。**其余不动。**

## 四、签字栏

| 项 | 取值 |
|---|---|
| 第二节③ 甲/乙裁定 | ⬜ 待 Steven 择一 |
| 三处文本修订 | ⬜ 待 Steven 明签（D5 明写不代签） |
| 签认人 | ⬜ |
| 签认日期 | ⬜ |

签后动作：按裁定落三处文本 → 若择甲则另起换签走 `p7-report` 夹具补两态 →
回填 `docs/plans/p9-uat-close/P9-CLOSE-LEDGER.md` 的 A5 行。
