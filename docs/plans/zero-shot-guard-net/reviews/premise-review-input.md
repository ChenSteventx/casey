# 前提审任务：guard-net 契约草案（实现前的计划/前提评审）

你是独立评审者。这是**计划前提审**，不是代码审——代码还没写。你的职责是攻击计划的前提与设计，
在实现开始前把错误的划线标准、错误的豁免理由、遗漏的影响面逮出来。

## 输入

- 契约草案（主评审对象）：`/tmp/claude-1000/-mnt-d-ctx-heren-casey/ce054dc2-793f-441c-97d7-14ea0c258cc6/scratchpad/draft-guard-net.md`
- 背景侦察报告：`/tmp/claude-1000/-mnt-d-ctx-heren-casey/ce054dc2-793f-441c-97d7-14ea0c258cc6/scratchpad/recon-container-scope.md`
- 代码基线（只读，勿改）：`/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate`，HEAD `e6e7ea1`
- 上位约束：该仓库的 `CONTEXT.md`、`loop/GUARDRAILS.md`（尤其 #1 测试冻结、#14 fail-safe、#19 复跑纪律）

## 已定裁决（fable 已裁，评审对象是这些裁决的正确性，不是重新开放选项）

1. `S2_CORE` 改平铺 `readdirSync` + `.mjs` 过滤 + d1 双向相等 + 「`lib/zero-shot/` 无子目录」断言。
2. `d3` 的 `pureFiles` 反转为执行面白名单（新模块默认按最严受检）；豁免名单本身无门盯，挂 route:human。
3. 新建纯叶模块 `lib/zero-shot/unsupported-scopes.mjs`，导出键清单 + 归一化 + 判据三件。
4. `anyUnsupportedScope` 对畸形形状（null/字符串/数字）保持现役行为（返回假），不顺手改 fail-closed，单独挂账。
5. 夹具 `copyUnsupported` 改通用透传；实现期第一步先只改夹具跑全部邻接金牌，确认零红再动生产件。
6. 元钉 = 遍历 `UNSUPPORTED_SCOPE_KEYS` + 源码结构钉（断言四生产件已 import 共享模块且无 scope 键字面量）；
   合成第四键只进 red-proof transcript，不进冻结金牌。
7. 不动 `playwright-page-driver.mjs`（生产端漏键不构成 fail-open）。
8. `CONTEXT.md:97` 单行追加 `container-out` 门内态说明，不开新词条、不进弃用别名列。
9. 三处 `container-out` 防御性死代码挂账不动。
10. 落地序强制：范围 1（边界门自动发现）→ 范围 2（scope 单一事实源 + 元钉）→ 范围 3（词条）。

## 你必须自己验证的重点（不接受草案自述，自己跑）

1. **P1/P2/P4 探针复现**：草案声称流氓模块四网全逃（改前 5/5 绿）、补丁后五网齐响、
   第四 scope 键下 `verifyStepProgress` 判 `progressed`（真 fail-open）。在 /tmp 副本里自己复现，
   只信退出码与实际输出。
2. **并集严格度（草案 R3）**：三处现役判据严格度不同。裁决 4 说「与现役并集等价」。
   自己构造：未知键置真的观察件今天在 resolver 是什么行为？收敛后会不会从拦变放？
   若收敛方案有把严侧收松的具体路径，这是 Critical。
3. **夹具通用透传的回归面（草案 R4，唯一未实测的承重推断）**：形状推演说三种现役用法字节等价。
   自己在副本里改夹具跑受影响金牌，验证是否真零回归。
4. **影响面完整性**：草案说只有三个 PRD 受影响（observe-admit-step / typed-progress / teachin-cycle-evidence）。
   自己按 `testChecksums` 与 `stories[].acceptance` 两维度扫 `loop/prd-*.json` 全集核实，特别找第四个。
5. **`CONTEXT.md` 整行替换文案**：按 `loop-kit/bin/term-lint.mjs` 的实际实现核这行文案会不会被拦
   （繁体/加粗英文/列切坏）；核 `container-out` 进第四列会不会真的红三处在用代码。
6. **红证据成色**：范围 1 对现状零行为差、红证据只能是变异实验——这个「如实标注」的姿态
   是否符合该仓库 acceptance-gate 红先行纪律的实质（红要证明的是洞存在，不是接口缺席）？
   若你认为变异 transcript 不足以当红证据，说清楚标准应该是什么。

## 输出要求

- 只报 Critical / High / Medium；每条给：针对草案哪一节/哪条裁决、为什么错、可复现证据或反例、建议改法。
- 验证过认为无问题的重点逐条写「无发现 + 怎么验的」。
- 不修改任何仓库文件；变异全部在 /tmp 副本。
- 结尾一行：`VERDICT: PLAN_APPROVE` 或 `VERDICT: PLAN_CHANGES_REQUIRED`。
