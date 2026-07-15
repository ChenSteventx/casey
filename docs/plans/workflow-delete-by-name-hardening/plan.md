# workflow-delete-by-name-hardening 计划

## 目标

加固现有 `workflow.deleteByName`：把全页文本点击收紧为目标 table/card 记录域锁与唯一可见确认弹层域锁，加入物理身份连续性重验，使编译与回放在相同 DOM 上给出相同动作轴。根线程负责 intent 内事件失败折叠；本契约不碰 `bin/replay.mjs` 或 `bin/verdict.mjs`。

## 非目标

- 不新增删除原子或同义别名。
- 不手改冻结 expected；cleanup 断言只经人签工具按真实 build 重签。
- 不修改 events schema、断言评估器、裁定树或 loop 编排机制。
- 不把视觉判断当机器裁定。

## 改动

1. 新建 `lib/workflow-delete-domain.mjs`：
   - 读取唯一搜索框当前非空值；
   - 精确目标 table/card 容器扫描、物理去重、即时 pin；
   - 域内唯一“删除”与唯一可见确认弹层绑定；
   - 动作前四重物理重验，`finally` 清 pin/句柄；
   - 返回标准动作轴，所有异常 fail-safe。
2. 修改 `lib/replay-actions.mjs`：仅 `workflow.deleteByName` 的 click 走共享模块；其它动作零行为差。
   删除与确认 click 复用 events schema 既有 `value` 携目标名模板；旧 spec 缺绑定时拒点并要求真机重编译，禁止从搜索框残值猜目标。
3. 修改 `lib/compile-atoms.mjs`：
   - `auditDeleteCount` 表格计数限定精确目标行；
   - 删除触发与确认均调用共享模块；
   - `customAct` 可回填结构化动作轴；
   - 证不出确认目标时停止剩余删除链并记录 blocker。
4. 修改 `lib/atoms-registry.snapshot.json`：保留原 atom id，文案改为 cleanup intent 失败不假 PASS。
5. 禁令前形成的 HTML fixture 与两份金牌只保留为源码历史，不再运行、不作为验收证据，也不进入本次实现提交。
6. 三案 profile 使用本轮真实 replay 实体 `atl_r1` 的精确卡片计数；cleanup 断言由 Steven 按真实 build `1.1.2` 重签。
7. 完成标准只认真实 Heren 三条串行链：新实现真机重编译后回放，逐案确定性 verdict、同次录屏、视觉复核、独立 HTML 与附件齐全；本地 fixture 只记实现前历史，不再执行且绝不作为完成证据。

## 验收点

### S1 目标记录与确认弹层域锁

- C1：全页有 5 个“删除”，目标卡内仅 1 个，只删除目标、干扰项保留。
- C2：精确目标容器为 0 或 2 时分别返回 `none`/`ambiguous`，DOM 零变更。
- C3：唯一可见弹层内确认按钮与域外同文案按钮并存时，只点弹层内按钮。
- C4：可见弹层为 0 或 2，或域内确认按钮不唯一时，零落笔。
- C5：扫描后、点击前目标记录或 pin 被替换/复制/搬移，返回 `action_failed`，不点后来者。
- C6：表格与卡片布局都能精确锁定目标，隐藏同名节点不计。
- 真机验收：发布、历史、CRUD 三案重新 compile 均 0 blocker，目标卡片与域内删除按钮均为 1:1；正式 replay 中 cleanup 的 7 个事件全部 `unique`，删除触发与确认点击均通过身份回读。

### S2 编译、回放、计数与注册表

- C7：`compileFlow` 对删除原子产原有 7 个事件，编译动作全 `unique`；计数审计只数目标记录；回放 `performAction` 对同一 fixture 给相同结果。
- C8：`countChange equals 0` 在删后计数 0 通过，拒删后计数 1 不通过；profile/断言候选形状准确但保持未签。
- C9：registry 仍只有 `workflow.deleteByName`，编译原子总数不增加，不出现 delete 同义原子。
- 真机验收：三案重编译后的两个删除 click 均携目标名；精确目标计数 `countChange equals 0` 全通过，最终独立只读探针确认 `atl_r1` 精确残留为 0；registry 仍只有原 `workflow.deleteByName`。

### S3 回归保护

- 实现文件 `node --check` 与 `git diff --check` 通过。
- 发布、历史、CRUD 三条真实回放分别为 4/4、8/8、4/4 `PASS`，均为 0 `SUT_DEFECT` / 0 `HARNESS_ERROR` / 0 `NEEDS_HUMAN`。
- 每案独立 HTML 均含自然语言用例、原子操作、同次录像、附件总表、视觉复核和清理证据；三份 `verify-zero-error-report` 均 exit 0。
- fake-SUT/fixture 只允许读源码，不运行、不作为任何完成证据。

## 可观测性

- 已完成：Steven 按真实 build `1.1.2` 重签三份 frozen expected。
- 已完成：发布、历史、CRUD 三条真实链串行复跑；每案 cleanup 事件全 unique、删后精确计数为 0、独立只读残留探针为 0。
- 已完成：每案独立 HTML、同次录屏、附件和视觉复核齐全；视觉只写 `verdictImpact=none`，不修改 verdict。
- 仍待：合入主干前做一次跨族只读实现评审；不影响本轮真实 UAT 证据，但属于开发合并门。

## 风险与停止条件

- 破坏性动作若不能证明目标记录与确认按钮归属，立即零落笔并 route:human。
- 共享 helper 若迫使改 events schema、裁定内核或 `bin/replay.mjs`，停止并升级根线程裁断。
- fixture 只能验证 Casey 引擎，不得冒充真机完成；gate 绿仍需人签真机 UAT。
