# P9 · 真机 UAT 终局人签（草案，待 Steven 明签）

> 依据：`docs/plans/bootstrap/plan.md` P9 验收点「tier-2 live smoke + 真机 UAT
> 清单全 🧑 通过 = 需求完成（gate 绿 ≠ 完成）」与 ADR-0009 完成闸；形制仿
> `docs/plans/real-uat-attestation/evidence/uat-signoff.md`。
>
> 起草人：Claude（2026-07-31 凌晨）。**本文不代签。** P9 关账口径由 Steven
> 2026-07-30 裁定「不走 waiver、publish 真绿之后才关账」，签字权在他。
> 下表逐行的证据我都亲自核过（`verdict.json` 逐步裁定 + 产物清单），不是
> 转述账本。
>
> **文本状态：可签态（内容已填满，签认人与日期两栏留给 Steven 本人填）。**
> 文件名保留 `.draft` 后缀直到他真签——去后缀是签后动作，见文末。

## 〇、已到位的裁定与仍未闭合的一项

| 项 | 状态 |
|---|---|
| 抖动那轮够不够签（原第二节末尾的问句） | ✅ **Steven 2026-07-31 裁定：够签，抖动如实记账即可**——四轮全 PASS + 首末轮辅助探针 `HIDDEN_NOT_UNMOUNTED` 为采认依据；`run_final2` 明细保留在第二节不删不淡化 |
| 3.2 四态徽章覆盖洞 甲/乙 | ✅ **Steven 2026-07-31 裁定：择甲（补齐夹具）**——落地见 `D5-ACCEPTANCE-SEMANTICS-REVISION.draft.md` |
| 3.1 tier-2 A4 三项人闸的处置 | ✅ **Steven 2026-07-31 裁定：由他本人来做，P9 等做完再关账**——不走 waiver，与 07-30 关账口径一致；P9 保持 open 直到三项人闸解完且 tier-2 A4 跑绿 |

> ⚠ **签前必读一条订正**：我按纪律自己复核四组 run 的原始产物时，逮到第二节
> 原文有一句承重断言写得过强（`run_final2` 那句「其后全是级联」与「系统没有
> 假绿」）。订正已写在第二节的「订正框」里，**裁定一是对着订正前的文字给的**，
> 请复核订正后的措辞再落签。订正只让账更严，不改四轮采认的结论。

- 签认人：⬜ 待 Steven 本人填
- 时点：⬜ 待 Steven 本人填
- 采认范围：下表五行 + 第三节两项挂账的处置裁定

## 一、真机 UAT 清单逐例结论

下表「逐步裁定」与「产物」两列，起草时核过一遍，2026-07-31 落签前又由另一名
代理**独立复核一遍**（直接读 `verdict.json`／`run-history.jsonl`／`axes.json`
原始产物与 `ls` 清点，不看本表）。两次结论一致，唯一订正见第二节订正框。

| 用例 | run 目录 | 逐步裁定（实测，两次独立复核一致） | 动作层 | 产物（`ls` 实点） | 结论 |
|---|---|---|---|---|---|
| `tc_agent_id_readback_real_uat_v1` | `runs/tc_agent_id_readback_real_uat_v1/run_uat_readback_20260729_000650` | `atstep_0` PASS、`atstep_3` NEEDS_HUMAN（`INDETERMINATE`） | 4 步中 3 ok、`atstep_3` `actionError`（`res=unique`，定位到了、动作没成） | 报告 html/json/md + `axes`/`report-model`/`run-history`/`run-metrics`/`verdict`/`video.json` + 录屏 webm + **人裁记录 `human-adjudication-20260729.md`** | ⬜ 待采认（NEEDS_HUMAN 一步已有人裁记录在案） |
| `tc_catalog_wf_crud` | `runs/tc_catalog_wf_crud/run_b2_20260730` | 3 步**全 PASS** | 9/9 动作 `ok`，`locatorHitRate: 1` | 报告 html/json/md/pdf **四份齐** + 六件产物 + 录屏 webm 与 mp4 **各一** | ⬜ 待采认 |
| `tc_wf_history_version` | `runs/tc_wf_history_version/run_b2_20260730` | 7 步**全 PASS** | 13/13 动作 `ok`，`locatorHitRate: 1` | 同上齐全（含 pdf 与 mp4） | ⬜ 待采认 |
| `tc_wf_publish_states` | `runs/tc_wf_publish_states/run_final{1,3,4,5}_20260731` 四轮 | 四轮均 **6/6 全 PASS**，`intent_5` 的 `textHidden 创建时间` 逐轮 `ok:true actual:0`；同轮三条正向断言（`textVisible 保存成功`／`创建时间`／`查看`）逐轮 `ok:true actual:1` | 逐轮 12/12 动作 `ok`，`locatorHitRate: 1` | 各轮六件产物齐 + 报告 html/json/md + 录屏 webm（**无 pdf／mp4，本例未出这两件**）+ 首末轮辅助探针 `docs/plans/assert-visibility-semantics/evidence/a4-probe-{first,last}-round.json` | ⬜ 待采认（**阻塞已解除**；裁定一已定四轮够签；另一轮 `run_final2` 抖动作废，见第二节） |
| tier-2 live smoke（机器面） | ⬜ 待跑 | ⬜ | ⬜ | ⬜ | ⬜ **三项人闸未解，见 3.1** |

