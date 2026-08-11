# GRILL —— replay-magnifier-dispatch（回放分发层接通白名单放大镜 click）

## 缝是什么（证据链，三层各自的现状）

同一份「放大镜过滤」契约在三层的落点不一致：

1. **编译模板发射**（`lib/compile-atoms-workflow-crud.mjs:319` 与 `:402`）：
   `workflow.deleteByName` 展开发射两个放大镜 click 事件（删除前真过滤 + 删后重搜），形状
   `{ atom:'workflow.deleteByName', action:'click', fallbackCss:'.hr-input__suffix .search-icon' }`
   ——无文案、无 value。来历：`wf-delete-search-filter` 契约（B4 十一跑实证 Enter 不过滤、
   放大镜才过滤），金牌 S1 以冻结面钉「必须发射」。
2. **回放前置闸放行**（`lib/workflow-delete-spec.mjs:16`）：白名单精确形状（文案 null ∧ value 缺
   ∧ fallbackCss 逐字等于编译器字面）——Steven 2026-08-08 裁，金牌 `delete-spec-magnifier` 冻结钉住。
3. **回放分发层拒点**（`lib/replay-actions.mjs` `performActionOnPage` 的 deleteByName-click 分支）：
   进分支后先要 `value`（目标名绑定），缺即返 `action_failed, candidateCount 0`；放大镜形状恰无
   value → **运行时无条件拒点，从未执行**。这一层无任何金牌钉过。

## 实证（2026-08-10 真机回放 tc_wf_history_version）

- `atstep_16`（删除前放大镜）：run-history 记 `locatorResolution: unique、752ms、actionError`。
  752ms 恰等于事件跑道的 `waitForResponse({timeout:600})` + 150ms 固定收尾——**没点，纯等待**。
- 抽帧（12.85s/12.99s/13.74s）：搜索框已填入目标名、放大镜图标可见、无遮罩，而列表**全程未过滤**
  （6 张卡全在）；删除链是在未过滤列表上按精确名扫描碰巧成功的（目标在第一页）。
- `atstep_20`（删后重搜放大镜）：同型拒点。
- 三例三跑（catalog / publish / history）清理意图全部 `NEEDS_HUMAN(INDETERMINATE)`，
  折叠层（`lib/intent-action-fold.mjs`）fail-safe 正确：任一事件 `action_failed` 即折叠失败，
  末事件成功不得洗白。**折叠没错、前置闸没错、模板没错——洞只在分发层。**

## 为什么昨天的定性（「用例表达层重表达」）是错的

昨天 HANDOFF 与取证文档写「清理意图的代表步是删后复搜、删干净后必然候选 0、PASS 不可达，
属用例表达层」。错在两处：① flow 里清理只是一个零参原子步，复搜长在编译模板里，不是用例作者
写的；② 复搜步失败的直接原因不是「删干净后搜不到」，而是**根本没执行**——同一形状在删除前
那次（目标还在、图标可见）也一样拒点。更正随本契约落档（HANDOFF + 取证文档追加更正节）。

## 修法（Steven 2026-08-11 裁「立分发对齐契约」）

1. 白名单形状谓词收成**单点**：`lib/workflow-delete-spec.mjs` 导出
   `isMagnifierSearchClick(ev)`（判据逐字不变：文案 null ∧ value 缺 ∧ fallbackCss 逐字等于
   编译器字面），`validateWorkflowDeleteBindings` 改为消费它。
2. 分发层接通：`performActionOnPage` 的 deleteByName-click 分支在要求 value 之前先判
   `isMagnifierSearchClick(ev)`，命中即走通用路径（`resolveCandidate` + `gateAndAct`，
   即既有锁定动作门），不入破坏性三 click 的绑定义务。
3. **不动编译模板、不动前置闸判据、不动折叠语义**。三例 events.json 一个字节不变、零重编译
   零重签；修完由通用锁定门真执行放大镜点击。

## 决策点

- D1 谓词单点共享（防两层再分叉）——已由裁定涵盖（选项预览明示「同一谓词接通用锁定执行，三层归一」）。
- D2 范围只修分发层，不顺刀删模板复搜——已由裁定涵盖（备选「顺便连模板也改」未选；复搜在
  分发修好后本就无害：过滤空列表而已，且删它要付三例真机重编译+全套重签的代价）。
- D3 通用路径的执行语义就用既有 `formalActionGate`（resolve unique 才 perform、失败如实
  `action_failed`、绝不谎报）——不为放大镜造任何特殊宽容；它若真点不动，照旧红给人看。

## 非目标

- 不动 `intent-action-fold`（折叠 fail-safe 是对的）。
- 不动编译模板发射面与前置闸判据字面。
- 不做清理意图/用例层任何重表达（publish 拆意图另案）。
- 不碰 `.auth/`、凭据、真实目标地址；本契约全程 zero-SUT，真机验证在合并后另走新票据。

## 验收草案（红先行）

金牌新增（挂 `wf-delete-search-filter` 或新开 dispatch 金牌，accept 阶段定）：
- Ra 放大镜形状 → 分发走通用路径并真执行（mock 页 icon 唯一 → `unique` + acted）。修前红
  （现返 `action_failed`）。
- Rb 形状矛盾不混装：css 对但携 value / 携文案 → 不入白名单支，照旧拒（与前置闸同判）。
- Rc 非放大镜的缺 value deleteByName click → 照旧拒点（既有 fail-safe 不得放松）。
- Rd 单点谓词结构钉：css 字面在 `workflow-delete-spec.mjs` 恰一处定义，`replay-actions.mjs`
  零字面出现（只经 import 消费）。
- 突变闭环：摘谓词共享（分发层自带字面）→ Rd 红；白名单判据反转 → Ra/Rb 红；
  还原 sha256 逐字节一致。
