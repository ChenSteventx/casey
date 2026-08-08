# 评审提示词 · replay-identity-channel-kind

你是异构评审方，对已提交不可变快照做代码评审。只报 Critical / High / Medium；结论行
`VERDICT: APPROVE` 或 `VERDICT: CHANGES_REQUIRED`，逐条 finding 给文件:行号、严重级、失败场景。

## 仓与基线

- 仓：当前工作目录即契约树克隆（可自跑命令验证）。
- 基线：dev `8d7a7f3`；评审对象 = `git diff 8d7a7f3..HEAD`。
- 背景（按需读）：`docs/plans/replay-identity-channel-kind/GRILL.md`、同目录 `plan.md`。

## 改动白名单（超出即报）

1. `lib/entity-observation-registry.mjs` —— 新纯守卫 `deriveFrozenLockChannelKind`
   （锁行 atom 反查注册表闭集推导 kind；注册表外/混装具名拒）。
2. `bin/replay.mjs` —— ①通道剖面解析块闭集遍历（`ENTITY_KIND_COMPILE_CHANNELS`
   逐段形状律，产 kind→cfg/digest 两映射）②v2 门重写（锁驱动选段→数字段同源比对→
   控制器覆盖步豁免→非覆盖无消费面 kind 具名拒 `IDENTITY_EXPECTATION_CONSUMER_MISSING`）。
3. `tests/_golden/replay-identity-channel-kind.zero-sut.golden.mjs`、
   `loop/prd-replay-identity-channel-kind.json`、`docs/plans/replay-identity-channel-kind/**`。

## 风险清单（请优先证伪）

- R1 agent 家族字节级零行为差：agent v2 锁经注册表推导仍解析 `agents` 段、同 digest
  同期望映射——比对旧路径逐分支（含 agents 段声明但缺 listApi、v1 锁、无锁三退化态）。
- R2 与 compile 的有意分歧（不拒多段声明、锁驱动选段）是否引入静默择一或降级面；
  compile 的「多 kind 声明即拒」约束在 replay 是否有对应保护（锁行混装拒是否等强）。
- R3 裁③豁免判据：`createdWorkflowCovered` 命中（intentId+atom）是否可被锁自报字段
  或 evidenceStepId 伪造牵引（行锚不存在步、锚非终端步、锚 covered 步但行身份是别的
  实体——豁免会不会放过该被双证的行）。
- R4 非覆盖 workflow 行具名拒是否可绕过（部分覆盖混装、agent 行 + workflow 事件、
  evidenceStepId 指向 nav 步等）。
- R5 `:344` v3 判据未动的后果（v3 锁全覆盖组合此后 fail-closed
  `DESTRUCTIVE_CONTINUITY_IDENTITY_CHANNEL_UNVERIFIED`）——方向安全性与披露充分性。
- R6 剖面形状律执法时机分层（agents 段声明即执法字节不变；非 agent 段延迟到锁点名才拒，
  见 `plan-amendment-1.md`）——延迟执法是否引入「锁点名前的静默降级窗口」或与 compile
  执法面的新矛盾；v3 专用最小 workflows 剖面零行为差是否真零。

## 已知挂账（披露，不算新 finding）

- plan.md §2 表 W3 行写「且行被控制器覆盖，孤立数字段门」，实际冻结金牌 W3 走
  无控制器夹具、以门序（数字段门先于消费面门）孤立——金牌为准，plan 已入 checksum
  冻结不改字节，按笔误挂账随下次触碰清。
- plan §1b 执法时机被扫描实证修正（`plan-amendment-1.md`）：非 agent 段延迟执法；
  「段声明非良构 ∧ 锁点名」拒路径暂无 hermetic 冻结钉（补钉须 checksumAmendment +
  人签，挂账待裁）。

## 既有证据（可自行复跑）

- 六场景金牌 exit 0（W1-W5 具名拒 + W6 覆盖豁免抵哨兵，spawn 真 `bin/replay.mjs`）；
  红基线六红（`accept/red-proofs/`）；三把突变闭环（M-a 硬编码回拗 / M-b 豁免放行
  fail-open / M-c digest 跳过——各红、还原 sha256 逐字节同）；邻接七命令全绿；
  全仓串行扫描对基线零新增差异；gate GREEN。

## 禁区

不得读取或回显 `.auth/`、`site.json`、账号、密码、token、真实目标地址。
