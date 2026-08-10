# learn —— P9 v3 三例接线链收口（2026-08-10）

本轮把 B 段三例全部推到 v3 三件齐 + 清单换签。真正值钱的不是流水账，是下面这条此前没人识别的
生产接缝，以及它暴露出的一笔工装欠账。

## 一、意图号重绑会静默移动断言求值点（本轮最大发现）

### 现象

`tc_wf_publish_states` 的 B6 断言草案里，同一个意图 `intent_history` 同时出现两条互斥断言：

- `assert.textVisible` 断「创建时间」出现；
- `assert.textHidden` 断「创建时间」离场。

flow 层的时序表达是对的（点开弹窗 → 断出现 → 按 Esc 关闭 → 断离场，断言原子穿插在动作原子之间），
但回放期这两条必然一真一假，无解。

### 机理（逐层实测，不是推断）

1. 断言求值只在意图的**代表步**发生一次，代表步 = 该意图的最后一个动作步
   （`reprStepOf = intentEvents.get(iid).slice(-1)[0].stepId`，`lib/heal/reverify-replay.mjs:122`；
   真回放 `lib/replay/event-runner.mjs:103` 同规则）。断言原子不进 events，不产生步。
2. `textHits[value]` 是「文本 → 一个数字」的平铺映射，同一文本值只可能有一个口径。同意图内同值被
   两向请求时取可见计数（`lib/replay/intent-observation.mjs` 的 `groupTextRequests`，
   assert-visibility-semantics 契约 GRILL D4 定案）。
3. `textVisible` 判 `hits > 0`、`textHidden` 判 `hits === 0`（`lib/replay-assert.mjs:107/122`）。
4. 探针实测：`textHits` 取 0/1/3 三种值，两条断言必然一真一假；缺采集时两条同假。**没有任何取值能让
   两条同时为真。**
5. 真机侧的物理事实早有在案实测：按 Esc 后「创建时间」DOM 命中仍 1、可见命中 0——浮层视觉关闭但节点
   不卸载（assert-visibility-semantics 的 GRILL 与 learn 都记了，且用的就是这个文本值）。

### 根因：不是用例写错，是重绑并粗了意图粒度

对照 `tc_wf_history_version` 的旧 events：意图号是编译器局部编号 `intent_0..intent_6`，每个动作原子
一个意图，点开弹窗与关闭弹窗**分属两个意图**，所以断言采样发生在弹窗开着时，它的绿是真的。

而 `tc_wf_publish_states` 的 events 意图号已是 authored 的 `intent_create/intent_publish/
intent_history/intent_cleanup`——这是 `compile-intent-lineage-rebind` 契约（标准路径意图号逐步重绑）
的产物。重绑把意图粒度从「每原子一意图」并粗成「authored 意图」，`intent_history` 因此横跨点开与关闭
两个动作步，代表步被推到关闭之后。

**重绑契约当初解决的是出处链闸的命名空间错配，没人意识到它同时移动了断言求值点。** flow 语言仍然允许
「动作 → 断言 → 动作 → 断言」的意图内交错，编译门照收（`gate.ok: true`），但求值语义已经和 flow 时序
表达的不是一回事。这是表达力回退，且回退是静默的。

### 一条可直接用的表达规则

**一个意图只能有一个求值时刻，所以一个意图里不能有两段需要分别求值的断言。**

本轮三例里只有弹窗类意图违反了它：其余意图都是「动作 → 断言」单段结构，代表步天然落对。

### 本轮怎么处置（Steven 2026-08-10 两裁）

- `tc_wf_publish_states` 走 B：两条正向断言移进草案 `pending[]` 并写明理由（`route:human` 留痕、
  不静默删），只签 `textHidden` 关闭效果；因 `pending` 非空，B8 须带 `--force` 并产出留痕旁车。
  代价：本例正向覆盖暂缺，零额外真机行程。
- `tc_wf_history_version` 走拆意图正确表达：它三件全无、本来就要跑一趟真机，把用例表达写对是零额外
  代价。原四意图拆成七意图，每个意图一个求值时刻；顺带把原本无断言覆盖的两次关闭动作补成
  `assert.textHidden`，**套件层覆盖净增两条**。真机第二十一跑 exit 0 验证通过。

一个反直觉的细节：拆意图后新增的 `assert.textHidden` **必须带 `entityBindings`**。起初按「断言原子不该
凭空增加观察义务」的保守直觉没给它加绑定，结果 `requiredFlowEntityBindings` 直接拒
（`ENTITY_BINDING_REQUIRED_ROLES_INVALID`）。判据在 `inspectOperationBindings`：read 效应原子**不许带**
非空绑定，mutation 效应原子**必须带**。`assert.textHidden` 属后者。`tc_wf_publish_states` 的 flow 给它
加绑定不是人工偏好，是硬要求——照先例抄比按直觉推更可靠。

## 二、工装欠账（本轮只登记不做，须另立契约）

**编译期加一道「意图内断言步之后还有改状态动作步」的前置检查，命中即 blocker，提示拆意图。**

- 为什么值得做：这次是跑完真机、进到人签门口才发现的。lint 能把这类缺陷拦在真机行程之前，
  而一趟真机行程的代价是真建真删加人在场。
- 为什么现在不做：它碰编译门（强制层），按 ADR-0008 属 kernel 级治理，须另立契约走双设计审 +
  异构冗余 + 人签，超出本轮活契约范围。
- 覆盖面提醒：`tc_wf_history_version` 已按新表达修好，但**任何仍是「点开→断言→关闭」同意图形状的
  用例，下一次用现管线重编译都会踩同一个坑**。lint 落地前，改弹窗类用例务必先按上面那条表达规则自查。

第二笔（较轻）：`tc_wf_publish_states` 的拆意图重表达记欠账，待下次该例 anyway 要动真机时搭车做，
不为它单独付一趟行程。

## 三、几条小账

- `SIGNING-SESSION.md` 的 B6 命令行写了 `--testcase`，但 `casey draft` 根本不吃这个参数，传了会触发
  TestCase 归一闸而拒（三例的 testcase 都是 `channel` + `intents` 形态，过不了 `parseTestCase` 的
  `source` + `steps` 契约——这是既有状态，不是本轮改坏的）。跑 B6 别带 `--testcase`。
- `readCreatedWorkflowOwnershipAuthority` 必须传 `caseId`，漏传会得到与「件坏了」难以区分的失败。
  本轮一度以为首例那份 08-07 已签、且第十九跑真机回放消费过的件失效了，实为调用形状不对。
  **承重结论下判前先怀疑自己的调用姿势。**
- `tc_chiefcomplaint_smoke` 的 `CHIEF-EVENTS-MISSING.md`（08-04 08:18 编制）已被超车：08-04 09:46 有
  一次成功真机编译把五件成组产物全带回来了，13:31 还签了 expected 与实体锁。清单里那条「events 哈希
  失配」不是文件被改坏，是用例已重编译重签、清单没跟上。**读考古文档前先核 mtime 与现场。**
