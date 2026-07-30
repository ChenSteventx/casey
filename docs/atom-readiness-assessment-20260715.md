# Casey 原子能力与受控演进评估（2026-07-15）

## 结论

当前不能说“Heren 中台、医生站、Hi 小助的原子操作已经完备”。建议只有同时经过以下六级，才称某原子对某业务流程可用：

`registry → compile → hermetic 正反例 → 人签正式 case → 真机回放 → 视觉/业务后置一致`

注册表有 60 个 atom，但真正有命名编译实现的只有 18 个；加特殊 `login` 与 7 个 `assert.*`，最多 26/60 能进入编译路径，且其中仍有断言实现缺口。注册表快照不等于 Casey 已经能执行。

## 三业务面

| 业务面 | 当前程度 | 关键事实 | 优先级 |
|---|---|---|---|
| Heren 中台 web | 少数核心原子接近六级 | 工作流创建/保存/发布/历史与智能体测试面板已有 hermetic/真机证据；大量画布配置和智能体 CRUD 仍 registry-only 或无正式真机成功基线 | P0/P1 |
| 医生站 | 未进入业务模型 | 权威词表、cases、profiles、runs 中均无医生站资产；`tc_chiefcomplaint_smoke` 是 Heren 中台智能体管理，不是医生站 | P0 调研建模 |
| Hi 小助 | 架构预留 | 对应 `cef` 通道，目前只有设计/数据接缝；无 CEF compiler/driver、正式 case 或真机端到端 | P0 通道 bring-up |

## Heren 中台关键矩阵

| 能力 | 判断 | 证据/缺口 |
|---|---|---|
| workflow 创建、保存、发布、历史 | 核心窄链可用 | 本轮 `tc_wf_publish_states` 真机录屏确认加载、未发布按钮态与发布后状态 |
| `workflow.deleteByName` | **不可靠，P0** | 本轮删除为 `ambiguous`、确认为 `none`，却因代表步卷回 + cleanup 无后置断言仍被机器判 PASS |
| workflow 打开详情 | 未达正式真机成功级 | `tc_wf_open_smoke` 仍有待定目标名，不能外推 |
| 画布 add/connect/open/select/set | hermetic 较强，真机不足 | 有专属 golden；正式真机正向成功链不足，旧 addNode 还有 SUT_DEFECT/NEEDS_HUMAN 样本 |
| 其余画布配置 | 多数不完备 | switch/model/MCP/变量/结束输出等大量 registry-only 或缺全链 |
| 智能体搜索/测试面板/发消息 | 通路可跑但无正向基线 | 真机已有流程与视觉；当前回复结果曾为 SUT_DEFECT，不能算业务成功 |
| 智能体 CRUD、模型、工具/MCP | 不完备 | 注册表远多于编译和回放实现 |

## 本轮暴露的 P0 信任边界

`tc_wf_publish_states` cleanup intent 中：

- `atstep_12`：删除定位 `ambiguous/locatorError`；
- `atstep_13`：确认定位 `none/locatorError`；
- 最后的搜索 `press` 被当作代表动作，`unique` 掩盖中间失败；
- 冻结 expected 没有 cleanup 的“精确计数归零”业务后置断言；
- 因此 `verdict.json` 仍为 PASS，而录像末帧实体仍存在。

优先修复：同一 intent 任一变更动作 `ambiguous/none/action_failed` 时不得被末尾代表步洗成 PASS；`workflow.deleteByName` 要绑定目标卡片/行，并以删除后精确计数归零或成功信封 + 归零双证收口。

## 人工示教与原子演进

当前已经具备：

- `record → intake → distill` 的真机采集、凭据/URL/目录安全检查和只追加摘要账本；
- `ingest → flow-bridge → compile → draft → sign` 的候选回流、注册表校验、真机编译、确定性断言草案与人工签署。

当前尚未具备：

- `distill v1` 明确全部 `pending`、`candidateMapping=[]`，不会从裸点击生成硬化原子；
- 没有“生成原子候选→注册表/编译器实现→golden→受控启用”的自动工序；
- `casey heal` 仍是 exit 3 的诚实桩，不可宣称自动修复完成。

合理目标是“受控演进”，不是在线自改：

1. 自动动作失败后进入人工示教，保留录像、DOM 安全指纹、动作前后状态和网络取证；
2. 模型只提出“既有原子加固候选”或“新原子候选”，不参与 verdict；
3. 自动生成红测试与 fake-SUT 反例；
4. acceptance gate + 异构评审 + hermetic 回归；
5. 人签后进注册表，再做真机 canary；
6. 确定性证据全绿才启用，不自动修改冻结断言。

本轮 cleanup 应加固已有 `workflow.deleteByName`，不应新建同义原子。

## 建议顺序

1. **P0** 修 intent 内事件失败折叠，消除机器假 PASS。
2. **P0** 加固 `workflow.deleteByName`，补签 cleanup 后置断言，重跑发布/历史/CRUD 三条真机清理链。
3. **P0** 医生站真机只读勘察：先确认普通 web、CEF 或其它容器，再定义首条 case/profile/最小原子。
4. **P0** Hi 小助 CEF 通道 bring-up：driver/compiler/schema/case/录屏最小闭环。
5. **P1** 按业务流逐个补齐 Heren 画布与智能体 CRUD，而不是按 60 个 registry 条目平均铺开。
