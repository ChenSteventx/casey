# 下一轮 `Codex` 开场提示词

> 用法：把下面代码块整段复制到新的 `lcodex` session。状态事实以实际 `git`、活契约和 `docs/codex/HANDOFF.md` 为准。

## 开场提示词

```text
项目：Casey（测易）。工作目录 `/mnt/d/ctx/heren/casey`，分支应为 `dev`。
你是零上下文接手的 `lcodex`。先只读对齐事实，再恢复 `ratchet-security-revocation` 的设计复审；不要直接改实现。

【先读顺序】
1. `AGENTS.md`
2. `CLAUDE.md`
3. `CONTEXT.md`
4. `docs/codex/HANDOFF.md`
5. `docs/codex/NEXT-SESSION.md`
6. `loop/GUARDRAILS.md`
7. `loop/active-contract.json`
8. 根部 `docs/HANDOFF.md` 与 `docs/NEXT-SESSION.md`，只作 Claude Code 跨 agent 参考
9. `docs/plans/ratchet-security-revocation/GRILL.md`
10. `docs/plans/ratchet-security-revocation/review/grok-design-r1.md` 与 `grok-design-r2-harness.md`

【事实冲突优先级】
实际 `git` 状态与 `loop/active-contract.json` > `docs/codex/HANDOFF.md` > `docs/codex/NEXT-SESSION.md` > 根部 Claude Code 交接。信更晚且有退出码、测试、人签或提交支撑的状态；无法消解就明确交人，不要现编。

【已完成事实】
- `checksum-drift-closure` 已完成：两个普通漏签 SHA256 经 Steven 精确人签，三个 owner/closure gate 均 GREEN；全仓 ratchet 只余两个有意安全撤销 mismatch，预期 exit 1。
- `review-provider-inline-auth-hook` 已完成：hook、settings 与 AGENTS 同义接线；Grok R1 finding 修复后 R2 PASS；golden 6/6、gate 1/1、tier1 GREEN；最终 checksum 已由 Steven 批准；六阶段全 done。
- （2026-08-10 刷新）`dev` 已推进至 `269e121`：08-06/08 十六契约入 dev，B 段首例完成闸已达成、七相链贯通；详见 `docs/codex/HANDOFF.md` 顶部刷新节与根部 `docs/HANDOFF.md` 顶层。
- （2026-08-10 刷新）活契约现役槽是 `p9-created-workflow-cleanup-continuity-v3`（full，3/6，属 Claude 侧主线），不得占用、覆盖或代为收口；`review-provider-inline-auth-hook` 早已全 done。

【评审供应方纪律】
- Grok 与 pi.dev 均已配置、可使用；认证由各自调用链内联处理。
- 禁止搜索、读取、推断或回显账号、密码、token、API key；不得在仓库、环境变量、用户目录或公开配置中寻找，也不得要求用户提供。
- 禁止用裸 CLI 的 `--list-models`、`No API key` 或公开配置缺失判定不可用；这些只说明走错未配置入口。
- 直接使用项目既定已配置入口。只有真实任务调用失败才按实际输出记 `HARNESS_ERROR`；取消、超时、只有过程输出或 exit 0 无终局都不是 PASS。
- Claude Code 当前无额度：不探测、不调用、不回退。

【必须保护的工作树现场】（2026-08-10 刷新；以实时 `git status --short` 为准）
以下文件不属于下一任务完成提交，全部保留，不得修改、覆盖、删除、暂存或提交
（均为登记过的用户资产，定性见根部 `docs/HANDOFF.md` 顶层审计清单）：
- `M docs/plans/chiefcomplaint-sendandwait-admission/SIGN-AND-AFTER.md`
- `M docs/plans/p9-uat-close/resign-runbooks.md`
- `M loop/prd-admission-policy-facets.json`
- `M loop/prd-agent-network-code-identity.json`
- `M loop/prd-p9-created-workflow-cleanup-continuity-v3.json`
- `M loop/prd-p9-tier2-live-smoke.json`
- `M loop/prd-tc_catalog_wf_crud.json`
- `M loop/prd-tc_wf_publish_states.json`
- `M loop/prd-teachin-admission-side-effect-policy.json`
- `M loop/prd-teachin-cycle-axes-step-set.json`
- `M loop/prd-teachin-cycle-evidence.json`
- `?? casey-agent-loop-local-first-total.zip`
- `?? docs/plans/gate-contract-preflight/REVIEW-PROMPT-for-codex.md`
- `?? follow.mjs`

【可选并行任务（先问 Steven 取舍再动）】
`docs/plans/gate-contract-preflight/REVIEW-PROMPT-for-codex.md` 是一份现成的异构
评审任务（gate 前置闸，文末带完整调用命令）——Claude 侧发起 codex 三次全败后备
Steven 亲自发起，2026-07-31 起搁置。若本 session 额度可用且 Steven 点头，可先跑它
再回 ratchet 主线。

【第一步从这里开始】
1. 只读执行 `git branch --show-current`、`git status --short`、近期 `git log`，读取 `loop/active-contract.json`。
2. 核对 provider hook 已完成，以及 ratchet GRILL/R1/R2-harness 只是设计现场；不得把 harness 取消或错误入口写成供应方不可用。
3. 直接走已配置 Grok 或 pi.dev 入口，对 `ratchet-security-revocation/GRILL.md` 做聚焦 R2 设计复核。R1 findings 已修，R2 必须有明确终局；无终局就记真实 `HARNESS_ERROR` 后换另一已配置入口。
4. R2 FAIL：只修设计文档并继续复审。R2 PASS：把 D4「历史 successor 绿 + 当前 closure 绿」双层定义完整交 Steven 签认。
5. 只有 R2 PASS 且 Steven 明确签 D4 后，才恢复该 full/kernel 级契约，写 plan、验收测试并申请兄弟 `loop-kit` 写权限。

【ratchet 设计不变量】
- `SECURITY_REVOKED` 是具名安全撤销，不是 PASS；两个 revoked owner 的原 checksum 与 `passes:false` 永不改。
- ratchet 全程只读，不执行墓碑、归档、successor golden 或任意 acceptance 命令。
- 只有完整、单义、内容寻址且被当前冻结链反向钉住的 v2 回执才可把对应 mismatch 移入 `revocations[]`；任一环缺失仍 RED。
- 普通 mismatch、冲突 expectation、missing、outside-root、affected 与反向索引行为不能被安全例外吞掉。
- 改兄弟 `loop-kit` 必须同步 Casey 期望副本、观测基线、`kit-lock`、受影响 PRD checksum，并做 Casey/autotester 双消费者复验与最终人签。

【内核纪律】
- 裁判零 LLM；fail-safe 不 fail-open；完成只认真实退出码、确定性证据与必需人签。
- 冻结测试对实现者只读；测试变化必须重新冻结、重跑 gate 并精确人签。
- fake/fixture SUT 只读，不启动、不连接、不回放；本设计复审不需要浏览器、网络或 SUT。
- 凭据和真实目标地址不得进入命令行、输出、日志、文档或提交。
- 保留用户脏文件；禁止破坏性 git 操作；未经用户明确要求不提交或推送。

【验收与停止条件】
设计阶段验收：取得有效异构 R2 PASS；Steven 对 D4 留下明确签认；所有 R1 finding 有闭合证据。
实现阶段前置：full/kernel 契约阶段互锁成立、红验收冻结、兄弟仓权限明确、双消费者影响面清单完成。
立即停止并交人：R2 无有效终局、D4 未签、兄弟仓无权限、方案要求执行 unsafe body/fake-SUT、重签墓碑、改 revoked owner `passes:false`，或需要暴露认证/目标地址。
```
