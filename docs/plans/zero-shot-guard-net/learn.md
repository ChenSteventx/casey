# learn · zero-shot-guard-net

## 本契约沉淀的教训

1. **门禁盲区要用变异实验证明，不能用常驻断言伪装。** 范围 1 对现状零行为差，红证据只能是
   「注入流氓模块→改前全绿/改后五网齐响→还原零差」的变异 transcript；plan 如实写明这一点，
   评审与复核都认可该姿态（红要证明的是洞在，不是接口缺席）。
2. **发现类断言的逃逸面要按文件系统语义逐形状枚举。** `Dirent.isDirectory()` 对 symlink-to-dir
   为假——「无子目录」钉首版被目录符号链接绕过（R1 评审逮到，可复现）。修法把「目录或指向目录
   的符号链接」一律判红，dangling 链接按 fail-safe 归红（证不出不是目录就不放行）。
   枚举清单：真子目录/文件 symlink/dangling symlink/目录 symlink/大小写扩展名——逐条有归属。
3. **软链工装夹具会撞 `sign` 物理项目边界核**（`entity-binding-operability-successor` O1 按设计
   拒 symlink 路径）。工作树缺 `cases/`/`runs/` 冻结件时从主树复制真文件，绝不软链。
   该纠正已回写 typed-progress 的 PRD notes 与 HANDOFF。
4. **`hook-loop-guard` 对工作树 baton 是盲的**（从主树 cwd 解析 ROOT），工作树的阶段互锁实际由
   本树 `contract` 台账保证。既有盲点如实挂账，未在本契约修（属 loop-kit 面）。
5. **收敛五处口径为单一事实源时，并集严格度是承重约束**：新判据必须是现役全部实现的并集
   （未知键、数组形态都不得从拦变放），元钉 N11 直接测 raw 语义、不经归一化链——
   这是前提审 H1 逼出来的写法，防「正确实现下钉子错测形状」。

## 遗留（挂账）

- d3 执行面豁免名单本身无门盯（route:human）；
- `anyUnsupportedScope` 对畸形形状保持返回假（与现役一致），fail-closed 化单独挂账；
- 三处 `container-out` 防御性死代码不删（行为改动须另走红证据）；
- 真实 SUT 是否存在第四类未支持作用域，须真机 route:human。

## 状态口径

本契约是门禁基础设施（静态金牌/元钉，hermetic 本性），状态 = **机器门禁绿**
（gate GREEN 5/5、37 条 acceptance、异构评审终局 `APPROVE`）。它守护的观测链真机面
已有两轮真机实测证据（探针 + 切片 1 实跑）；本契约自身不宣称「通过」级别的真机背书。
