# GUARDRAILS — 护栏清单（Casey）

> 永不可违反的约束。每条标注执行方式（[enforced:由谁] / [prose]）与它编码的假设——模型升级时逐条审计假设是否过期。
> [prose] 条目是欠账：能转为确定性检查的应尽快转。
> 1–12 迁移自 autotester（loop-kit 通用子域）；13–16 是 Casey 核心域新增，守「LLM 驱动但裁判零 LLM、fail-safe 不 fail-open」的内核。

1. **[enforced:gate]** 验收测试与 golden 存档冻结：`prd.json.testChecksums` 校验不符 = 直接红，无论测试本身过没过。
   假设：模型会修改测试让其变绿（Test Ratchet / 奖励钻营）。
2. **[enforced:gate]** 完成判定只认可执行规格的 exit code；任何「我已完成/已验证」的自我报告不作数。
   假设：模型会声称未验证的工作已完成。
3. **[enforced:breaker]** 迭代上限 20 / 连续 3 轮零进展 / 同错 5 轮 / 8 小时——任一越限即熔断写 Inbox。
   假设：无停止条件的 loop 会空转烧钱。Casey 回放/自愈 loop 的「零进展」改喂每步进展哈希（非 git HEAD）。
4. **[enforced:hook+gate]** 统一语言白名单（ADR-0005）：弃用别名与未登记加粗英文术语 = 红。
   假设：散文纪律约束不了模型命名行为。
5. **[enforced:gate]** 冻结断言契约只读、自愈非就地：人签后的 `expected[]` 改动 = Test Ratchet 判红；自愈绝不就地改 spec/断言，只写漂移补丁旁文件、人签后才应用（spec 指纹另由 gate 检查项守）。
   假设：自动重建/就地重锚会冲掉人工语义评审成果、把会变动的靶子抹成假绿。
6. **[prose→待enforced]** loop 在真实环境创建的一切实体必须带 Reserved Prefix `atl_`；回放期实例化、绝不冻成字面量。
   假设：变更类回放中途失败必留残留，共用环境他人数据不可误删；冻成字面量第二次必撞或假红。
7. **[prose]** `.auth/` 与 `site.json` 内容不得出现在任何输出、日志、commit、报告中；报告落盘前过凭据兜底门。
   假设：凭据泄漏不可逆。
8. **[prose]** auth/计费/安全类代码改动一律走 Escalation Path 给人，不进无人值守 loop。
   假设：这类 bug 不出现在单元测试里，出现在事故报告里。
9. **[prose]** review 道输入只含 spec+diff+门禁证据，不含实现者推理过程。
   假设：实现者的叙述会把锚定偏差传染给评审者（同族合谋的变体）。
10. **[prose]** 任何模型（含 Codex）产出一律过 Quality Gate，无直通仓库权限（"Read, write, propose"）。
    假设：任何模型的产出未经确定性验证都不可信，与家族无关。
11. **[enforced:hook]** 阶段互锁（Loop Contract）：每阶段交付物缺失时，下一阶段的工具动作被 `hook-loop-guard` 拦——写 prd 需 plan、改 `lib`/`bin`/`web` 需冻结的红测试（accept）、提交实现需门禁绿（loop）；任何实现编辑/提交前必须先 `contract init` 声明入口分流。
    假设：模型会「需要 loop 时不走 loop」——跳过 grill/门禁/异构评审直接动手。
12. **[enforced:hook+gate]** 中文一律标准简体，禁繁体：`term-lint` 繁体检测命中即红，走 Stop hook + PostToolUse hook + Quality Gate。`term-lint:allow` 行豁免。
    假设：模型偶发把简体误写成繁体；散文提醒约束不住用字，必须机制兜底。
13. **[prose→待enforced]** 自愈准入门：自愈只对正向确证的 `HARNESS_ERROR` 开闸；`SUT_DEFECT` 与 `NEEDS_HUMAN` 一律拒绝自愈。缺取证 ≠ 工装错。
    假设：真 bug 表现成「元素不见了」时，若默认成可自愈会被悄悄抹平——这是最危险的假绿（design §10）。
14. **[prose→待enforced]** fail-safe 不 fail-open：机器只能终判 `PASS` 与有取证背书的 `SUT_DEFECT`；凡证不出的一律路由 `NEEDS_HUMAN`，绝不默认成可自愈或自动记缺陷。catch-all 默认是 `NEEDS_HUMAN`。
    假设：未知失败若 fail-open 会被洗成绿或假缺陷，操作员学会无视 verdict、信号自毁。
15. **[prose→待enforced]** 裁判零 LLM、与自愈分进程：多态裁定由零 LLM 的 `verdict.mjs` 出，自愈（LLM）是它的下游消费者，不得反向进入裁判进程。`actionPerformed` 经点击身份门判定、取证按请求发起方归因（非时间窗）。
    假设：让 LLM 进裁判进程会把真 bug「重锚」成绿；按时间窗归因会让背景轮询 401 翻 verdict。
16. **[prose]** gate 绿 ≠ 完成：冻结断言须经人签门才算数，需求完成以人签真机 UAT 为准（gate 是必要非充分）。
    假设：可命令化的验收测不到语义正确性（用例是否真表达意图、真站是否真 bug），这些必须人裁。
17. **[prose→待enforced]** 裁判按断言种类不可知：`verdict.mjs` 消费已判好的 `StepAxes`，对 `postAssertions` 只 AND 硬断言的 `ok`、忽略 `soft`，绝不按 `kind` 分支；取证缺失子字段当「本步无此特征」、不报解析错；断言 `kind` 的枚举只在 `check.mjs` 一处。
    假设：若 `verdict.mjs` 按 kind 分支，每加一个新维度（对话/发布/画布）都要改裁判内核、重开 accept，飞轮的加法式复利失效；新 kind 应只加 `check.mjs` + 加 golden（岔一，2026-06-29 锁）。
