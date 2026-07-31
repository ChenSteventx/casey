# 空心验收审计清单 —— b3bee6b 隔离重裁影响面（冻结件）

> 契约 `hollow-acceptance-audit-and-gate-nails`（lane=light）。顾问 `gpt-5.6-sol` max 推荐顺序的
> **第一步，且只做第一步**：冻结事实 + 补门禁反例钉。**零处置**——本步没动任何 story 的验收、
> 没改任何 `passes`、没处置任何 prd。机读件是同目录 `hollow-acceptance-audit.json`（76 行全字段），
> 本文是它的人读投影 + 分歧记录。

## 取数口径（自取，未抄顾问）

`git show b3bee6b^:loop/prd-*.json` 与工作树当前值逐 story 比对；隔离件闭集取
`tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json` 的 `sourceGolden` 去重（27 枚）。
`obligationMix` 按该 story 被删掉的隔离件逐件在同一账里汇总，取不到才写「未取到」——本轮 **63 条全部取到真值，0 条未取到**。

## 独立复算的计数

| 项 | 实测 | 与顾问/上游转述 |
|---|---|---|
| `b3bee6b^` → `b3bee6b` 影响 story 数 | 63 | 一致 |
| 同上，删除的隔离件验收引用数 | 168 | 一致 |
| 同上，**新增**的隔离件验收引用数 | 0 | 顾问未给，本轮补 |
| `b3bee6b` → `HEAD` 两端同在 story 的隔离件引用净变化 | 0 | 顾问未给，本轮补 |
| 当前 `passes` 为真 | 51 | 一致 |
| 当前 `passes` 为假 | 12 | 一致 |
| 合法 tier1 白名单（`b3bee6b` 未触碰） | 13 | 一致，且逐条实测前后逐字节相同 |
| 原子义务总数 / `retain-isolated` / `survive-unit` / `superseded` / `retire` | 349 / 239 / 99 / 11 / 0 | 一致 |
| 隔离账 `coverageRelation`：`uncertain` / `partial` | 233 / 6 | 一致 |
| 27 枚源件中同时含 `retain-isolated` 与 `survive-unit` 的 | 21 | 一致 |
| 19 条 tier1 空心里，源件同时含两种生命周期的 | 16 | 一致，例外恰是顾问点名的三条 |

## 分类计数

| category | `passes=true` | `passes=false` | 小计 |
|---|---|---|---|
| `tier1-hollow` | 19 | 1 | 20 |
| `flow-bridge-insufficient` | 9 | 0 | 9 |
| `mixed` | 23 | 11 | 34 |
| `legitimate-tier1` | 13 | 0 | 13 |
| **合计** | **51** | **12** | **76** |

51 = 19 + 9 + 23。63 条影响面 = 51 真 + 12 假；白名单 13 条不在影响面内，收进来是为了防将来加判据时误伤。

## 与顾问结论的分歧

### 分歧一（唯一实质分歧）：`flow-bridge-insufficient` 是 9 条不是 6 条

顾问给 6 条。按**机械判据**（被 `b3bee6b` 删过隔离件，且当前验收除 `tier1` 外只剩
`flow-bridge.golden.mjs`）实测是 **9** 条——多出的三条顾问归进了它的 26 条 `mixed` 名单：

| story | 当前验收面 | 删掉的隔离件 |
|---|---|---|
| `ingest#s2-ripple-locks` | 只剩 `flow-bridge` | `chiefcomplaint-smoke`、`wf-publish-states`、`wf-history-version` |
| `wf-open-smoke#s2-ripple-flip-and-locks` | 只剩 `flow-bridge` | `p3-compile`、`p5-replay`、`e2e-chain` |
| `replay-nth-visible-hardening#s2-resign-and-regression` | `flow-bridge` + `tier1` | 8 枚 |

分歧根因：顾问那 6 条用的判据是「story 描述明确承诺浏览器端到端」，是语义判读；这三条的描述是
「涟漪回归锁 / 重签后消费者金牌复跑零行为差」，不直接自称端到端，所以被它归进 `mixed`。
但按顾问自己给 `mixed` 的定义（「保有至少一条**表面相关**的残余验收」），`flow-bridge` 一条独撑的
残余面与那 6 条同形，同一形态归两类不自洽。

**本清单以机械判据为准**，理由：语义判读不可复算，将来加门禁判据时无法据以自动豁免或拦截；
而这三条的实质风险与那 6 条完全一样——它们被删掉的正是「复跑零行为差」这条义务所指的消费者金牌本身，
只剩 `flow-bridge` 一条时，那条义务已无从证明。顾问的语义归类逐条记进对应行的 `note`，不抹掉。

