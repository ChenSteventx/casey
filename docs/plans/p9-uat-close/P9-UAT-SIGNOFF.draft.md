# P9 · 真机 UAT 终局人签（草案，待 Steven 明签）

> 依据：`docs/plans/bootstrap/plan.md` P9 验收点「tier-2 live smoke + 真机 UAT
> 清单全 🧑 通过 = 需求完成（gate 绿 ≠ 完成）」与 ADR-0009 完成闸；形制仿
> `docs/plans/real-uat-attestation/evidence/uat-signoff.md`。
>
> 起草人：Claude（2026-07-31 凌晨）。**本文不代签。** P9 关账口径由 Steven
> 2026-07-30 裁定「不走 waiver、publish 真绿之后才关账」，签字权在他。
> 下表逐行的证据我都亲自核过（`verdict.json` 逐步裁定 + 产物清单），不是
> 转述账本。

- 签认人：⬜ 待签
- 时点：⬜
- 采认范围：下表五行 + 第三节两项挂账的处置裁定

## 一、真机 UAT 清单逐例结论

| 用例 | run 目录 | 逐步裁定（我实测） | 产物 | 结论 |
|---|---|---|---|---|
| `tc_agent_id_readback_real_uat_v1` | `runs/tc_agent_id_readback_real_uat_v1/run_uat_readback_20260729_000650` | `atstep_0` PASS、`atstep_3` NEEDS_HUMAN（`INDETERMINATE`） | 报告 html/json/md + `axes`/`verdict`/`run-history`/`run-metrics` + 录屏 webm + **人裁记录 `human-adjudication-20260729.md`** | ⬜ 待采认（NEEDS_HUMAN 一步已有人裁记录在案） |
| `tc_catalog_wf_crud` | `runs/tc_catalog_wf_crud/run_b2_20260730` | 3 步**全 PASS** | 报告 html/json/md/pdf 四份齐 + 六件产物 + 录屏 webm 与 mp4 各一 | ⬜ 待采认 |
| `tc_wf_history_version` | `runs/tc_wf_history_version/run_b2_20260730` | 7 步**全 PASS** | 同上齐全 | ⬜ 待采认 |
| `tc_wf_publish_states` | `runs/tc_wf_publish_states/run_final{1,3,4,5}_20260731` 四轮 | 四轮均 **6/6 全 PASS**，`textHidden 创建时间` 逐轮 `ok:true actual:0`；同轮三条正向断言逐轮 `ok:true actual:1` | 各轮六件产物齐 + 首末轮辅助探针 `docs/plans/assert-visibility-semantics/evidence/a4-probe-{first,last}-round.json` | ⬜ 待采认（**阻塞已解除**；另有一轮 `run_final2` 抖动作废，见第二节） |
| tier-2 live smoke（机器面） | ⬜ 待跑 | ⬜ | ⬜ | ⬜ **三项人闸未解，见第三节** |

## 二、publish 一例的特别说明（签前必读）

该例 07-30 四轮真机（`run_baseline1/2_20260730`、`run_loadfix1/2_20260730`）
逐轮实测：**12 步动作全部 `result=ok`，唯一非 PASS 是 `atstep_11` 关闭步**
（`NEEDS_HUMAN` / `SUT_DEFECT_OR_STALE`），保存步四轮全 PASS。

真因是断言口径而非动作：真机探针实测按 Esc 前「创建时间」DOM 命中 1、可见
命中 1，按 Esc 后 **DOM 命中仍 1、可见命中 0**——浮层视觉关闭但节点不卸载，
而现役 `assert.textHidden` 数的是 DOM 命中。作者层注册表把该原子定义为
`toBeHidden`（含未挂载），**签字时的契约本来就是可见性，现行实现才是偏离**。

契约 `assert-visibility-semantics` 正在修这一处。

**签这一行时必须核的两件事**（否则签的是「把动作失败洗绿」）——**两条都已兑现，
证据如下，请复核后再签**：

1. ✅ 四轮全 PASS，且 `intent_5` 的 `textHidden 创建时间` 均 `ok:true actual:0`
   （`run_final1/3/4/5_20260731`，跑在含 codex Critical 修复的最终码上）；
2. ✅ 首末轮辅助探针各一次，独立浏览器会话，两次一致：
   `beforeEsc {dom:1, visible:1}` → `afterEsc {dom:1, visible:0}`，判定
   `HIDDEN_NOT_UNMOUNTED`。与「同一轮内 `textVisible 创建时间 actual:1` →
   `textHidden 创建时间 actual:0`」互为佐证：动作若没发生，可见计数不会归零。

**另有一轮必须一并看**：`run_final2_20260731` 抖动作废，我没把它抹掉。它在
`atstep_1`/`atstep_2` 就 `locatorError`（`res=none`）、其后全是级联，失败点在
**定位层**不在文本采集层，与本次改动无关；且系统没有假绿，落 `NEEDS_HUMAN` /
`INDETERMINATE`。若你认为「五轮里有一轮抖动」不足以签，请直说，我再补跑。

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

### 3.2 四态徽章渲染覆盖洞（D5 修订时实测发现）

四态**分类**证据齐（`p2-verdict` 夹具四态全在，我核过），但四态**徽章渲染**
只覆盖 `PASS` 与 `SUT_DEFECT`——`p7-report` 的夹具只有两步，`HARNESS_ERROR`
与 `NEEDS_HUMAN` 在夹具里只作汇总计数且值为 0，全仓没有任何金牌真渲染并断言
过这两态的徽章。详见 `D5-ACCEPTANCE-SEMANTICS-REVISION.draft.md` 第二节③的
甲（补齐夹具，需一次换签）/ 乙（如实降级口径，带洞关账）两案。

`NEEDS_HUMAN` 恰是 fail-safe 内核最常落的一态（publish 四轮真机全落它），
它的徽章没被证过。**建议择甲。**

## 四、签字栏

| 项 | 取值 |
|---|---|
| 第一节五行逐行采认 | ⬜ |
| 3.1 tier-2 三项人闸的处置（现在解 / 明确 waiver / 保持 P9 open） | ⬜ |
| 3.2 徽章覆盖洞 甲/乙 裁定 | ⬜ |
| 签认人 | ⬜ |
| 签认日期 | ⬜ |

签后动作：本文件去掉 `.draft` 后缀、冻入 `loop/prd-p9-tier2-live-smoke.json`
的 `testChecksums` → 回填 `P9-CLOSE-LEDGER.md` → P9 关账。
