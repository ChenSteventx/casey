全部邻接金牌绿。总结完整评审结果。

---

## 评审结论 · wf-open-readback-requery R1

### 取证记录

| 检查项 | 结果 |
|--------|------|
| `git diff HEAD` 干净 | ✅ 空 |
| `git rev-parse HEAD` | `85642adabe7158ce2f411dfacb26f174ce5f305d` |
| 验收金牌 | **20/20 绿**（S1 时序/S2 fail-closed/S3 裁定同门/S4 零漂移） |
| PRD sha256 三文件 | **全部匹配**（金牌 `9a6cd0fa`、plan `29974028`、红证 `4c3dd2b2`） |
| 红证复现 | 旧实现对 S1/S2/S3 全红（11 RED）、S4 全绿——红先行成立 |
| 邻接 wiring | 18/18 绿 |
| 邻接 cardinality-reverse | 18/18 绿 |
| 邻接 search-first | 5/5 绿 |
| 邻接 preface-notes | 4/4 绿 |
| 邻接 post-nav-anchor-wait | 5/5 绿 |
| 邻接 sleep-import | 4/4 绿 |
| 陈旧红 arming.static | 0/7（与基线 `8d0e6e3` 文件字节全同，未更红） |
| 陈旧红 searchopen | 文件字节与基线全同，未更红（需浏览器，非本契约债） |
| `armWorkflowSourceReadback` 外部引用 | 零（全仓仅本文件内出现，改为非导出无断裂） |

### 风险清单逐条

1. **未声明身份通道路径零漂移** → **过**。非声明分支（`identityLedger` 缺席）events 序列、emit 参数、`waitForURL` 后置与基线逐字节等价。S4 金牌 5/5 全绿自证。

2. **扫描证据替代信封 fail-safe** → **过**。所有失败路径：`fetch` 失败→`scan-failed`→`action_failed`；不完整→`incomplete`→`action_failed`；零命中→重试（列表尾巴）→最终 `absent`→`action_failed`。同名多行→`.some()` 命中即 break→`resolveDualIdentity` 走 `ambiguous`。全路径闭入 `action_failed` 或 `ambiguous`，无 fail-open 缝。

3. **`resolveDualIdentity` 输入投影** → **过**。envelope 投影 `{status:'ok', rows, total}` 字段名与判定表逐字对齐（`rows[].id/code/name`、`sameName.filter(row=>row.name)`）。DOM 投影 `{status, name, code}` 与 agent 侧逐字同款（`container-out→'failed'` 映射一致）。`expected.code` 条件实例化与 agent 侧完全一致。

4. **TOCTOU 与句柄生命周期** → **过**。`clickAgentCardWithin` 重验 `isConnected`+`getClientRects`+`name`+`code`，四门全过才点。card dispose：唯一路径失败时在 `resolveWorkflowOpenSourceIdentity` 内 dispose 后 `return null`（不进入 caller try）；成功路径由 caller `finally` dispose。无双释放、无泄漏。

5. **观察归档链** → **过**。`pendingIdentityObservation` 形状 `{matched, evidenceStepId, kind, sourcePath}` 与旧实现逐字段同。`evidenceStepId` 恰为终端 click 步 `r.stepId`。`compileFlow` 归档逻辑（provenance join、基数门、kind/sourcePath 泛化、blockers 中止清空 pending）与 agent 侧共享同一代码路径。S1e 金牌全字段钉死。

6. **新提前 return 结构影响** → **过**。`compileWorkflowOpen` 在身份通道声明时新增 `if(...){...return;}` 块；未声明路径的原有 `const r = await run.emit(...)` 代码逐字节不变。同文件其余原子（`addNode`/`connectNodes` 等）零修改。原 `export async function armWorkflowSourceReadback` 改为 `async function resolveWorkflowOpenSourceIdentity`（非导出），全仓零外部引用。

7. **金牌质量** → **过**。S1-S4 四钉覆盖时序、fail-closed、裁定语义、零漂移——断言全具名、mock 严格（毒账本哨兵不触碰即炸）、覆盖正常/零行/同名双行/DOM 缺席/未声明五场景。红证对旧实现 `8d0e6e3` 下真实 exit 1（11 RED），突变闭环用 `git show` 姿势不碰暂存区。

8. **邻接面** → **过**。6 项接缝金牌全绿（wiring/cardinality-reverse/search-first/preface-notes/post-nav/sleep-import）。两陈旧红文件字节与基线全同，未因本变更更红。`bindagent-replay` 需真实 SUT 服务器，不在本只读评审可跑范围（且归属 `entity-ui-wiring` 门面拆分族，与本变更无关）。

### Findings

**Zero Critical / High / Medium findings.**

所有代码路径经逐行复核，与 agent 侧同族门 `compileAgentSearchOpen` 对照无相异语义；`resolveDualIdentity` 判定表一字未改；所有失败路径闭入 fail-closed；句柄生命周期单一路径、无泄漏无双释；非声明路径字节零漂移。

---

VERDICT: APPROVE
PI_EXIT_0