注意 `replay-nth-visible-hardening#s2` 严格说连顾问自己的 (b) 条件（「只剩 `flow-bridge`」）都不满足——
它还留着 `tier1`。这条无论按哪套判据都不该在 `mixed` 里。

### 分歧二（措辞而非事实）：顾问「51 true ＝ 19 + 6 + 26」的加法

顾问的 19 + 6 + 26 = 51 成立，本轮的 19 + 9 + 23 = 51 也成立，两者是同一集合的两种切分，
总数与成员完全一致，只有那三条的归属不同。不存在漏项或多项。

### 逐项吻合的部分（已独立复算，非照抄）

顾问的 19 条 tier1 空心名单（含它补的两条 `resign-and-regression`）、13 条合法 tier1 白名单、
26 条 `mixed` 的成员集合（减去上述三条即本轮 23 条）、`replay-login-bootstrap` 8 条全 `retain-isolated`
且 3 条 `judgmentCanRunZeroSut` 为真、`run-convention` 9 条中 4 条为真、`video-login-carry` 5 条全依赖
SUT 或浏览器、27 枚里 21 枚是混合体——逐条实测吻合。

### 顾问未覆盖、本轮补上的两点

1. **`b3bee6b` 是纯删除**：该次重裁新增的隔离件验收引用数为 **0**，不存在「删一批塞一批」。
2. **`b3bee6b` 之后没有回流**：`b3bee6b` → `HEAD` 之间，两端都存在的 story 里隔离件引用净变化为 0。
   但这条有一个**必须点明的盲区**——`prd-stale-red-admission-refit.json` 在 `b3bee6b` 时尚不存在，
   它把 `p3-compile.golden.mjs` 与 `report-diagnostics.golden.mjs` 重新塞回活验收的事实落在本比对的
   取样面之外（见 `docs/plans/isolated-golden-acceptance-revocation/plan.md` 的根因一节）。
   本清单的「净变化 0」只对「`b3bee6b` 当时就存在的 story」成立，不等于全仓零回流。

## 待裁问题：可执行质量契约 vs 登记账

补空数组判据会撞现役数据，但两类数据的性质不同，不能一刀切：

- **`prd-cli-mcp-face.json`** 两条 story 验收数组为空（`s1-face-align`、`s2-ripple-locks`），
  当前 `passes` 均为假。它们的 `evidence` 写的是 `REVOKED@2026-07-15`——是**有意撤销**留下的空，
  性质是「义务还在、机器面被依法拿掉」。这类空数组一旦被跑一次门禁就会真空翻绿（见反例钉一）。
- **8 份 `stories` 为空的 prd**：`prd-replay-admission-hermetic-migration` 与 7 份 `prd-tc_*`。
  它们是用例级的校验和登记账，不是可执行质量契约——**本清单不判它们违规**。

问题：门禁怎么机械区分这两类？现在没有任何字段可据以区分，`gate.mjs` 对二者一视同仁地按可执行契约处理，
于是登记账会被判 `GREEN 0/0`。建议的收口方向（本步不落地，留待人裁）是给 prd 加显式类型字段，
把登记账从可执行契约里分出去，而不是给空数组判据开例外——顾问原话是「不能把后者继续伪装成可跑 prd
后再用例外放行」。

## 逐条清单

#### tier1-hollow / passes=true —— 19 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `btn-enable-ops#s1-enable-ops` | 1 | `selftest --tier1` | u3/r5/s0（p0） |
| `chiefcomplaint-smoke#s1-kinds-and-replay` | 1 | `selftest --tier1` | u5/r7/s0（p0） |
| `e2e-chain#s1-chain` | 1 | `selftest --tier1` | u1/r7/s0（p0） |
| `kinds-harden#s1-harden-two-kinds` | 1 | `selftest --tier1` | u3/r2/s0（p0） |
| `p3-compile#s1-compile-pipeline` | 1 | `selftest --tier1` | u4/r10/s0（p0） |
| `plan-debt-sweep#s1-debt-sweep` | 1 | `selftest --tier1` | u2/r2/s0（p0） |
| `regress-promptset#s1-promptset-overlay-aggregate` | 1 | `selftest --tier1` | u15/r2/s0（p0） |
| `replay-login-bootstrap#s1-login-bootstrap-optin` | 1 | `selftest --tier1` | u0/r8/s0（p0） |
| `replay-video#s1-video-record-and-report` | 1 | `selftest --tier1` | u1/r13/s0（p0） |
| `report-diagnostics#s1-diagnostics-render-and-wiring` | 1 | `selftest --tier1` | u11/r1/s0（p0） |
| `run-convention#s1-run-convention` | 1 | `selftest --tier1` | u0/r9/s0（p0） |
| `run-history#s1-produce-and-wire` | 1 | `selftest --tier1` | u1/r4/s0（p0） |
| `sign#s1-sign-and-replay-gate` | 1 | `selftest --tier1` | u21/r2/s0（p0） |
| `video-login-carry#s1-carry-fix-and-hygiene` | 1 | `selftest --tier1` | u0/r5/s0（p0） |
| `wf-add-node#s3-fixture-and-chain` | 3 | `selftest --tier1` | u3/r33/s2（p0） |
| `wf-connect-nodes#s2-resign-and-regression` | 3 | `selftest --tier1` | u5/r34/s0（p0） |
| `wf-history-version#s1-two-atoms-and-dialog` | 1 | `selftest --tier1` | u1/r11/s0（p0） |
| `wf-open-node#s2-resign-and-regression` | 3 | `selftest --tier1` | u5/r34/s0（p0） |
| `wf-open-smoke#s1-open-atoms` | 1 | `selftest --tier1` | u1/r4/s1（p0） |

