# ADR-0008：loop-kit 提取为独立包，Casey 先迁、autotester 后迁

- 状态：已接受（Steven 2026-07-13 拍板，loop 双 profile 改革 P0-3）
- 日期：2026-07-13

## 背景

autotester ADR-0001 约定「提取触发条件 = 第二消费者出现」；Casey ADR-0001 改为「先拷贝同仓、同步痛感超过提取成本再提取」（YAGNI）。两 ADR 张力在 loop 双 profile 改革（`docs/plans/loop-dual-profile-reform/PROPOSAL.md`，唯一活动改革设计源）立项时到期：实测两仓 8 份脚本仍字节一致（`breaker`/`gate`/`hook-loop-guard`/`hook-loop-triage`/`hook-posttool`/`hook-stop`/`review-deepseek`/`term-lint`），但 Casey 的 `contract.mjs` 已为 worktree baton 分叉、`ratchet.mjs` 为 Casey 独有新增——分叉在扩大；改革还将新建 `workflow-state.mjs`/`orchestrate.mjs`/schema 并重改 `gate`/`contract`/hook。不定所有权就动工，必然造出第三个不同步变体（提案 §12.1 明令禁止静默复制粘贴演化）。

两条候选路线（提案 §12.1）：① 立即提取独立包（bold，提案推荐）；② 新 ADR 宣告 Casey 专用分叉、停止字节一致声明，稳定后再议提取。评审（`FABLE-REVIEW-DISPOSITION.md`）确认二选一皆可接受、但必须先决后动。

## 决策

1. **走路线 ①：立即提取**。通用引擎、schema、runner 契约提取为本地独立 `loop-kit` 包（形态沿 autotester ADR-0001 预定：独立仓 + npm 本地路径依赖分发确定性脚本；落点为 Casey 的兄弟目录 `loop-kit`）。
2. **迁移次序**：Casey 经兼容性金牌先迁（字节/API 兼容金牌先行，迁移期间旧 in-repo 拷贝保持唯一生效源直到切换点）；autotester 后迁、单独有界工作流，不触其无关脏测试数据。
3. **源头真相边界**（提案 §12.1）：通用转移/schema/gate 原语归提取后的 loop-kit 包；项目侧适配器、`loop/config.json`、context map、`prd-*.json` 实例、`GUARDRAILS.md`、`CONTEXT.md` 留各仓。Casey 已分叉件归位：`contract.mjs` worktree baton 能力与 `ratchet.mjs` 属通用编排域，随提取入包。
4. **治理**：提取本身触强制层（`gate`/`contract`/hook 的源头搬迁），按 `kernel` 级治理走——双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签；在 `kernel` 车道机制建成前以 `full` 车道 + 上述加严约定执行（先例：`resolution` 契约）。
5. **改革衔接**：P0-4a（状态引擎）/P0-4b（gate 分层）的新原语在提取后的包内建造，不再往 in-repo 拷贝上叠新面。

## 后果

- 收益：从第一天杀死第三变体漂移；两仓共享一个内核与一套内核金牌；autotester ADR-0001 的提取触发承诺兑现。
- 代价：P0 期间每刀都在双消费者共享包上改，跨仓兼容金牌负担前置；改革体量变大（评审已知情标注，Steven 仍选此路线）。
- 兑现关系：本 ADR 取代 Casey ADR-0001 决策第 1/4 条（「先拷贝同仓」「推迟独立成仓」——其分界线原则与数据契约锚定原则继续有效）；兑现 autotester ADR-0001 决策第 3 条的触发器。autotester 侧的对应 ADR 更新在其迁移工作流内落，不在本仓代办。
