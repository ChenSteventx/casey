# GRILL — wf-publish-states（full，实质 grill，2026-07-03 Steven 逐条拍板）

授权：NEXT-SESSION「下一步 B」+ Steven 点单顺序「b再c再a」+ 选型拍板「`wf_publish_states` 忠实装 `buttonState`」（AskUserQuestion 点选，四候选对比证据在场）。飞轮第三条移植：`dom_crud` 余量首条，验证「机制缝递减」假设（第二条 3 缝 → 本条 1 缝）。源材料：`regress_autotest` 的 `wf_publish_states.flow.json` 十步 + `_atoms.ts` 的 `assert.buttonState`/`workflow.publish` 实现知识；两候选零 baton 摸底（`echo_default_on` 实为画布维度错档——测节点抽屉开关、带坐标拖拽、chat 机制零复用，成本双硬缝，见机械决策 M5 纠偏）。

## D1 词表 op 形状（Steven 拍板：收窄 present/absent，后面需要补完整）

`check.mjs` 词表 `buttonState: ['enabled','disabled']` → `['present','absent']`。理由：`IMPLEMENTED_KINDS` 是 kind 级不是 op 级——词表留未实现 op，草拟 `enabled` 会过闸进硬断言、评估恒 false = 必假红，D2 soft 机制护不住 op 粒度；词表 = 可草拟 = 已实现，才诚实。schema `assertionOp` enum 最小涟漪：+`present`（`absent` 字符串已在，`textHidden` 在用）；`enabled`/`disabled` 字符串留 enum 不删（已冻、无冻结用例引用、留位后补）。

**挂账（Steven 明令「后面需要补完整」，不许静默丢）**：`enabled`/`disabled` 两 op 随 `publish_blocked` 维度契约带着实现一起回归词表（届时采集侧补 disabled 态采集）；记 prd observability + HANDOFF 挂账。

## D2 按钮命中采集通道（Steven 拍板：role 必采 + profile 可选补采）

镜像 `noErrorToast` 双通道先例：`buttonHits[name]` = `getByRole('button', { name, exact: true })` 计数（必采）+ `profile.buttons.extraSelector` 可选补采通道命中合计；`present` 合计 >0、`absent` 合计 ===0、缺采集 = 证不出（`undefined` → ok:false + actual:null，护栏 #14）。

- `absent` 是本 kind 唯一有 fail-open 风险的方向：真机 div 假按钮若在 role 盲区，计数 0 会假绿（catalog 五雷 #⑤ 同源风险）。防线：真机 bring-up 只读探针必验编辑器顶栏按钮 role 可达性（regress 2026-06-08 真机确认过、按「二手结论标日期重验」纪律重验）；发现 div 形态即配 profile 补采选择器，零机制追加。
- 双侧同构（采集器同构纪律）：`compile` 侧代表步 `capture()` 对称采 `buttonHits` 回填观测现状，供草拟骨架映射与人签对照。

## D3 nl-steps 差（Steven 拍板：补进重表达）

源 flow 的 `nl` 说已发布态「无发布按钮」，steps 无此断言。重表达以 `nl` 业务语义为源（catalog「7 步重表达 4 intent」先例），补 `buttonState(发布, absent)` 进已发布态断言组；`exact: true` 防「取消发布/重新发布」类子串按钮误伤（误伤方向是红不是假绿）；终抉在 Steven 人签 expected 时，签署停站可剔。

## 机械决策（可否决，Steven 未否决即生效）

- M1 用例名 `tc_wf_publish_states`，channel `web`；profile 复用 catalog 剖面形状（`routes.workflowList` + 背景 denylist + 信封 successField），无 chat 段；`profile.buttons.extraSelector` 为本轮新增可选键（非凭据：纯选择器，同 profile 既有定位约束）。
- M2 uniqueName 纪律省掉源 flow 的预清理 `deleteByName`（catalog 先例：建删同名唯一实体、尾部删除即净场 + 计数对账）。
- M3 schema 涟漪最小化：`assertionOp` enum 只 +`present`，`prd-seams-freeze` checksum 重签 + 其 gate 复验 GREEN（p4-drafter 双 enum 对齐先例）。
- M4 `workflow.publish` 编译知识照 `workflow.save` 形状（单击「发布」role button exact），不强断后置（regress 同款：完整=发布成功、不完整=校验拦，交断言判）；发布后状态翻面的有界等待细节在 plan 定。
- M5 文档纠偏随本契约落：`docs/FLYWHEEL.md` 与 `CONTEXT.md` 的 chat 条目移除 `echo_default_on` 语料引用、注记实为画布维度（本次摸底实证：测画布节点配置抽屉开关默认态、`workflow.addNode` 带落点坐标、不走测试面板/SSE）。
- M6 hermetic 夹具留对抗场景位（chiefcomplaint learn #3）：非按钮元素带同名文本（探 role 通道界限、防文本通道混采）、多匹配同名按钮、发布后按钮群翻面、div 假按钮 + profile 补采通道（钉 D2 双通道语义）。

## R1 修订（codex 异构评审采信，2026-07-03，D2 内 fail-safe 收紧、不改 Steven 拍板）

- F1（High 采信）：`absent` 判真加「通道活性反证」——同刻全通道可见按钮总数 `buttonSeen`>0 才可判「不存在」；
  role 盲区页（div 假按钮 + 未配补采）seen=0 → 证不出。残余缝（同页混合元素形态：他钮 role 可达、被断按钮
  是 div）仍由真机探针 + 补采配置流程防线兜，记 observability。
- F2（High 采信）：补采通道只数可见节点（`getClientRects` + `visibility` 过滤）——隐藏模板节点不计数，
  role 通道走可达性树本无此缝。
- F3（Medium 推测，部分采信记档）：真机异步翻面可能造 false-red（fail-safe 方向非假绿；代表步静默点
  本有 DOM 稳定等待）——随真机停站实证，频发再议加法，不动机制。

## 冻结涟漪盘点（accept 红先行逐核）

- `IMPLEMENTED_KINDS` 10→11：精确计数「最新前沿 golden 持有」纪律（kinds-harden→chiefcomplaint 移交先例）——`chiefcomplaint` golden 若钉 `===10`，计数钉移交本契约 golden，旧 golden 改下界或集合断言，涉冻结文件补冻。
- 「`buttonState`/`switchState` 未实现范例」：kinds-harden 轮曾把冻结 golden 的未实现范例换成这两个——`buttonState` 本轮实现，引用处 accept 期跑出来逐个补冻（范例换 `switchState`/`inputReadback`）。
- `check.mjs` 词表收窄（enabled/disabled 暂出）：若有 golden 钉「buttonState 允许 enabled」类词表形状，accept 期核出补冻；schema enum 不删字符串、方向加法。
- `expected-frozen.schema.json` +`present` → `prd-seams-freeze` 重签、gate 复验。
- 术语：零新造词（`buttonHits` 是代码标识符；按钮命中采集属「静默点」采集既有定义的实例；「通道剖面」既有术语覆盖 `profile.buttons` 段）。