#### tier1-hollow / passes=false —— 1 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `wf-publish-states#s1-buttonstate-kind-and-capture` | 1 | `selftest --tier1` | u6/r11/s0（p0） |

#### flow-bridge-insufficient / passes=true —— 9 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `drawer-lock-hardening#s1-drawer-lock-hardening-e2e` | 9 | `flow-bridge` | u16/r94/s11（p6） |
| `ingest#s2-ripple-locks` | 3 | `flow-bridge` | u12/r29/s0（p0） |
| `replay-nth-visible-hardening#s2-resign-and-regression` | 8 | `flow-bridge`<br>`selftest --tier1` | u13/r73/s9（p0） |
| `wf-add-node#s1-atom-and-flip` | 2 | `flow-bridge` | u3/r13/s3（p0） |
| `wf-connect-nodes#s1-connect-atom-and-coverage` | 3 | `flow-bridge` | u5/r20/s5（p0） |
| `wf-open-node#s1-opennode-atom-e2e` | 4 | `flow-bridge` | u6/r28/s7（p0） |
| `wf-open-smoke#s2-ripple-flip-and-locks` | 3 | `flow-bridge` | u5/r34/s0（p0） |
| `wf-select-node-dropdown#s1-selectnodedropdown-atom-e2e` | 5 | `flow-bridge` | u8/r39/s9（p0） |
| `wf-set-node-field#s1-setnodefield-atom-e2e` | 6 | `flow-bridge` | u10/r51/s11（p0） |

#### mixed / passes=true —— 23 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `btn-enable-ops#s2-ripple-flip-and-locks` | 4 | `p4-drafter`<br>`p2-check-vocab` | u11/r31/s0（p0） |
| `caseid-echo-mask#s2-ripple-locks` | 2 | `flow-bridge`<br>`draft-cli`<br>`compile-caseid-shape` | u25/r12/s0（p0） |
| `chiefcomplaint-smoke#s2-ripple-and-locks` | 4 | `p5-replay-coverage` | u4/r45/s0（p0） |
| `compile-caseid-shape#s2-regression-locks` | 2 | `p2-verdict` | u9/r17/s0（p0） |
| `cred-route-mask#s1-mask-at-source` | 1 | `cred-route-mask`<br>`selftest --tier1` | u5/r7/s0（p0） |
| `drawer-lock-hardening#s2-regression-and-selftest` | 2 | `p5-replay-coverage`<br>`report-workflow-structure`<br>`selftest --tier1` | u1/r24/s0（p0） |
| `kinds-harden#s2-ripple-and-locks` | 1 | `p4-drafter`<br>`draft-cli`<br>`report-fidelity`<br>`p5-replay-coverage` | u0/r17/s0（p0） |
| `noerrenv-absence#s1-absence-semantics` | 1 | `p5-replay-coverage`<br>`selftest --tier1` | u0/r17/s0（p0） |
| `noerrenv-absence#s2-regression-locks` | 1 | `p4-drafter` | u4/r10/s0（p0） |
| `output-seal#s1-output-seal` | 4 | `output-seal`<br>`selftest --tier1`<br>`draft-cli`<br>`p7-report`<br>`caseid-echo-mask` | u26/r36/s0（p0） |
| `p3-compile#s2-regression-locks` | 1 | `p7-credgate-coverage`<br>`p5-replay-coverage` | u0/r17/s0（p0） |
| `p4-drafter#s2-regression-locks` | 1 | `seams-freeze`<br>`p5-replay-coverage` | u0/r17/s0（p0） |
| `plan-debt-sweep#s2-ripple-locks` | 4 | `p5-replay-coverage` | u26/r36/s0（p0） |
| `regress-promptset#s2-regression-locks` | 2 | `p5-replay-coverage`<br>`report-fidelity`<br>`p7-report`<br>`p2-verdict` | u5/r24/s0（p0） |
| `replay-login-bootstrap#s2-regression-locks` | 2 | `p5-replay-coverage` | u4/r27/s0（p0） |
| `replay-video#s2-ripple-and-locks` | 8 | `p5-replay-coverage`<br>`layer3-wiring-coverage`<br>`p7-report`<br>`report-fidelity`<br>`cred-route-mask`<br>`p7-credgate-coverage` | u24/r81/s0（p0） |
| `report-diagnostics#s2-regression-locks` | 4 | `p7-report`<br>`report-fidelity` | u12/r44/s0（p0） |
| `report-fidelity#s2-regression-locks` | 1 | `layer3-wiring-coverage`<br>`p7-report`<br>`p5-replay-coverage` | u0/r17/s0（p0） |
| `run-history#s2-regression-locks` | 3 | `p5-replay-coverage` | u3/r41/s0（p0） |
| `wf-add-node#s2-dragto-seams` | 3 | `seams-freeze`<br>`seams-freeze-v2` | u7/r23/s2（p0） |
| `wf-history-version#s2-regression-locks` | 4 | `p4-drafter` | u25/r21/s0（p0） |
| `wf-select-node-dropdown#s2-resign-and-regression` | 4 | `p5-replay-coverage`<br>`seams-freeze`<br>`seams-freeze-v2`<br>`selftest --tier1` | u6/r38/s0（p0） |
| `wf-set-node-field#s2-resign-and-regression` | 4 | `p5-replay-coverage`<br>`seams-freeze`<br>`seams-freeze-v2`<br>`selftest --tier1` | u6/r38/s0（p0） |

