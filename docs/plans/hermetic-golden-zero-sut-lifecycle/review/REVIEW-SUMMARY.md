# codex 异构评审收口摘要 — plan v1→v8（八轮，2026-07-20）

评审家族 codex gpt-5.6-sol high（实现家族 Claude），read-only 沙箱、全程静态只读、零启动 fake-sut。Steven 2026-07-20 指令：plan 做完及时与 codex 沟通直到达成共识。

**结论：R8 判「v8 可进入 accept，无阻断项」。共识达成。**

## 逐轮收敛

| 轮 | 结论 | 逼出的承重缺陷 |
|---|---|---|
| R1 | 7 条阻断（含 1 Critical） | ① `flow-bridge` 冒充 compile→events 保真基线（实只覆盖 flow-gate 层）② meta-golden 未闭集 ③ D2 散文比对不足、`p2-verdict` 自身缺 `CASE_DEFECT` 分支 ④ output-seal 真假绿点定位 ⑤ 真机后继只留字符串=vaporware ⑥ p5 全 story 翻 false 造新假红 ⑦ 清点靠 grep 不完备 |
| R2 | F2 消解，余 5 | 混合金牌远不止两个（settle-mount/publish-states/chiefcomplaint/regress-promptset/report-diagnostics 皆是）；矩阵自称闭集、删行仍全绿；manifest 无人消费；**全 PRD acceptance 反向引用未扫**（多 story 混引待墓碑+存活覆盖）；扫描器同源自证 |
| R3 | F4/F6/F7 消解，余 2 | v3 闭合公式自相矛盾（`fake-sut ⇔ 全 matrix` 与 `matrix.keys === 全 obligations` 不可兼得）；manifest/story 双状态源 |
| R4 | 表面矛盾消解，余 4 | 闭合的是裸目标集非带血缘边（同分区换线可逃逸）；`--sut` 值污点非「实际依赖活 SUT」充分条件（record-capture/cli-mcp-face 反例）；receipt「有效」无可执行定义；迁移门自身未冻结 |
| R5 | 2 条消解，余 3 | unit 分区 obligations 端产不出边、`unitCheckId` 会跨文件碰撞；receipt/ledger 定义不足 |
| — | **Steven D7 裁决** | receipt/签名/触发/ledger 迁移机制**延给 `real-uat-attestation` 后续契约**（仓内可信 signer 未落地、真机本轮不实跑）；移交覆盖改 loop-kit `observability` route:human + 冻结 manifest 精确账 |
| R6 | unit 边消解、D7 成立，余 1 | manifest 血缘载荷未进机械 join（固定 ID 下交换两 case 载荷可逃逸） |
| R7 | 血缘修充分，余 1（新引入） | v8 前把 R6 的「散文机械验」与「只认结构化指针」二选一**抄重**，自相矛盾 |
| R8 | **可进 accept，无阻断** | — |

## 沉淀的承重教训

1. **异构评审对设计同样挣钱**（非只对代码）：R1 的 Critical（`flow-bridge` 冗余高估）与 R2 的「混合金牌整文件墓碑会删有效 zero-SUT 覆盖」，Claude 自审都没逮出——前者我自查逼近、后者完全漏。
2. **闭合要闭「带血缘的边」，不是裸目标集**：集合相等挡不住同分区换线；ID 相等挡不住固定 ID 下换载荷。每层都要投影等式 + 交换类 mutation 红证。
3. **每引入一个新机制，就引入一批必须闭合的新义务**：v3 加 manifest→双状态源；v4 加 receipt→无可执行定义；v5 加 ledger→无 schema。**要么完整定义、要么诚实延给后续契约**（D7 走后者）——半套机制比没有更危险。
4. **抄评审开的「二选一」方子别两个都抄**（R7 实证）：会造自相矛盾的验收要求。
5. **值污点 ≠ 效果依赖**：`--sut` 在场不等于真连 SUT（`record --from-events`、hermetic MCP 面皆传 `--sut`），粗判会把存活 zero-SUT 覆盖误送墓碑=覆盖损失。

## 非阻断遗留（accept/实现层 或 后续契约）

- `targetKey` 的 JSON 编码与仓根相对路径形式 accept 时冻死，禁歧义拼接。
- `nlSteps`/`invariant` 的语义质量由 manifest 人签负责（机器不裁）。
- receipt、可信 signer、触发 registry、append-only ledger → `real-uat-attestation` 后续契约（配合 P4 signerId 落地）。
