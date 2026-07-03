# GRILL — wf-history-version（direct，实质 grill，2026-07-03）

授权：Steven 点选「继续干第四条移植」（AskUserQuestion，wf_publish_states 收口后）；候选排序承 wf-publish-states 摸底（`wf_history_version` = buttonState 装好后最便宜条）。源材料直读重验：`wf_history_version.flow.json` 十三步（confirmedAt 2026-06-09）+ `_atoms.ts` 两原子实现——`clickEditorButton` = `getByRole('button', { name }).click()` 单击；`closeDrawer` = `keyboard.press('Escape')`。断言需求 `textVisible`×3 + `buttonState(导出, present)`×1，全在 `IMPLEMENTED_KINDS`——**零新 kind、零词表/schema/回放器改动，「机制缝递减」终点验证（第二条 3 缝 → 第三条 1 缝 → 本条 0 缝）**。

## 决策（全机械，无承重分岔——案子本身是 Steven 点的）

- D1 `workflow.clickEditorButton` 编译知识：`emit click`，semantic role button `{ name: params.name, exact: true }`（regress 忠实 + casey 语义锚定纪律）。
- D2 `workflow.closeDrawer` 编译知识：`emit press Escape`，锚 `fallbackCss: 'body'`（count 恒 1 过身份门；Playwright press 先 focus 再发键，Esc 冒泡关弹窗与 regress 键盘行为等效）——冻结 events 枚举内表达，零枚举改动。
- D3 hermetic C 编译向 flow 省首尾 `deleteByName`（uniqueName 纪律 + 夹具无列表检索面，wf-publish-states C1 先例）；真机 TestCase 保留尾部清理 + 计数对账。
- D4 夹具扩展 publish-sut（同编辑器域不另起炉灶）：顶栏加「历史版本」按钮 → 弹 `hr-dialog` 形态弹窗——未发布态「暂无数据」、发布后版本表（表头含「创建时间」+ 行按钮「查看」+「关闭」，regress 真机探得形态复刻）；Esc 关闭。涟漪 = `prd-wf-publish-states` 夹具 checksum 重签 + 其 gate 复验（本 session 两先例）。
- D5 断言挂靠：`暂无数据` 挂第一次点历史版本的 intent（代表步静默点弹窗开着）、`导出 present` 挂 publish intent、`创建时间`/`查看` 挂第二次点历史版本的 intent——与 assert 原子折 intent 既有法一致。
- D6 红先行形状：回放侧零新机制 → I/W 检查冻结时即绿（回归保护：夹具正确性 + 既有 kind 通路）；唯一红 = C 编译向（两原子「暂无编译知识」抛）。
- 术语：零新造词。

## 真机停站（route:human，挂 observability）

四停站与 wf-publish-states 同款（confirm → execute → draft 人签 → run 报告过目），可与其合并一次真机行程；「历史版本」弹窗真机形态已有 regress 2026-06-09 探得记录，bring-up 探针顺带重验（按钮 role 可达性探针同场覆盖）。
