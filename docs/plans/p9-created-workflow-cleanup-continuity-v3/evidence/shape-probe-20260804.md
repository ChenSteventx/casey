# delete 形状实采实录（2026-08-04，Steven 批准）

## 授权与纪律

Steven 2026-08-04 批准：建一个 `atl_` 前缀工作流 + 拦截采集 delete 请求形状，**不真删**。
A3 之后同窗口执行。全程凭据不落任何输出；采形脚本在点「删除」菜单项之前就装全域
非读请求拦截（比仓内探针更严）——即使 SUT 无确认框直删也发不出去。

## 过程与产物

1. **创建**（本轮唯一真实变更）：`atl_shape0804a`（描述固定文案、分类「测试分类」，
   UI 序列照 `compileWorkflowCreate` 实采知识）。列表 API 读回唯一命中，id 为 string。
2. **仓内探针首跑**：`scripts/p9-workflow-adapter-probe.mjs` 判
   `NO_DELETE_CAPABLE_RECORD_AVAILABLE` 之后（当时无 atl_ 对象）；建目标后复跑仍早退：
   目标卡片唯一（`layout: card`）但 `deleteButtons: 0`、`trigger.resolution: none`。
3. **只读诊断**：卡片唯一动作控件为 `button.agent-card__more`（title「更多操作」）；
   **悬停**该钮浮现 `div.hr-popup.hr-dropdown.hr-dropdown--bottom-right`（z=5500），
   含菜单项 编辑 / 复制 / 删除 / 停用。点击也可浮现。
4. **采形**（全域拦截先装，后走 悬停⋯ → 删除 → 确认框确认）：

   | 项 | 实采值 |
   |---|---|
   | `mutationSent` | `false`（仅 1 发非读请求，发出前 abort） |
   | `method` | `POST` |
   | `path` | `/ai-manager/process/delete` |
   | `bodyKeys` | `["masProcessId"]` |
   | `idLocations` | `["body.masProcessId"]`（与列表读回的真实 string id 精确匹配） |

## 结论

- **F5 补硬**：签署备料表中 `mutationAdapter.method/path/idLocation`
  （`POST` / `/ai-manager/process/delete` / `body.masProcessId`）由真机实采证实，
  不再是草案推断。
- **新缺口（须在 B4 前收口）**：现行工作流列表已是卡片布局，删除入口藏于悬停
  「更多操作」菜单。`lib/workflow-delete-domain.mjs` 的 `pinExactAction` 只找容器内
  **可见**、文本「删除」的控件（不悬停、不看 ⋯ 菜单）→ `performWorkflowDeleteTrigger`
  命中 0。**B4 的 tc_catalog_wf_crud 重编译与三成员清理链会在删除步败**。
  需要删除域扩展契约（卡片布局：悬停 ⋯ → `hr-popup.hr-dropdown` 菜单内取「删除」），
  红金牌先行；2026-07-22 全 PASS 是旧表格布局时代的绿，不可外推。

## 残留

`atl_shape0804a` 留在 SUT（删除被按设计 abort）。清理义务挂账：由删除域扩展契约
落地后的清理链清偿，或签署会话时人工删除；不得静默遗忘。
