# Casey `wf-delete-card-layout` 计划 + 实现双审任务（R2）

你是与实现家族异构的独立评审者。只读评审，不修改、不提交。不要相信作者总结；必须从不可变 Git 对象、权威文档、生产代码和测试自行取证。

## 不可变对象

- 仓库：`/mnt/d/ctx/heren/casey-wf-delete-card-layout`（Windows 等价路径 `D:\ctx\heren\casey-wf-delete-card-layout`）
- 分支：`wf-delete-card-layout`
- 实现基线：`7e39f78`
- 候选：`0a1c2679d0b708ff275301f8c1efc529c204858b`
- 实现差异：`git diff 7e39f78..0a1c267 -- CONTEXT.md accept/red-proofs/wf-delete-card-layout.red.txt docs/plans/wf-delete-card-layout/plan.md lib/workflow-delete-domain.mjs loop/prd-wf-delete-card-layout.json tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs`
- 计划 SHA-256：`fca3d3e963c4bcc686492d75494ed8f0a48dc0ea9d9b9a91ca49ab3d02c79cab`

## 全仓读取要求与禁区

1. 先 inventory 并读取全仓 tracked 代码与文档；可按目录批量检索后深读相关调用链，但不能只读本输入包或作者列出的 diff。
2. 深读权威链：`AGENTS.md`、`CLAUDE.md`、`CONTEXT.md`、`docs/HANDOFF.md`、`loop/GUARDRAILS.md`、`.claude/skills/casey/SKILL.md`、相关 ADR。
3. 深读本契约：`GRILL.md`、`plan.md`、PRD、红证、完整实现差异、删除域全部调用方、确认弹层因果链、compile/replay/report 投影和相邻 goldens。
4. 禁止读取/推断/回显 `.auth/**`、`site.json`、token、账号或供应方配置；排除 `runs/**`、`artifacts/**`、`node_modules/**`、归档与生成物。
5. 禁止启动/连接/回放真实或 fake/fixture SUT；禁止运行 `p3-compile.golden.mjs`、demo、`follow.mjs` 或会写 PRD 的 gate。只允许运行下列已审计零 SUT 命令。

## 计划审

独立判断 premise、范围、fail-safe 边界、因果授权、身份重验、可观察性、`route:human` 与验收闭包是否成立。特别检查：

- 计划是否仍暗示 agent 应启动 fixture SUT；A10b 与 §六的订正是否符合 Casey 硬边界且没有借机削弱验收。
- 卡片路径只在旧直见路径返回 `none` 时接管；`ambiguous` / `action_failed` 是否绝不二次接管。
- 三道锁是否覆盖入口、因果新菜单以及菜单点击前的目标卡片重验。
- `menuCleanup` 的记账边界是否精确，且没有被冒充为回放历史中的证据。
- 真实时序、真实 class、同拍他卡菜单风险是否全部留在 `route:human`，零 SUT 结果是否被误写成真机完成。

计划终局必须单列：`PLAN_VERDICT: APPROVE` 或 `PLAN_VERDICT: CHANGES_REQUIRED`。

## 实现审

重点攻击以下风险，并为每项给可复现反例或“无发现”的取证说明：

1. 重渲染换根、同名多卡、多入口、隐藏/陈旧菜单、嵌套浮层是否可能误删邻居。
2. `beforeClick` 标记是否会改变既有表格/直见路径、吞掉重要异常或制造错误的 cleanup 证据。
3. 点击更多操作抛错、菜单未浮现、Escape 失败、确认弹层多实例时是否 fail-closed。
4. 新增 `directDeleteButtons`、`menuDeleteEntries`、`menuCleanup` 是否越权进入 compile/replay/verdict/report 权威面。
5. R17–R21 是否非空钉；尝试删除/放宽目标防线做最小变异，必须还原且不得提交。
6. 冻结 checksum 与 amendment 链是否和实物一致；红证是否真实支持 red-first，而非把历史红冒充当前失败。

只运行并按退出码取证：

```text
node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs
node tests/_golden/workflow-delete-causal-binding.static.golden.mjs
node tests/_golden/checksum-drift-closure.zero-sut.golden.mjs
node tests/_golden/p0-p2-report-delete.zero-sut.golden.mjs
node tests/_golden/workflow-delete-spec-preflight.static.golden.mjs
node tests/_golden/regress-agent-tool-actions.zero-sut.golden.mjs
node tests/_golden/units/p3-compile-unit.zero-sut.golden.mjs
node tests/_golden/agent-delete-zero-window.zero-sut.golden.mjs
node tests/_golden/hermetic-golden-sut-census.zero-sut.golden.mjs
node tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs
node loop-kit/bin/term-lint.mjs --registry
node --check lib/workflow-delete-domain.mjs
git diff --check 7e39f78..0a1c267
```

实现终局必须单列：`IMPLEMENTATION_VERDICT: APPROVE` 或 `IMPLEMENTATION_VERDICT: CHANGES_REQUIRED`。

## 输出纪律

- 只报 Critical / High / Medium；每条 finding 给 `file:line`、影响、最小复现、修法。
- 分别给计划审与实现审终局，不得用其中一路代替另一路。
- 工具/模型/超时异常须如实记 `HARNESS_ERROR`，不得推导账号、额度或供应方不可用。
- 最后一行必须是 `REVIEW_DONE_SENTINEL`。
