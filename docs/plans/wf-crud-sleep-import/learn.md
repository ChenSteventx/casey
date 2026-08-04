# learn · wf-crud-sleep-import

## 这轮学到什么

1. **拆文件漏导入已成缺陷类（第三例），普查钉整类封死**。`6f91125` 拆单体
   `compile-atoms.mjs` 连出三例同款（`requestLogPath` → `inspectWorkflowDeleteConfirm` →
   `sleep`）。前两例金牌只封了各自的点位；本例 S4 改为普查钉——扫 `lib/**/*.mjs` 凡裸调
   `sleep(` 必有导入或本地定义，新增文件自动纳入。教训：同缺陷类第二次出现时就该上
   整类普查，而不是等第三次。
2. **失败报告的回退推断字段不能当强证据读**。B4 报告
   `persistentActionStatus=CONFIRMED / recorded-action-succeeded` 曾被交接文档读成
   「最后一次记录动作成功」——实际 `inferPersistentActionEvidence` 扫到**首个** persistent
   原子事件 `acted=true` 即判（首个是 nav）。据此误判「按钮点上了、卡在页面形态」，两个
   候选根因全押在被测方变化上；真根因是工装 `ReferenceError`。读密封失败报告时，
   fallback 推断阶段（`recorded-action-*`）只说明「整轮至少一个持久动作成过」。
3. **密封边界会把代码 bug 化装成页面漂移**。`compileFlow` 把一切异常投影成
   `COMPILE_ATOM_EXECUTION_FAILED`（护栏 #7 正当），代价是 `ReferenceError` 与真页面
   变化同签名。定位这类失败的正确姿势：真组件忠实复现（真 `createCompileRun` + 真登录 +
   全域非读拦截）拿同签名，再绕过密封边界直调原子抓原始异常——两步都零变更抵达被测方。
4. **`eventsEmitted` 是最硬的结构线索**。emit 跑到尾必 push 事件（无论 unique 与否）；
   `eventsEmitted=2` 直接锁死「第 3 次 emit 中途抛或没被调到」，比任何状态字段都可靠。
5. **hermetic 分层绿对 import 缺失不设防**：`node --check` 过（语法合法）、既有金牌夹具
   没造出命中形态就恒绿。行为钉必须真穿到目标行（S2 用调用计数 + 真实耗时双证穿越）。

## 事实更正（随根因入档）

- 2026-07-22 三链全 PASS 是拆分（07-27）**之前**的绿；拆分后 `workflow.create` 从未在
  真机走通过，B4 是首次触发即炸——不是「昨天还好好的」。
- 昨天形状探针建 `atl_shape0804a` 成功不构成反证：探针是手写 UI 序列，不经
  `compileWorkflowCreate`。
