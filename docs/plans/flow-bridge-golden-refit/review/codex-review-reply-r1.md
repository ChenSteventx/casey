结论：FAIL

未修改文件、未复跑任何金牌；仅核对了白名单差异、生产执法点和现成证据。

### 缺陷

- High — 人签证据自相矛盾：[HUMAN-SIGN.md](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/HUMAN-SIGN.md:3)仍明确写“待 Steven 签，签后才全批重签、复 gate”，[同文件](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/HUMAN-SIGN.md:60)仍把重签和复 gate 列为未来动作，没有签署人、时间或决定记录。失败场景：新冻结 checksum 和复 gate 结果被接纳，但后续审计无法证明 ADR-0004 的三项人裁确实发生。

- Medium — s4 不能证明两条恒红 story 已复 gate：[refit-regate-verify.mjs](/mnt/d/ctx/heren/casey/tests/_golden/support/refit-regate-verify.mjs:50)对预期红仅检查 `passes === false`，不检查 evidence 是否晚于红基线。执行账中两条 story 原本已经是 false；即使完全跳过其复 gate，校验器仍会把它们计入“41 过 / 0 败”。因此它只能证明39条绿色 evidence 刷新，不能证明全41条均复 gate。

- Medium — A6 清理存在残留窗口：[cli-mcp-face.golden.mjs](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:350)先直接调用 `publication.cleanup()`，之后才清理 canonical case lease，且前者没有捕获异常。失败场景：临时发布目录因 `EBUSY`、权限或 DrvFS 瞬态错误删除失败时，控制流直接跳出，`tc_mcp_intake_signed` 租约不清理，污染 `cases/` 并令后续运行报 `CASE_LEASE_PREEXISTING`。

### 风险逐条判断

1. 成立。entityBindings 使用生产建造/校验路径；C17 精确断 exit 65、`ENTITY_BINDING_REQUIRED_ROLES_INVALID` 和零落盘。mutant 证据中的金牌及生产文件 sha 与当前字节一致，且仅 C17 翻红。

2. 成立。`CAPTURE_URL_LEAK` 来自 package validator 的 `reviewCapture` 包装；`CRED_GATE_HIT` 来自其 canonical/decode 凭据门，均先于 distill 旧内联门。直调红证命中同一导出纯函数。

3. 成立。四项丢失均明确标为未迁移，并给出机器可执行的接手条件；没有冒充为已覆盖。

4. 成立。B1 的 generation 1 正控、无 loader 零台账变化、带 loader generation 2 三者逻辑自洽，确实保住 MCP intake happy 覆盖。

5. 缺陷。多数租约均有清理结果校验，当前未发现这些 refit caseId 残留；但 A6 存在上述 cleanup 异常导致租约跳过的路径。

6. 成立。`git diff -- lib bin` 为空；生产四文件未改，当前 `lib/flow-bridge.mjs` sha 也与 mutant 证据一致。

7. 成立。白名单测试没有启动、连接或回放 fake-SUT；出现的 URL、`--sut` 仅作为拒绝输入或 argv 映射数据。B3 bootstrap/worker 为零 SUT。

8. 缺陷。mutant 红证有效；但 s4 对两条恒红 story 放水，无法支撑“全41 story 已复 gate”的完整结论。