# wf-history-version — 飞轮第四条移植：历史版本弹窗（direct）

## 背景

`regress_autotest` 的 `wf_history_version`（新建空工作流 → 未发布点「历史版本」断「暂无数据」→ 发布 → 断「导出」出现 → 再点「历史版本」断版本表「创建时间/查看」→ 清理）移植进 casey。零机制缝：两个纯加法编译原子 + 夹具扩展 + golden，断言全为已实现 kind——「机制缝递减」终点验证（3→1→0）。决策见 `proposed/GRILL.md`（D1–D6 全机械）。

## 改动

1. `lib/compile-atoms.mjs`（D1/D2）：`compileWorkflowClickEditorButton`（click，semantic role button `{ name, exact: true }`）+ `compileWorkflowCloseDrawer`（press Escape，`fallbackCss: 'body'`）；分派表 +`workflow.clickEditorButton`/+`workflow.closeDrawer`。
2. `tests/fixtures/publish-sut/server.mjs`（D4）：编辑器顶栏加「历史版本」按钮 → 弹窗（未发布「暂无数据」/ 发布后表头「版本/状态/创建时间/操作」+ 行「V1/查看」+「关闭」钮）；Esc 关闭。涟漪：`prd-wf-publish-states` 夹具 checksum 重签 + 其 gate 复验。
3. 新 golden `tests/_golden/wf-history-version.golden.mjs`（红先行，D6）：
   - C 编译向（唯一实现前红）：闸段 + 执行段——flow〔login/create/clickEditorButton/asserts/closeDrawer/publish/clickEditorButton/asserts/closeDrawer〕全步 unique、`clickEditorButton` 产 click event（role 历史版本 exact）、`closeDrawer` 产 press Escape event、断言原子折 intent 留痕（3 `textVisible` + 1 `buttonState`）；
   - I 回放向（冻结即绿=夹具+既有通路回归）：手写 events 回放——未发布弹窗 `textVisible(暂无数据)` 真过、Esc 后再点发布翻面、发布后弹窗 `创建时间`/`查看` 真过 + `buttonState(导出,present)` 真过、`textHidden(暂无数据)` 于发布后弹窗真过（版本表替换空态）；
   - W 接线向（冻结即绿）：`casey run` 端到端全 intent PASS + 报告三件。
4. `loop/prd-wf-history-version.json`：s1 = 新 golden + tier1；s2 = 回归锁（`wf-publish-states`〔夹具重签后〕/`chiefcomplaint-smoke`/`kinds-harden`/`p4-drafter`/`report-diagnostics`）。observability：真机四停站（可与 wf-publish-states 合并一次行程）。
5. 真机件（`cases/tc_wf_history_version/`，gitignored，route:human）：手写 TestCase（四 intent：create/历史版本空态/publish+历史版本表/delete 清理对账）、flow 草稿、profile 复用。

## 非目标

`wf_open_smoke`（零缝暖场，按需）；`workflow.configEndOutput` 等画布配置原子（canvas 维度）；「优化」按钮断言（regress note：测试表文案是能力描述，只断可观察弹窗内容——移植忠实沿用）；列表检索面进夹具（delete 只在真机走）。

## 验收

新 golden 全绿（实现前 C 红：两原子「暂无编译知识」抛；I/W 冻结即绿）；夹具重签后 `prd-wf-publish-states` gate 复验 GREEN；五份回归锁原样绿 + `selftest --tier1`；gate GREEN。真机四停站挂 observability，人不在场只挂账绝不代签。