## 二、publish 一例的特别说明（签前必读）

该例 07-30 四轮真机（`run_baseline1/2_20260730`、`run_loadfix1/2_20260730`）
逐轮实测：**12 步动作全部 `result=ok`，唯一非 PASS 是 `atstep_11` 关闭步**
（`NEEDS_HUMAN` / `SUT_DEFECT_OR_STALE`），保存步四轮全 PASS。

真因是断言口径而非动作：真机探针实测按 Esc 前「创建时间」DOM 命中 1、可见
命中 1，按 Esc 后 **DOM 命中仍 1、可见命中 0**——浮层视觉关闭但节点不卸载，
而现役 `assert.textHidden` 数的是 DOM 命中。作者层注册表把该原子定义为
`toBeHidden`（含未挂载），**签字时的契约本来就是可见性，现行实现才是偏离**。

契约 `assert-visibility-semantics` 已修完这一处并六阶段收口（gate GREEN 3/3）。

**签这一行时必须核的两件事**（否则签的是「把动作失败洗绿」）——**两条都已兑现，
证据如下，请复核后再签**：

1. ✅ 四轮全 PASS，且 `intent_5` 的 `textHidden 创建时间` 均 `ok:true actual:0`，
   **同轮 `atstep_10` 的 `textVisible 创建时间` 均 `ok:true actual:1`**（配对成立
   才算数，理由见下方订正框）（`run_final1/3/4/5_20260731`，跑在含 codex
   Critical 修复的最终码上）；
2. ✅ 首末轮辅助探针各一次，独立浏览器会话，两次一致：
   `beforeEsc {dom:1, visible:1}` → `afterEsc {dom:1, visible:0}`，判定
   `HIDDEN_NOT_UNMOUNTED`。与「同一轮内 `textVisible 创建时间 actual:1` →
   `textHidden 创建时间 actual:0`」互为佐证：动作若没发生，可见计数不会归零。

**另有一轮必须一并看**：`run_final2_20260731` 抖动作废，没把它抹掉。逐行实测
（`run-history.jsonl` × `verdict.json` × `axes.json` 对照）：

| `stepId` | 原子 | 动作层 | 步级裁定 |
|---|---|---|---|
| `atstep_0` | `workflow.create` | `ok`（`res=null`） | PASS |
| `atstep_1`–`atstep_2` | `workflow.create` | `locatorError`（`res=none`） | 无断言步 |
| `atstep_3`–`atstep_5` | `workflow.create` | `actionError`（`res=unique`） | 无断言步 |
| `atstep_6`–`atstep_7` | `workflow.create` | `locatorError`（`res=none`） | `atstep_7` NEEDS_HUMAN / `INDETERMINATE` |
| `atstep_8` | `workflow.save` | `locatorError`（`res=none`） | NEEDS_HUMAN / `INDETERMINATE` |
| `atstep_9` | `workflow.publish` | `locatorError`（`res=none`） | NEEDS_HUMAN / `INDETERMINATE` |
| `atstep_10` | `workflow.clickEditorButton` | `locatorError`（`res=none`） | NEEDS_HUMAN / `INDETERMINATE` |
| `atstep_11` | `workflow.closeDrawer` | `ok`（`res=null`） | **PASS** |

失败点在**定位层**不在文本采集层（十步 `locatorError`／`actionError`，全部
`res=none` 或动作侧失败），与本次改动无关——这一条成立。

> **📌 订正框（2026-07-31 落签前独立复核逮到，原文两处写得过强）**
>
> 原文写「`atstep_1`/`atstep_2` 之后**全是级联**」「且系统**没有假绿**」。实测
> 两处都要收窄：
>
> 1. **不是「其后全是级联」**：`atstep_11` 动作层是 `ok`（按 Esc 本身不需要定位，
>    `res=null`），并且落了**步级 PASS**。级联断在 `atstep_10`。
> 2. **「系统没有假绿」只在 run 级成立，步级要如实记一条空过**：该轮
>    `atstep_11`（`intent_5`，恰是本契约纠偏的那一步）的
>    `textHidden 创建时间` 是 `ok:true actual:0`——**但这一过是空过**：同轮
>    `atstep_10` 的 `textVisible 创建时间` 是 `ok:false actual:0`，即浮层**从未
>    打开过**，「创建时间」本来就不可见，负向断言便平凡为真。前置从未成立，
>    这一步的 PASS 不携带任何信息。
>
> **run 级 fail-safe 没有失效**——四步落 `NEEDS_HUMAN` / `INDETERMINATE`，
> 全轮未判全绿，机器没把这轮报成通过。这一条仍然成立。
>
> **这条订正反而加固了四轮的采认判据，不是削弱**：它是一个活体反例，证明
> `textHidden actual:0` **单独一条不足以证明动作发生过**——必须跟同轮
> `textVisible actual:1` 配对看。而 `run_final1/3/4/5` 恰恰四轮都有这个配对
> （`atstep_10` `textVisible 创建时间 ok:true actual:1` → `atstep_11`
> `textHidden 创建时间 ok:true actual:0`），`run_final2` 四轮之外那一轮没有。
> 上面第 1、2 两条采认依据本来就是按「配对」写的，故结论不变。

