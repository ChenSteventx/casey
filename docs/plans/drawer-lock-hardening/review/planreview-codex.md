# drawer-lock-hardening 方案评审记录（`light` 车道设计评审）

## 评审元数据

- 评审对象：`docs/plans/drawer-lock-hardening/proposed/GRILL.md`（D1–D8 + 反面场景总表）+ `plan.md` 落地步骤、`touchesFiles`、红先行金牌清单（G1–G7）、重签清单与验收命令序（三者全文见 `docs/plans/drawer-lock-hardening/review/planreview-material.md`）。
- 评审形态：异构冗余评审——规划方=Claude（Sonnet 5），评审方=`codex`（评审家族≠规划家族）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-drawer-lock-hardening -s read-only -m gpt-5.6-sol -c model_reasoning_effort=max -`，评审料经 stdin 喂入，`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec/plan（评审指令 + 关键设计裁量清单 + 佐证事实 + `GRILL.md`/`plan.md` 全文），不含凭据、不含规划者内心推理。
- 运行备注：过程中日志出现若干 `rmcp::transport::worker`/`codex_models_manager` 的 `ERROR`（`chatgpt.com`/`developers.openai.com` 相关网络抖动、MCP 工具发现连接失败、一次证书域名不匹配的重连），均为 codex 自带辅助连接的噪声（先例：`loop-kit-extract` 方案评审同类噪声），不影响本次评审调用本体——进程正常产出完整评审文本并退出（历时约 7 分钟）。原始日志留存于本机临时目录（非仓库产物，不入 git）。

## 结论

`codex` 原文判据：**非 `PASS`**——未发现 `HIGH`，计 5 项 `MED`、1 项 `LOW`。

## MED

- **MED#1：D2 的实现表达并非真正的“标题锚”。** 计划中的 `.hr-drawer__content-wrapper:visible` + `filter({ has: getByText(nodeName, { exact: true }) })` 只能证明「可见抽屉内任意后代存在该文本」，不能证明文本位于标题元素、文本自身可见（`:visible` 只约束 wrapper）、该抽屉属于节点配置抽屉。仍存在假绿路径：点击前无匹配抽屉，点击错误地打开了另一个抽屉，其正文或隐藏模板恰含 `nodeName` 且有唯一目标字段，点后 `count===1`，随后 set/select 仍会操作错误抽屉并精确回读成功。`twintitle` 场景只覆盖「冒牌抽屉在点击前已存在」（会被预点基线拦住），未覆盖「点击后才出现的冒牌抽屉」。D2 拒绝夹具自造的 `.lf-node-drawer` 类锚这一判断本身成立，但标题锚需进一步约束「可见、具有标题语义的文本节点」，至少应增加「正文/隐藏文本碰撞」与「点击后冒牌抽屉出现」两类场景。
- **MED#2：D4 只拦「缺失」，未拦非法 `nodeName`。** 现有 schema 只约束 `type: string`，空串与纯空白仍合法；若这类值进入 `getByText(..., exact:true)`，匹配行为可能落到空文本后代，不能证明必然 `fail-closed`。回放门应在执行任何 locator 或动作前要求 `nodeName` 是字符串、经项目统一规范化后非空、与编译侧允许的节点标题约束一致；`G7` 也应分别覆盖「缺失」「空串」「纯空白」三种情形（不需要因此修改 schema，但运行时门必须明确）。
- **MED#3：G1–G7 没有钉全 D5/D6 的三态边界。** 当前矩阵缺少：`select`/`set` 的「标题锚抽屉数 `>1`」分支；`openNode`「预点为 0、点击后出现两个标题匹配抽屉」的点后歧义分支；`selectNodeDropdown` 的 `twinboth` 正向用例。因此实现若在点后 `>1` 时取首项、或在多抽屉环境下无条件关闭 select，仍可能通过现有金牌。另外 G3 的「set 或 select」与 G7 的「set 与 select」应落实为彼此隔离的子用例，避免一个分支失败后短路、另一个分支实际未执行；红基线也必须逐例收集，不能只证明整个文件首次断言后非零退出。
- **MED#4：金牌只钉报告，没有钉真实副作用和精确终态。** 当前断言存在假绿空间：G1/G2/G7 可以先填错或点错、再上报 `none`/`action_failed`；G4 可以操作冒牌抽屉并对它完成回读；G3/G6 的「零事件」不等于没有发生错误 UI 动作；「verdict 不 `PASS`」也允许错误落成 `SUT_DEFECT` 或其它状态，未钉住 fail-safe 的具体路由终态。夹具应提供可观测哨兵或状态探针，并断言：冒牌字段和下拉未改变；G4 确实修改了节点抽屉且冒牌抽屉保持原值；缺 `nodeName` 时没有填充或点击；D4/D5 证不出归属的路径应精确落到既有裁定树要求的终态（尤其应钉 `NEEDS_HUMAN`，而非仅「不 `PASS`」）。
- **MED#5：新 prd 的冻结闭包漏了反面场景的载体夹具。** 四份既有 prd 的重签清单，按备料所述全仓求交结果看是完整的；`prd-wf-open-node` 不改金牌则无需重签也成立。但新 `loop/prd-drawer-lock-hardening.json` 当前只明确冻结新 golden，没有明确冻结 `tests/fixtures/fake-sut/server.mjs`——三个反面接缝实际由该夹具承载；若以后移除冒牌抽屉，G1–G3 仍可能因节点域无目标而通过、G4 会退化成单抽屉 `unique` 而通过、G5/G6 仍可能以「不开抽屉」而失败通过，golden 不变时考场可被静默削弱。新 prd 至少应同时冻结 `server.mjs`；若 `CONTRACT.md` 按现有 `p5-replay` 先例属于规范性测试资产，也应一并冻结。

