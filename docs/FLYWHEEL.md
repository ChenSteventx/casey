# 数据飞轮：按维度扩条、骑 regress 语料（后续方向）

> 状态：方向记录，**未排期动手**。前置硬门 = 第一条 flow（`catalog_wf_crud`）走完 loop + tier-2 真机出四态（装轴承）。
> 相关：`docs/adr/0006-fuse-autotester-regress.md`（骑原子、R10 飞轮叙事、R9 画布坐标）、`docs/plans/p2-intent-compile/`（第一条）、`regress-intel.md`。

## 想法（用户提出）

先拿几条 flow（优先 regress 现成的）跑通 Casey，不断迭代，形成数据飞轮——跑得越多、复用越厚、边际越省。

## 为什么对

骑 regress 的全部理由就是这个：燃料是它已趟平的 37 条 flow + 60 个原子，输入免费、已冻、已真机过，省掉归一与编译两段，直接喂后半截（回放 → 三轴 → 裁定 → 报告）。用现成 flow 比新写划算。

## 摩擦在哪（别让飞轮空转）

- 阻力不在 flow 条数，在三轴重写：每条 flow 的原子要在 autotester L1 上重表达成吐三轴（路二），是真功夫（R10：LLM 约做五分之一，其余靠人工移植）。条数 ×5 = 移植工作量 ×5。
- 第一条没绿就铺 = ADR-0006 决策 1 否掉的「大爆炸」。先在一条上把端到端证实（尤其真 SUT_DEFECT）= 装轴承；轴承没装好，转得越多越散。
- 选错 flow 当场卡：画布域 flow 纯坐标无锚（R9）撞 Casey「禁纯坐标步」的确定性契约，早碰直接 route:human、转不动。

## 锁定的姿势：按维度铺，不按条数铺

每移植一条多覆一块设计空间、不叠冗余。推荐排期：

1. `catalog_wf_crud`（DOM / CRUD）—— 装轴承，正在 loop。覆：`urlPathname`、`countChange` 绝对归 0、`noErrorToast`、网络信封、点击身份门、合成故障 `SUT_DEFECT`。
2. chat 流（`chiefcomplaint_smoke` / `echo_default_on`）—— 覆 catalog 碰不到的：`streamReplyReceived`、LLM 流式取证（`waitForReplyByStream` 底座，即 R3 已存在但被丢弃的能力）、`replyContains`。
3. 发布 / 被拦流（`wf_publish_states` / `publish_blocked` / `test_blocked`）—— 覆按钮态、开关态、`textHidden`，外加「被拦」负例（天然喂 `NEEDS_HUMAN` / `CASE_DEFECT`，验裁判「不敢终判」那几条分支，光跑真绿用例验不到）。
4. 画布域（`wf_node_*`）—— 压最后，当「哪里会断」的探针，不当早期燃料（R9 前线）。

## 飞轮真正攒的「数据」（复利项）

条数本身不是复利，这五样才是：移植到 L1 的三轴原子、断言 kind 词表、按 channel 的信封配置、每条 flow 的观测现状 fixture、每条的 verdict golden。判断飞轮转没转，看这五样有没有变厚。

## 机械上不跟纪律打架

冻结契约是加法式的：新 flow 加新 golden、新 kind，不动已冻的——如移植 chat 流时给 `check.mjs` 加 `streamReplyReceived`，不会让 `p2-check-vocab` 现有 case 变色（它没测这个 kind）。ratchet 不挡飞轮，每条「加一块冻一块」。

## 待办 / 落地

- 现在不动手移植第二条；但 S1 的 verdict/forensics/StepAxes 抽象按「将来要喂三四种形状」设计，别只对着 catalog 长——这样第一条绿时飞轮的轴已通用，第二条接上去是移植原子、不是重做内核。
- 第一条真绿后：把排期 2/3/4 写成 plan 后续 story（如 S4 chat、S5 发布），各走 grill→accept→loop。
- 可选先做：扫 regress 37 条 flow 按维度归类、出「飞轮排期表」+ 标出哪些撞 R9 不可早碰（纸面便宜，还能反检 S1 抽象够不够通用）。

## 开 loop 前细化（2026-06-29）

> 接 `HANDOFF.md` / `NEXT-SESSION.md`。本轮把「轴要通用」从口号落成一条可执行实现纪律，并给排期与车道定倾向。**岔一、岔二、岔三均已锁定（2026-06-29 拍板）。**

**已锁 · 岔一（轴通用是实现纪律，不是预留字段）**：流式回复对机器裁判而言就是「一条网络记录 + 一个断言」，`StepAxes` 格式不重做。落地纪律——`verdict.mjs` 消费的是**已判好的** `StepAxes`，对断言**按种类不可知**（只把硬断言的 `ok` 与上、忽略 `soft`，绝不按种类分支）；取证缺失子字段一律当「本步无此特征」、**绝不当解析错误报红**；断言种类的枚举只在 `check.mjs` 一处。后果：对话/发布/画布接进来都是加法（加种类 + 加 golden），`verdict.mjs` 一行不动、已冻 8 个 case 不变色。

**已锁 · 质量接口（人工现在、自动将来）**：「内容好不好」走独立下游线，现阶段人工抽查、将来接 `LLM-judge`，**同一个下游接口、替换时裁判侧一行不动**；只进报告或转人裁，永不接进 `verdict.mjs`、绝不写 `passes`/`verdict`。已落 design §4.4 + `CONTEXT.md` 登记 `chat`。它佐证岔一：内容质量压根不在裁判那张表里。

**已采纳 · 岔二（先榨干第一条，再移植第二条）**：压裁判「不敢终判」分支最便宜的办法不是换 flow（那要五倍移植工作量），而是在已接好注入线的 `catalog_wf_crud` 上**多注几种合成故障**——除现有 500→`SUT_DEFECT` 外，补注 locator 漂移→`HARNESS_ERROR`、元素消失→`AFFORDANCE_ABSENT`/`NEEDS_HUMAN`、真数据多匹配→ambiguous。注一种近乎零成本，把「真 bug 被自愈抹平」这条最危险风险压掉。榨干后第二条仍移植对话流（格式通用性优先），发布第三、画布压最后。净效果：维持本文原排期，中间插一步「榨干第一条」。

**已采纳 · 岔三（辐条车道随复利递减）**：第一条走 `full`；**第二条起默认轻车道**（跳 `grill`、保留 plan+accept+loop），因为在已冻内核上移植 flow 没有新承重决策可 grill。硬规则：辐条一旦需要**改**（而非**扩**）冻结内核文件（`verdict.mjs` 判定树 / `StepAxes` 形状），当场升回 `full`。`accept`（红 golden 冻结）任何车道都不跳——它是飞轮复利第五项。那次被迫升级，正是「轴当初没够通用」的实证信号。

**加固已落（2026-06-29）**：岔一纪律已写成护栏第十七条（`verdict.mjs` 按种类不可知、种类只在 `check.mjs` 枚举），由机制盯住；并把已弃用的移植口语简写登记进 `CONTEXT.md` 别名列、硬拦复发。
