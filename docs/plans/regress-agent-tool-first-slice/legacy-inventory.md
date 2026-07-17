# regress 智能体工具遗产清单

以下清单来自只读检查 `regress_autotest/tests/flows/agent_*/*.flow.json`。旧报告与旧绿不作为 Casey 证据。

| 序号 | 遗产 flow | 业务语义 | 本轮 |
|---:|---|---|---|
| 1 | `agent_prompt_tabs` | 智能体提示词按系统/用户分区 | 待迁 |
| 2 | `agent_tool_add` | 加首个工具后出现工具提示词 | 首纵切 |
| 3 | `agent_tool_back_to_detail` | 从 MCP 列表返回详情，区分未保存/已保存状态 | 待迁 |
| 4 | `agent_tool_e2e` | 选模型、加工具、保存、发布并发消息得到真实回复 | 待迁 |
| 5 | `agent_tool_jump_mcp` | 从已添加工具跳到 MCP 列表 | 待迁 |
| 6 | `agent_tool_remove` | 移除工具后工具提示词消失 | 待迁 |
| 7 | `agent_tool_search_primary` | 按一级 MCP 名搜索 | 待迁 |
| 8 | `agent_tool_search_secondary` | 按二级工具名搜索并定位父级 | 待迁 |
| 9 | `agent_tool_show_all` | 从仅显示已选切回全部并保持原始顺序 | 待迁 |
| 10 | `agent_tool_show_selected` | 仅显示已选工具 | 待迁 |

## 首纵切真机尾巴

`agent_tool_add` 仍须在当前真实被测系统重新确认：智能体新建字段、工具选择器 DOM、目标 MCP 与工具是否在场、确认后工具提示词是否出现、删除后是否零残留。未完成这些步骤前状态恒为 `route:human`，不是 PASS。
