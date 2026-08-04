All checks complete. Review summary:

---

# 评审结论：p9-replay-ref-rebuild（快照 9e85c69，基线 96f6107）

## 逐风险核验

**1. 冻结金牌一字未动 — PASS**
`git diff 96f6107..9e85c69 -- tests/_golden/destructive-continuity-ref-rebuild.red-acceptance.golden.mjs` = 0 字节；sha256 = `238215d021c4b9ec3ca2f7f2dca52a14cbb517c3cd93df056404a25d8375e88e`，与冻结值 238215d0… 完全一致。

**2. fail-safe 属性（I1–I8 无 fail-open 缝）— PASS**
在 /tmp 副本变异锁件独立实测 **8 例负探针**（含任务要求的 3 例），全部 `exit 65` + 具名拒因 + 哨兵缺席：

| 探针 | 变异 | 结果 |
|---|---|---|
| p1-dup | 一步两条边 | 65 + `DESTRUCTIVE_CONTINUITY_DUPLICATE_STEP` ✓ |
| p2-fkey | observationEvidenceStepId 指向不存在的观察 | 65 + `OBSERVATION_REF_MISMATCH` ✓ |
| p3-empty | `destructiveContinuity: []` | 65 + `NO_SIGNED_CONTINUITY_REF`（漏授权 fail-closed）✓ |
| p4-typeerr | stepOrder 字符串化 | 65 + `FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID` ✓ |
| p5-samename | 同名两条观察（不同 platformId） | 65 + `OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME`（绝不取 first）✓ |
| p6/p7/p8 | 位序/意图/步不存在 | 65 + 对应 I6/I7/I1 拒因 ✓ |

结构审计：ref 只由**签名验证过**的观察行铸成（`mintDestructiveTargetContinuity(picked.observation,…)`）；边上自报字段仅用于对账（I4 外键、I5 platformId），比对通过后不使用；指纹门（`lockDigest !== liveDigest → exit 65`）位于重建块之前；签名算法覆盖 `destructiveContinuity` 段；v1/v2 锁携 v3 字段会被闭合面判非法（fail-closed）。

**3. v1/v2 兼容面 — PASS**
分支被重构（`fields` 变量 / `hasIdentityFace` / `observationFields` 间接层）但逐项语义等价：同一字段集、同一校验序、同一 `ROLES` 门。行为等价由门禁实证：S2 动态 ID 八枚、S3 守卫家族三枚、S5 回放消费者十一枚、R1 v2 锁全绿。

**4. R4 补笔 — PASS**
拒绝行只在输出上投影「仍未获授权的破坏步」清单（`pending = destructiveStepIds − 已铸 ref 步`），裁定路径零改动（违规边处即 exit 65）。金牌 R4 断言 `atstep_4` 点名通过。

**5. 准入门与诚实边界 — PASS**
`lib/entity-destructive-continuity.mjs` 不在本 commit 改动面（diff 7 文件内无它）——`admitDestructiveTargetContinuity` 语义零改动。import 拆成单行是为满足 round-2 冻结金牌 E1 的静态咬合（实测 E1 ok）。evidence.md §8 与 PRD observability 三处 `route:human` 如实挂账，无「破坏链已闭」夸大。

**6. PRD 账本 — PASS（含一条 Medium 注记）**
独立重跑 `node ../loop-kit/bin/gate.mjs --prd loop/prd-p9-replay-ref-rebuild.json`：**GREEN —— story 6/6，exit 0**。testChecksums 与实物一致（金牌 238215d0…、red.txt b37dfb15… 均复算吻合）。

**7. 基线 8 枚红 — PASS**
逐枚实跑，红计数与红因与 evidence.md §7 逐条一致：crosskind 7/1(X3)、round2 12/2(D2+E2)、round3 8/2(R4a+R5c)、round4 7/2(H4d+M)、wiring 10/2（红点子断言按 evidence.md 所披露后移至「replay 未调用出站拦截安装器」，红/绿状态与计数不变）、p9-tier2-selftest 109/2(T7+T9a)、agent-id-regression-diff 1/21(R13 字节棘轮)、chiefcomplaint-v2-successor(ENOENT events.json)。未增未减、未擅改他家金牌。

## Findings

- **[Medium] S5 门禁一次瞬时转红未入账**：评审开始时工作树 PRD 携带提交后的重跑（01:47–01:55）记录 `S5-replay-consumers: passes:false, evidence:""`——与快照内账本（01:10 全绿）及 evidence.md「6/6 过」相悖。我的独立重跑 S5 十一枚全过，故属瞬时（teachin-runtime 金牌环境敏感），但签署前建议留一次全绿实跑记录，且后续盯 S5 稳定性。
- **[Low] 「v1/v2 分支逐字未动」措辞过强**：GRILL D7 与 PRD task 声称逐字，实际为语义等价重构（字段集/校验序逐项比对一致，零行为漂移，且被门禁全量实证）。仅措辞问题，不影响裁定。

未发现 Critical / High。

仓库仅剩的改动是门禁运行对 PRD 账本的 evidence 写入（评审要求重跑的既定副作用，与实现者自身工作流一致）；探针夹具与 scratch 已全部清理。

VERDICT: APPROVE
