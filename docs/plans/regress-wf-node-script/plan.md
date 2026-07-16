# regress-wf-node-script — 脚本转换节点遗产迁移

## 目标

把 `regress_autotest/tests/flows/wf_node_script/wf_node_script.flow.json` 的业务语义迁入 Casey：新建带
`atl_{{uniqueName}}` 名称的工作流，新增“脚本转换”节点，打开节点配置，写入 Python 脚本，并通过冻结断言
精确回读同一字段值，最后关闭抽屉并删除工作流。

只迁移自然语言用例、原子顺序和业务约束；旧 Playwright 动作、报告、trace 与历史绿结论均不迁移。

## 缺口与实现边界

- 现有 `workflow.addNode`、`workflow.openNode`、`workflow.setNodeField`、`workflow.closeDrawer` 和
  `workflow.deleteByName` 继续复用。
- 补 `workflow.assertNodeFieldValue` 这一在册但不可编译的命名断言原子。它不产生事件，只附着到前一个
  `workflow.setNodeField` 意图，确定性映射为 `inputReadback equals`。
- 原注册表的“含子串”文案同步收紧为“完整值精确相等”，与动作门既有精确回读保持同一语义，避免半填或
  尾缀被当作成功。
- 补 `inputReadback` 的回放期评估。冻结值用规范字符串同时绑定节点名、placeholder、精确开关和完整值；
  取值只接受代表事件动作轴中 `resolution=unique`、`identityReadback.ok=true` 且 actual 为同结构规范值的
  同一物理字段回读。任一字段不一致、缺失、矛盾或非唯一一律证不出。
- `workflow.setNodeField` 已有物理句柄精确回读，在成功动作轴中加性携带 `actual`；不新建第二套 DOM 定位。
- `inputReadback` 从未实现转已实现后，`p4-drafter` 中唯一相关范例同步从软断言提硬，并更新其原有冻结
  checksum；不改测试含义，不放宽任何校验。
- 不改 `verdict.mjs`，不新增 schema kind/op，不运行浏览器、夹具或假被测系统。

## 零 SUT 验收

`tests/_golden/regress-wf-node-script.zero-sut.golden.mjs` 必须验证：命名断言在编译知识允许集中但不进入动作
分派表；编译只留断言原子、不产事件；草拟结果为硬 `inputReadback equals`；缺参数转人工；动作轴提取和
断言评估均 fail-safe；迁移候选使用保留前缀与模板，不含旧报告/trace。

## 真机验收（route:human）

零 SUT 绿只代表编译与裁定接缝具备，不代表真实行为完成。真机仍须重新归一、由人确认 flow、重新编译并
签署断言；随后联网回放同一用例，确认脚本字段真实 placeholder、脚本值精确回读、删除后归零，并交付独立
HTML、录屏、附件与视觉复核。未取得这些证据前状态固定为 `route:human`。

## 公开仓适配

公开仓当前同样只有注册表条目，没有 `workflow.assertNodeFieldValue` 编译知识，也未实现 `inputReadback`。
补丁应按文件级 cherry-pick/手工移植，不得整树覆盖；公开仓的 CEF、安装与原子晋升扩展保持原样。
