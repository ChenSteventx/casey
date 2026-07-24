# codex 异构评审记账 — entity-workflow-source-readback（C2）

评审家族：codex gpt-5.6-sol（read-only 暴露真 worktree，亲跑金牌），异构核验 Claude 实现。

## 逐轮结论

- R1（round-1 提交 8419a48 前身）FAIL：角色契约不可满足（注册表要 source、生产准入策略 preflight 要 subject，happy path 不存在，15/15 用生产门不接受的 source 夹具=生产接缝假绿）；compile 下游 agent-only（workflow 产物不可达）；workflow.open 读回失败仍继续=fail-open。两处冻结 amend（admission bindingMode 订正、spine 改锚 workflow.bindAgent）判合法。
- R2（round-2）FAIL：High-1 泛化引入新反向基数 fail-open（checkIdentityObservationCardinality 只验单向，三案错返 ok:true）；Critical 角色契约 route:human 诚实、High-2 open fail-closed、Medium 补可执行金牌均成立。
- R3（round-3 提交 43b0975）FAIL：反向基数按 intent 分组太松，观察锚非终端 click 仍 ok:true。
- R4（round-4 提交 9d0ad90）**PASS**：checkIdentityObservationCardinality 改按终端 click 锚定（每 (intentId,atom) 组终端=events 顺序最后一个 click、严等 compile 武装 run.events[len-1]），锚非终端→拒 OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK；分组键改 JSON.stringify（NUL=0）。Critical/High/Medium 全无；cardinality-reverse 18/18、admission 15/15、wiring 18/18；独立对抗构造均符合预期；RC-4 归因诚实可接受。

## 收敛态（hermetic）

机器闭：注册 workflow.create/open 观察原子 + compile 下游泛化（基数门/issuer 按 kind，agent 逐字等价）+ workflow.open 读回失败 fail-closed 中止 + 反向基数双向双射锚定终端 click。gate GREEN 6/6，v2 sha b7b5a47e 未动。

## 残留 route:human（本轮未做，诚实挂账）

- 角色契约调和：注册表 workflow.create/open 要 requiredRoles:[source]，生产准入策略 entity-admission-policy.frozen.json（ADR-0004 人签冻结件，属另一契约 prd-teachin-admission-side-effect-policy）要 subject——须 Steven 定方向 + 再签，本轮绝未擅改/伪造人签。workflow mutation happy path 当前 fail-CLOSED 不存在（非 fail-open）。
- 真字段名（recordsPath/totalPath/queryParam/抽屉真实类名）、source/target 双锁真机形态、同名工作流敌意用例、workflow 浏览器行为端到端真证、RC-4 进程级 compile exit 65 端到端 —— 全 route:human（真机 UAT + prd observability）。