#### mixed / passes=false —— 11 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `chief-bringup#s1-bringup-four-fixes` | 1 | `hermetic-golden-isolation-pending [zs]` | u5/r7/s0（p0） |
| `flow-bridge#s2-ripple-locks` | 4 | `hermetic-golden-isolation-pending [zs]` | u16/r39/s0（p0） |
| `layer3-wiring#s1-layer3-wiring` | 1 | `hermetic-golden-isolation-pending [zs]` | u0/r22/s0（p0） |
| `login-traffic-drop#s1-login-drop-and-host-strip` | 2 | `hermetic-golden-isolation-pending [zs]` | u5/r15/s0（p0） |
| `p5-replay#s1-replay` | 1 | `hermetic-golden-isolation-pending [zs]` | u0/r17/s0（p0） |
| `replay-nth-visible-hardening#s1-three-fixes-red-golden` | 1 | `hermetic-golden-isolation-pending [zs]` | u0/r4/s0（p0） |
| `replay-settle-mount#s1-settle-red-golden` | 1 | `hermetic-golden-isolation-pending [zs]` | u9/r7/s0（p0） |
| `replay-settle-mount#s2-regression-and-resign` | 7 | `p5-replay-coverage`<br>`hermetic-golden-isolation-pending [zs]`<br>`selftest --tier1` | u12/r49/s1（p0） |
| `sign#s2-ripple-locks` | 9 | `hermetic-golden-isolation-pending [zs]` | u28/r88/s0（p0） |
| `video-login-carry#s2-ripple-locks` | 4 | `hermetic-golden-isolation-pending [zs]` | u5/r27/s0（p0） |
| `wf-publish-states#s2-ripple-and-locks` | 5 | `p4-drafter`<br>`report-fidelity`<br>`seams-freeze`<br>`seams-freeze-v2`<br>`p5-replay-coverage` | u9/r52/s0（p0） |

#### legitimate-tier1 / passes=true —— 13 条

| story | 删掉的隔离件数 | 当前验收面 | obligationMix |
|---|---|---|---|
| `casey-demo#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `gen-prompts#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `ingest-scaffold#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `loop-kit-extract#s5-tier1-regression` | 0 | `selftest --tier1` | — |
| `ratchet-reverse-index#s2-regression` | 0 | `selftest --tier1` | — |
| `record-capture#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `record-distill#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `record-intake#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `report-cleanup-evidence#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `report-nl-atomic#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `report-video-block#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `report-workflow-structure#s2-tier1-regression` | 0 | `selftest --tier1` | — |
| `worktree-baton#s2-tier1-regression` | 0 | `selftest --tier1` | — |

> 列义：`u`=`survive-unit` / `r`=`retain-isolated` / `s`=`superseded`，括号内 `p` 是 `retain-isolated` 里 `coverageRelation` 为 `partial` 的子计数（不与 `r` 相加）。`[zs]` 表示 `.zero-sut.golden.mjs`。完整验收命令原文见机读件。
