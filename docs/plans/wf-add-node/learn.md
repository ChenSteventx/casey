# wf-add-node — learn（2026-07-07，full，codex 两轮 R2 PASS）

画布维度首原子 `workflow.addNode` 建成（`COMPILE_KNOWN_ATOMS` 13→14）+ `dragTo` 动作类入双冻结。
六阶段全走：真机二号探针定案 → GRILL D1–D10（Steven 四项点选）→ 红金牌（3 过/6 败断言层红）→
实现（主循环耦合核心 + 子代理机械面并行）→ codex R1 四发现全采信修毕 R2 PASS → 本沉淀。

## 留存学习

1. 真机摸底先于 GRILL 定案的价值实证：两发只读探针（一号：单击/双击死刑；二号：frame 树 + 技术栈指纹 +
   真拖拽落节点）把最贵分岔（甲案纯加法 vs 乙案新动作类）在设计前钉死，避免整条错路契约。画布是 LogicFlow
   但 `window.lf` 不暴露——regress 情报的图对象口指望作废，拓扑取证只能挂账 SUT 配合。
2. 编译门=回放门（同刻门）纪律（codex R1-F2 High）：编译期用 `.node-item` 容器过滤证出的「源唯一」，
   回放期若走全页 `getByText` 就是另一扇门——既有同名节点内容会让合法回放 `fallback_first` 卡死、
   反向可拖非面板同名文本。修法 = `dragTo` 专用门 `doDragTo` 与编译过滤同刻（域锁 + 锚定精确正则）。
   与 wf-open-smoke 容器归属闸同族反向：那次编译期缺容器闸、这次回放期缺——容器域动作两端都要锁。
3. 内容参数也要必填门（codex R1-F1 High）：`ox`/`oy` 不做身份门 ≠ 可缺省——缺省 0 恰好落在画布界内，
   就是「证不出被洗成假绿」的精确形态。落点非有限数即不动 `mouse`、回 `action_failed`。
4. 机械面 fan-out 的裁剪盲区（codex R1-F3 Med）：子代理对 GRILL D1 涟漪清单第 6 项（v1 金牌稳定定位
   名单 +`dragTo`）自行判「不改，fixture 无 dragTo 步即无感」——异构评审翻案。教训：GRILL 涟漪清单是
   契约义务不是建议，子代理无权裁剪；主循环合并时须对照清单逐项点收，而不是只看六 golden 绿。
5. stash 红证法：评审期新钉/重钉断言的红先行，用 `git stash push -- <单文件>` 回 HEAD 旧实现跑金牌取红
   （本轮 C3/C4c/C4d 三红如实、红因与发现一一对应），低成本高保真，优于「口头声称会红」。
6. 金牌含字判是水过缝（codex R1-F4 Med）：`JSON.stringify(x).includes('semantic')` 断「结构性必填」
   必被描述文本水过——结构性要求必须结构性判定（`then.required.includes`）。同族先例：handover-pack
   「评审包不许省略」，都是「看起来在验、实际没验」的验收面假结构。

## 交到下一阶段的账

- `workflow.openNode` 下一契约（direct/light，骑本契约画布夹具零冻结改动）；贪心序参考：
  +`selectNodeDropdown` 后可解锁 9/23 条 R9 flow。
- 真机四停站 route:human（prd observability 四项：面板项文本漂移 / `lf-node` 族类名漂移 / 拖拽时序
  真机负载 / `window.lf` 挂账 SUT）——前置：真机账户禁令（2026-07-07 Steven 明令，仅 autotest 可用，
  动真机前带外核 `.auth/credentials.json`）。
- 面板内多匹配 `fallback_first` 分支 hermetic 造不出（21 项名唯一）——真机观察挂账。
- `assert.switchState` kind 未实现：`echo_default_on` 等 3 条 R9 flow 的核心断言仍 soft，画布维度
  后续契约同步补（flywheel-schedule 字段级加法第 2 处）。
- 示教（teach-in）兜底机制三契约（record-capture / record-intake / record-distill）+ CONTEXT.md 登记
  排队中（Steven 已定：命名示教、录不算签、不开直通回放通道）。