**裁定一（Steven 2026-07-31）**：四轮够签，抖动如实记账即可。原文末尾那句
「若你认为五轮里有一轮抖动不足以签，请直说，我再补跑」已由此闭合，无须补跑。
惟该裁定是对着订正前的文字给的，落签前请复核上面的订正框。

## 三、两项挂账（须在签字时一并裁定，不许默认放过）

### 3.1 tier-2 A4 的三项人闸（我无法代跑）

`cases/tier2-suite.manifest.json` 现役成员集只有一员，跑不出 exit 0，而且
**不是工装问题**：

1. 唯一成员 `tc_agent_id_readback_real_uat_v1` 的 `preconditions` 明写真实环境
   须预置名为 `atl_同名对抗0722` 的智能体一枚；该件已在 2026-07-23 见证收尾时
   按「我建我删」清理归零——**须由人重新预置，否则本例必落非 PASS，属真机
   前置事实不是工装红**（清单原文）；
2. 清单要求的两份带外收据 `runs/_tier2/win-probe-target.result.json` 与
   `runs/_tier2/out-of-band-account-receipt.json` **两份都不存在**；
3. 另四例全在 `pendingMembers`，卡「C 轨授权」，其中三例还要每 run 逐次
   `--authorize-mutation`。

隧道本身健康（回环探针 HTTP 200、4.4 秒），不是环境问题。

**裁定（Steven 2026-07-31）：这三项由他本人来做，P9 等做完再关账。** 不走 waiver，
与他 07-30 定的关账口径一致。故 P9 在三项人闸解完且 `selftest --tier2` 跑绿之前
保持 open——本签认书其余各行可先行采认，但 P9 关账须等这一行。

### 3.2 四态徽章渲染覆盖洞（D5 修订时实测发现）—— ✅ 已裁定：甲

四态**分类**证据齐（`p2-verdict` 夹具四态全在，核过），但四态**徽章渲染**
只覆盖 `PASS` 与 `SUT_DEFECT`——`p7-report` 的夹具只有两步，`HARNESS_ERROR`
与 `NEEDS_HUMAN` 在夹具里只作汇总计数且值为 0，全仓没有任何金牌真渲染并断言
过这两态的徽章。

`NEEDS_HUMAN` 恰是 fail-safe 内核最常落的一态——publish 一例 07-30 那四轮
（`run_baseline1/2`、`run_loadfix1/2`）的关闭步逐轮落它，07-31 转绿后的四轮
才不再落它——而它的徽章从没被证过。

**裁定二（Steven 2026-07-31）：择甲，补齐夹具。** 即给 `p7-report` 的夹具加
`HARNESS_ERROR` 与 `NEEDS_HUMAN` 各一步，让四态徽章真被渲染并断言；渲染器
一行不用改（`lib/report.mjs` 四态齐全）。代价是改冻结夹具、走一次换签人签。
乙案（如实降级口径带洞关账）**未采纳**。口径文本见
`D5-ACCEPTANCE-SEMANTICS-REVISION.draft.md` 第二节③与 3.1。

甲案的落地（夹具补两步 + 换签）由**后继换签**承担，另派代理在做，不在本文
范围内；具体承接的 prd 名待其报回后回填此处。

## 四、签字栏

| 项 | 取值 |
|---|---|
| 第一节五行逐行采认 | ⬜ 待 Steven |
| 3.1 tier-2 三项人闸的处置 | ✅ **他来做，P9 等做完再关账**——Steven 2026-07-31 会话内裁定（邮件第 4 项「同意」措辞含糊，已按流程二追问一次后取得明确裁定） |
| 3.2 徽章覆盖洞 甲/乙 裁定 | ✅ **甲（补齐夹具）**——Steven 2026-07-31 会话内裁定 |
| 第二节订正框（`run_final2` 步级空过）已复核 | ⬜ 待 Steven |
| 签认人 | ⬜ 待 Steven 本人填 |
| 签认日期 | ⬜ 待 Steven 本人填 |

签后动作：本文件去掉 `.draft` 后缀、冻入 `loop/prd-p9-tier2-live-smoke.json`
的 `testChecksums` → 回填 `P9-CLOSE-LEDGER.md` → P9 关账。
