# report-diagnostics — P7 报告消费侧加法：回放诊断栏目（light）

## 背景

真机已在产的回放历史/回放指标旁件（`runs/<caseId>/<runId>/run-history.jsonl` + `run-metrics.json`）只落盘不呈现；报告消费侧补「回放诊断」栏目。Steven 拍板路 B + 逐步嵌入（GRILL D1）：`report-model` 与全部冻结 schema 零动，渲染器侧加法。replyText 摘录挂账经侦察核销（GRILL D2）：`observed.replyText` 与断言 `actual` 两条通道已在渲染，本契约只钉回归锁。红线：仅诊断呈现、绝不进 verdict、绝不写 passes（旁件 schema 与编排器注释已钉，`run-history.golden` U1 背书）。

## 改动

1. `lib/report.mjs`：`renderReport(model, diagnostics)` 加可选第二参——`diagnostics = { metrics: object|null, history: array|null }`；单参/缺第二参行为一字不变（p7-report golden 单参续绿）。
   - HTML 全局：groups 之后加「回放诊断」section——指标行（步数/动作成功/`locatorHitRate`/静默点等待/总耗时/`runId`），显式标注「仅诊断，不进裁定」（soft「不进裁定树」同款黄标语义）；
   - HTML 逐步嵌入（D1）：history 行按 `intentId` 归到所属步卡（`stepHtml` 附件行之后），表列 = 步/动作/原子/定位/耗时/结果/静默点；无匹配 intent 的行落全局栏目尾部「未归属」小节，不静默丢（M3）；
   - MD 镜像同构；`renderJson`（机读旁车）零动；
   - 新栏目只渲染相对路径/枚举值/数字，零绝对 URL 零外链（p7 自包含检查续绿，M2）。
2. `bin/report.mjs`：可选旗标 `--run-history <jsonl>` / `--run-metrics <json>`——薄壳读文件传第二参；不传零行为差（M1）；传了但文件缺/坏 JSON/坏行 = fail-closed exit 1（报告宁缺不糊）。产物仍三件、仍过 `credentialGate` 末道闸（新栏目文本一并受扫）。
3. `bin/casey.mjs` run：相6 stage 补传 `--run-history`/`--run-metrics`（replay stage 恒产两件于同 runDir，路径编排器手握）。
4. 新 golden `tests/_golden/report-diagnostics.golden.mjs`（红先行）：
   - U1 单参回归：`renderReport(model)` 无「回放诊断」栏目（冻结即绿，回归保护）；
   - U2 双参渲染：metrics 字面量（步数/`locatorHitRate`/`runId`）+「仅诊断」标注在 HTML 与 MD；无 `https?://`；
   - U3 逐步嵌入：history 行按 `intentId` 落对应 `data-step-id` 步卡内（耗时/结果字面量），他步卡不含；
   - U4 未归属行落全局「未归属」小节；
   - U5 replyText 回归锁（D2 核销依据）：`observed.replyText` 在 HTML `pre.reply` 与 MD 真渲染（冻结即绿）；
   - W1 壳旗标：带旗标产物含诊断栏目；坏 metrics JSON → 非零退出零落盘；不带旗标 → 无栏目；
   - E1 `casey run` 端到端（复用 publish-sut 只读 import，nav 单 intent + `textVisible` 断言）：`report.html` 含「回放诊断」+ 步卡含本 intent history 行。
5. `loop/prd-report-diagnostics.json`：s1 = 新 golden + tier1；s2 回归锁 = `p7-report`/`report-fidelity`/`run-history`/`layer3-wiring`/`chiefcomplaint-smoke`（W1 含 `casey run` 报告面）/`wf-publish-states`。observability：真机报告带诊断栏目过目（并入下次真机停站顺带，route:human）。

## 非目标

路 A（诊断进 `report-model`/动冻结 schema）；`report.json` 机读形态携诊断（聚合消费者出现再议）；报告新增其他栏目；错误 toast 结构类名（既有挂账）；失败记录台账/失败指纹（接缝已冻未接线，另契约）。

## 验收

新 golden 全绿（实现前红：双参不渲染栏目、壳旗标无效果、步卡无 history 行、`casey run` 报告无栏目）；U1/U5 冻结即绿；六份回归锁 golden 原样绿 + `selftest --tier1`；gate GREEN。真机过目挂 observability。