## LOW

- **LOW#1：新 `run` 态未纳入 `mark()`/`rollback()` 事务边界。** 当前调用图下三原子不经过回滚，暂不构成现时可达缺陷；但 D3 新增的节点标题 `run` 态（如 `nodeDrawerLabel`）已成为决定可否执行变更的身份状态，留在回滚清单之外会破坏 `createCompileRun` 的完整快照语义。建议现在就把它纳入 `mark`/`rollback`，或从回滚后保留的事件推导当前节点身份，避免以后重试路径残留陈旧标题。

## 其余核查结论（codex 原文）

D1 的编译门与回放门同刻收窄方向成立；未看到裁判 LLM 化或凭据外泄设计；现有术语可解释为「点击身份门」/「语义定位器」的实现描述，尚不足以构成新的 DDD 统一语言（即：不需要新登记 `CONTEXT.md` 词条）。

## 我方独立复核（Claude 补充，非 codex 产出，供交叉参考）

备料阶段的「佐证事实」独立核对已先行发现 `createCompileRun` 的 `mark()`/`rollback()` 只回滚六个既有字段、全仓唯一调用处（`compileWorkflowDelete`）与本契约三原子无关这一现状，并标注「若 D3 新增 `run` 态字段未来被纳入某处 `mark`/`rollback` 包裹的重试逻辑，可能残留跨越回滚边界的陈旧值」——与 codex 独立产出的 LOW#1 结论一致，双路独立复现同一处设计缝隙，互证非偶然误报。

## 处置与去向

本记录是本契约 `plan` 阶段的正式异构冗余评审产出（护栏 #9 达成，非同族兜底，`crossFamily=true`）。按 `docs/HANDOFF.md` 「plan/设计评审无兜底、必须异构本尊出结论，不通即 blocked」的硬规则：`accept` 阶段（红先行）不应在本记录的 `MED` 项收敛前开工——MED#1–MED#5 需在 `GRILL.md`/`plan.md` 修订后，由 Steven 判断是否需要再走一轮评审；LOW#1 建议随实现一并处置或记账延后。本记录不改任何实现字节、不改 baton 阶段状态（`plan` 仍是 `done`，`accept` 仍是 `false`）。
