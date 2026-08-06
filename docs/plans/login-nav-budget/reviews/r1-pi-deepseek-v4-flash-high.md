## 评审结论 · login-nav-budget（HEAD `2e3534b`，基线 `158829d`）

### 复核实证（全部独立重跑，工作树只读、实验均在 /tmp）

| 核验项 | 结果 |
|---|---|
| 变更面 | `git diff 158829d..2e3534b` 恰 5 文件（lib 一行+注释 / 金牌 / plan / red-proof / PRD），白名单外零改动，HEAD 确认 |
| Risk 1 天花板语义 | `timeoutMs` 全 8 个消费点逐点核对（goto `:103`、表单 waitFor `:114`、fill×2 `:127/:134`、click `:141`、detached/hidden `:143-144`、loadState `:145`）——全部是 Playwright `timeout` 选项，纯上限；`:112` 的 3s 表单窗是硬编码常量未动；全仓零调用方覆盖（compile:324 / replay loginPrep / record:339 / 双探针 / teachin seam 全确认） |
| Risk 2 失败路径 | 目标不可达：goto 30s 拒→立即 `NAVIGATION_FAILED` 返回，compile 看门狗 120s（`compile.mjs:267`）、replay 看门狗 120s（`replay.mjs:106`）、chief/gate `commandTimeoutMs` 300s——主失败路径无挤压 |
| Risk 3 判别力 | 20s ∈ (15,30)：绿跑实 20.05s 落在 [20s,28s) 窗（既证 20s 载入真发生、又证非等满 30s 预算）；红基线 15s 整拒 |
| Risk 4 替身形态 | 全链路手推：direct 模式 policy 对 `sut.invalid` 通过 → origin 连续性过 → 走 `lib:108-119` 非登录路径+表单缺席支 → `loggedIn:true, viaForm:false`；哑元凭据结构性不可消费（若回归误入表单支，替身 fill/click 抛 'no form on page' 只会红、不会假绿） |
| Risk 5 红证/sha256 | 自算三条 sha256 与 PRD `testChecksums` 逐字节一致（`beef3e2a…/710265e4…/434b1ba8…`）；/tmp 还原 15000 实跑：S1 `{"reason":"NAVIGATION_FAILED"}`、S2 ok、S3 `15000`、1/3、EXIT=1，与 red-proof 逐串同款 |
| Risk 6 凭据/输出面 | 金牌零真凭据（dummy-user/dummy-pass）、`sut.invalid` 夹具地址、零 `.auth/`/`site.json` 读取；S3 只读 lib 源码 |
| 邻接 | seal / anchor-wait / crud-import 金牌全 exit 0；term-lint --registry 与 selftest --tier1 GREEN（/tmp 首跑 exit 64/1 系 loop-kit 兄弟包缺失的 shim 降级伪影，`LOOP_KIT_PKG` 指真包后全绿） |

### Findings

**[Medium] `lib/login-bootstrap.mjs:143-145`（连带 `:127-141`）——提交后提交完成段被吞等待随预算翻倍，复合挂死序列可顶穿 120s 看门狗、绕开登录失败密封——建议：三段被吞等待（detached→hidden→loadState）从导航预算解耦，改为固定上限（如各 15s），或给 compile/replay 登录阶段设独立预算。**

细节：主失败路径（目标不可达）30s 干净返回，plan 的「仍远在 120s 窗内」对它所声明的场景成立。但 `:143-145` 三段是 `.catch` 吞掉的**成功路径稳定等待**，非失败路径；它们随 `timeoutMs` 一起 15→30。最坏复合序列（慢 goto 30s + 表单迟到 30s + 提交后表单 60s 不 unmount + SPA 无 load 事件 30s）从修复前 ~120s（恰压看门狗边）翻到 ~240s——compile `:267` 的 `process.exit(1)` 在 loginBootstrap 中途触发时**不写 compile-report.json**，绕过 `:336-341` 的 gatedWrite 密封（replay 侧同样 `:106` 强退）。触发需多重病态挂死叠加、概率低，且方向是 fail-closed（exit 1，不会假 PASS），故定 Medium 而非 High；但密封契约是既有显式承诺（compile-execution-failure-seal 金牌），此边界值得按上述解耦钉死。

零 Critical / 零 High。

**非正式备注（低于报告门槛，不构成 finding）**：
- S2 测试名与 plan 均写「<3s」，断言实为 `<6000`（预留 3s 表单窗，而替身 waitFor 立即抛、窗根本不被消费，实际耗时毫秒级）——名实不符仅文面，断言本身足够紧。
- S1 注释「约 20s+表单窗 3s」同理，替身不消费表单窗，实测 ≈20s，断言窗仍正确。
- plan 的 `:83/:101` 行号是基线期指位，HEAD 因加注释移为 `:85/:103`，历史引用无碍。

### 总评

一行天花板提升精准命中实测竞态（13.8–14.9s vs 15s），天花板语义逐点核实成立，金牌三钉判别力真实（绿/红双态均实证）、红证可复现、sha256 三/三对账、凭据面干净。唯一 Medium 是复合挂死下看门狗/密封边界的恶化，属推荐加固而非阻断缺陷。

```
IMPLEMENTATION_VERDICT: APPROVE
```
