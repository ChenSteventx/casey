# drawer-lock-hardening — learn（light，异构冗余实现审六轮 r6 双 PASS 收口）

上下文：画布三原子 workflow.openNode/selectNodeDropdown/setNodeField 域锁从宽 `.hr-drawer__content-wrapper`
收窄到「当前节点抽屉专属锚」（可见 wrapper + 内含自身可见的精确标题文本），封 codex-sol MED#2 挂账的
跨抽屉误命中假绿。实现审跑了六轮（r1–r6），每轮 codex∥pi 双路，逐轮红先行修到双 PASS。

## 1. TOCTOU 的身份连续性缝在「原点」，不在「使用点」

r1/r2 一路加固到「保留被钉抽屉的物理 ElementHandle + 落笔前物理同一重判」，看似把检查到使用的窗口
焊死了。r3 codex 仍逮到 A1：`nodeDrawerDomain` 返回的是惰性 `nth(k)` Locator，`pinNodeDrawer` 是在扫描
**之后**才 `elementHandle()` 锚定——身份锚定时刻晚于检查时刻，扫描到锚定这一小段窗内的同标题原位替换
让 rootHandle 从一开始就是冒牌，之后所有「一直是锚定那个节点」的物理同一校验都证不出「就是扫描时
检查过的那个节点」。教训：抗 TOCTOU 不能只在使用点加闸，要把物理身份锚在**检查发生的那一刻**——
改 `elementHandles()` 一次性快照，扫描即锚定，快照后任何替换让句柄脱附 fail-closed，缝从构造上消失。

## 2. 一个「可伪造属性」有两级伪造：复制（数量变）与搬移（数量不变）

pin 是页面脚本能读写的 data 属性。r2 逮到「复制」——pin 被复制到冒牌，`pinCount>1` 一闸拦下。但 r3
codex 逮到 A2「搬移」：pin 从原节点摘下、挪到被钉抽屉**内部**一个无标题嵌套 wrapper，全页 pin 始终
恰一、标题域仍解析回 rootHandle——前两闸（域内唯一者物理同一 + pin 全页恰一）全过，可 `bound.root`
按 pin 属性重解析到嵌套 wrapper，候选域 2→1，本该 ambiguous 洗成 unique 假绿。三闸才齐：域内唯一者=
被钉物理节点（防替换）、pin 全页恰一（防复制）、**唯一 pin 承载者=被钉物理节点**（防搬移）。凡是靠
「可伪造记号」定界的，都要问：记号被复制会怎样？被搬移（数量不变）会怎样？两个方向各要一闸。

## 3. 修一处开一处——每次加固要同时红先行「新缝」和回归「旧正例」

r4 修 codex MED（标题判据只归一 DOM 却比原始 lbl，带空白的合法 label 假阴）→ 改 `norm(lbl)` 两侧归一。
这修好了假阴，却在 r5 被 codex 逮到开了个假绿：`norm('   ')=''`，而 openNode 入口只有 `!label` 没有
trim 空门，空 target 会命中画布/抽屉的空文本节点、把空控件误当标题（G20 红证实测回放真返 unique+
identityReadback ok）。收窄类改动是「双刃」——收紧匹配防假阴的同一处，放宽了空/退化输入的假绿面。
每轮加固都配一枚红先行金牌钉「这一处的新缝」，并让既有正例（G1–G19）全绿证「没误伤合法形态」。

## 4. 异构冗余的家族差异这次是实打实的赛点：pi 三轮漏报，codex 三轮逮到

r3、r4、r5 三轮 pi（DeepSeek 家族）都给 PASS，三轮都是**漏报**——同一处 codex（OpenAI 家族）逮到真
缺陷（r3 两条 HIGH、r4 一条 MED、r5 一条 fail-open）。若同族评审早收口，会连发三个真缺陷、其中一个
是 HIGH 向的 fail-open。观察到的机理差异：codex 是 `-s read-only` 真进仓探索——它自己 `page.evaluate`
构差分探针、甚至独立复跑金牌拿到「old 命中 / neu false」的实测对照；pi 是纯 `@料` 静态审，r2 还出现
过引用不存在的函数名/行号的幻觉。**代码 review 里「能动手复现的评审」压过「只读料的评审」**。这是本
契约对「异构评审家族≠实现家族」这条铁律最硬的一次实证：跨族 + 能复现，缺一不可。r5 尤其关键——pi
明确写了「nodeNameInvalid 已 trim 判空、纯空白不流入此域」，但 codex 证其对 openNode 入口根本不成立
（openNode 没有 nodeNameInvalid 门），pi 的「安全论证」本身是错的。从严采信严的一方，一次没亏。

## 5. 空/退化输入是反复出现的 fail-open 面——归一键会把「非空但语义空」塌成空匹配键

`norm` 把纯空白塌成 `''`，`''` 作为匹配 target 会命中任何空文本节点。修法用了纵深两层：入口 trim 空门
（openNode 回放/编译两门，与 select/set 的 nodeNameInvalid 同口径拒动）+ 匹配器 `nodeDrawerDomain` 首行
空 target 早返 `[]`（结构上让空键锚不到任何抽屉）。凡是「先归一再比较」的定位，都要单独想：归一后可能
变成空/通配的输入，走的是拒动还是命中？默认拒动（fail-closed），别让归一顺手造出一把万能钥匙。

## 挂账（不静默丢）

- 身份锚模型的残余暴露面（承袭既有、非本契约新增）：可见展示当前节点精确标题的抽屉即视为该节点抽屉；
  冒牌抽屉正文恰含精确标题且域内恰一时，身份锚原理上不可分辨——要再收窄须真机采样节点抽屉专属结构锚
  （已拒夹具自造类锚），挂 route:human 真机行程。
- ratchet 本树两条 `cases/tc_wf_history_version|tc_wf_publish_states/expected.frozen.json` FILE_MISSING 是
  worktree 环境缺口（非本契约冻结面），非问题，归主树核。
- 诚实边界（arb 已定，本轮遵守）：整原子级无页面可观测握手点——A1 接缝级红证只能落在夹具确定性握手
  （pinmove/pinclone MutationObserver）与既有场景回归上，禁止为凑红证在实现里埋读探测钩子。
