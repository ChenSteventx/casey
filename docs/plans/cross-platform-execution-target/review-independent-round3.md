# cross-platform-execution-target 第三轮独立 release-ratchet 复核

- 复核日期：2026-07-27
- 复核方式：只读检查与本地零 SUT golden/ratchet 执行
- 总结论：**CHANGES_REQUIRED**

实现与专项验收测试均为 `PASS`，普通 compile error 的分类与脱敏修复也已通过契约测试；但发布状态仍有两项未闭环：

1. `loop/prd-page-topology-auth-continuity.json` 的 6 个 story 仍全部是 `passes:false`，尚未由正式非 dry gate 写入通过状态。
2. 仓库级 ratchet 仍报告 4 个既存 checksum/conflict 问题。

因此本轮不能把专项测试全绿直接等同于 release ratchet 全绿。

## 1. 专项门禁结果

| 范围 | 结果 | 结论 |
|---|---:|---|
| agent-id regression diff | 21/21 | PASS |
| output-seal | 27/27 | PASS |
| cross-platform core/runtime/login-origin/boundaries/adjacent/hardening/CLI seal | 37/37 | PASS |
| output-seal B5 prelaunch | 1/1 | PASS |
| page-topology controller/delayed-popup/session/pipeline/replay-action/boundaries/adjacent | 37/37 | PASS |

所有上述命令退出码均为 0。

## 2. 两份 PRD 的 checksum 与 story 状态

| PRD | checksum | story 状态 | 结论 |
|---|---:|---:|---|
| `loop/prd-cross-platform-execution-target.json` | 12/12 匹配 | 7/7 `passes:true` | PASS |
| `loop/prd-page-topology-auth-continuity.json` | 13/13 匹配 | 0/6 `passes:true` | CHANGES_REQUIRED |

两份 PRD 的 `gate --dry` 均通过 checksum ratchet 与终止条件检查。page-topology 的验收测试已经全绿，但 dry gate 不会写回 story 状态；其 6 个 story 仍为 `passes:false`，所以发布状态尚未完成。

本轮是独立只读复核，没有运行会修改 PRD 的非 dry gate。

## 3. 普通 compile error 分类与输出泄漏复核

结论：**PASS**。

- execution-target 错误只接受闭合集合中的稳定 reason。
- 已知 execution-target 错误只输出固定、稳定的 reason 行。
- 普通错误只输出固定的 `compile 失败` 或 `compile: 执行失败`，退出码为 1。
- compile 主入口、execute 分支和 verify 子进程失败路径均未透传原始 `message`、`stack` 或子进程 stderr。
- CLI seal 的 R12 用包含 URL host/port/path/query/fragment sentinel 的普通错误验证：没有被误分类为 execution-target，也没有泄漏 sentinel。
- 已知 `NAVIGATION_ORIGIN_MISMATCH` 仍按稳定协议输出，未被普通错误兜底吞掉。

这满足“能确定的走确定性分类；非 execution-target 的任意异常不回显运行时敏感细节”的边界。

## 4. 结构门禁与 diff

`git diff --check` 退出码为 0。

当前两份 PRD 契约范围内的生产文件与 golden 均不超过 600 行；静态 boundaries 门禁也全部通过。抽查的较大文件如下：

| 文件 | 行数 |
|---|---:|
| `bin/compile.mjs` | 598 |
| `bin/replay.mjs` | 580 |
| `lib/page-topology/controller.mjs` | 549 |
| `lib/replay-actions/workflow-drawer.mjs` | 536 |
| `lib/replay/event-runner.mjs` | 518 |
| `lib/page-topology/record-bridge.mjs` | 405 |
| `bin/record.mjs` | 288 |

仓库中仍有不属于本次两个 PRD 契约范围的历史超大文件；本结论只确认当前改动域和对应结构门禁，没有把它扩写成“全仓所有文件均不超过 600 行”。

## 5. 仓库级 ratchet

仓库级命令：

```text
node loop-kit/bin/ratchet.mjs verify --root /mnt/d/ctx/heren/casey --json
```

结果为退出码 1：140 份 PRD、524 个冻结文件、648 个引用中仍有 4 个问题：

1. `tests/_golden/teachin-observation-driver-canonical-root.zero-sut.golden.mjs` checksum mismatch。
2. `tests/_golden/teachin-observation-transaction-root.zero-sut.golden.mjs` checksum mismatch。
3. `tests/fixtures/chat-sut/server.mjs` 在 `prd-chiefcomplaint-smoke` 中 checksum mismatch。
4. 同一 `tests/fixtures/chat-sut/server.mjs` 在 `prd-agent-id-readback` 与 `prd-chiefcomplaint-smoke` 中存在 checksum expectation conflict。

这些问题不属于当前 cross-platform/page-topology 专项实现，但仓库级 release ratchet 仍是红色，因此不能忽略。

## 6. 发布前必须完成

1. 由正式 gate 在共享树冻结后对 `loop/prd-page-topology-auth-continuity.json` 运行非 dry 验收，依法写回 6 个 story 的 `passes/evidence`；不得手改通过状态。
2. 修复或由对应契约所有者正式重冻结仓库级 ratchet 的 4 个 checksum/conflict 问题。
3. 再跑 agent-id 21/21、output-seal 27/27、cross 37/37、B5、page-topology 37/37、两份 PRD gate、全仓 ratchet 与 `git diff --check`。
4. 真实 Windows/macOS/Linux 与真实 SUT/UAT 仍须按发布计划执行；本轮零 SUT 独立评审不冒充实机验收，也不代表用户验收通过。

在以上发布状态闭环前，本轮最终结论保持 **CHANGES_REQUIRED**。
