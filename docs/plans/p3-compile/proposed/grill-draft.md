# P3 备料草稿三：契约 grill 决策点草稿

> 状态：**草稿**，每条给选项与倾向、**全部留人签**——本文无一条是已决，签名栏空着就是空着（人签门，护栏 #16 精神前置到契约期）。
> 范围：P3 = 相1 编译（LLM 读文本用例 → 真机跑一次 → `events.json` + `observed-<caseId>.json`）。路线已锁 ADR-0006：骑 regress `catalog_wf_crud` 重表达，不从零编译。grill 阶段按纪律走 codex 异构评审通道。

---

## G1 编译期「唯一一次真机跑」的边界

**问题**：相1 的真机跑到底跑什么、跑几次、产什么，边界不清则 LLM 准入边界（L3）漂移。

- 选项 A：只采集——`agent` 驱动浏览器逐步执行 + 落 events + observed，不做回放核验；核验归 tier-2 另日。
- 选项 B：采集跑 + 立即确定性回放核验跑（同一 session 连跑两次真机）：编译产物落盘后马上 `bin/replay.mjs --events ... --sut ...` 回放一遍，验证 events 可加载、可回放、点击身份门全 unique——P3 验收「events 能被 runner 加载」（bootstrap plan 硬门）从纸面 schema 校验升级为行为核验。
- 选项 C：编译跑本身就走 replay 管线自举（agent 只产 events，执行交 replay）——鸡生蛋：events 未产出前 replay 无从跑，仅在「逐步增量编译」下可行，复杂度高。

**倾向 B**。理由：ambiguous 雷点（草稿一 ⑤⑦）只有回放核验才暴露；两次真机跑都在编译期一次性成本内，日常回归仍零 LLM（ADR-0003 内核不破）。副作用：真机会被建/删两轮实体，**保留前缀** + 收尾清理可消化。
**附属子决策**：CASE_DEFECT 候选判定仅编译期/人签前有效（design §4.3）——编译跑里入口可证缺席（目标 role/text 全 DOM count===0）时，编译器要产什么形态的候选标记（events 不落该步 + 编译报告记候选？）——**待细化，route:human**。
**人签**：（空）

## G2 登录预备动作：复用 autotester 现成件还是 Casey 侧重写

**问题**：登录不进 events（凭据红线，草稿一约定 3），那登录动作由谁做。

- 选项 A：复用 autotester——`lib/paths.mjs` 的 `DEFAULT_SITE.login` 选择器（账号/密码 textbox 的可访问名 + 登录按钮；注意按钮可访问名带空格「登 录」的已趟坑）+ `loadCreds()`（`.auth/credentials.json`，env 可覆盖不落盘）+ `loadSiteConfig()`（site.json 深合并覆盖）。纯 mjs、零 `@playwright/test` 值依赖，与 Casey 回放底座（ADR-0007 采纳 `@playwright/test` 但 lib 层纯 mjs）同构。按 ADR-0001「拷快照、自有、独立演进」范式引入。
- 选项 B：复用 regress `_fixtures.ts` 的 `login()` + `.auth/session.json` sessionStorage 注入（`USER_TOKEN`/`API_KEY`，`APP_ORIGIN` 白名单门控）。TS、绑 regress 运行时；但 token 注入跳过 UI 登录、更快。
- 选项 C：Casey 侧重写最小登录件。

**倾向 A**（选择器与凭据读取都是已趟平的现成件，拷快照范式有 ADR 背书；B 的 token 注入可作 A 的加速层后补，C 是重复劳动）。
**红线不变量（任一选项都要）**：凭据只经 `.auth/`/env 进内存，绝不进 events/observed/日志/编译报告；site.json 引用一律写「site.json 的 `target.startUrl`」。
**人签**：（空）

## G3 与已建 compile-gate（NL→atomId→flow 双闸）的对接

**现状**：`lib/compile-gate.mjs` 已落（结构闸 + 破坏性前缀硬闸 + 状态机闸，`validateDraft(draft,{prefix,registry})`，前缀从 `TestCase.uniquePrefix` 注入）；p2 grill 对账要点已把 L3 编译路由定为「NL→atomId→flow.json」。P3 要接的管线：LLM 读文本用例 → 出 atom 序列草稿 → `validateDraft` fail-closed → 骑 atom 知识真机逐步执行 → 落 events（`event.atom` 回链）。

分岔一（中间产物）：
- 选项 A：flow 草稿落盘为正式中间产物（`flow-<caseId>.json`），过闸 + 人 confirm 后才准真机跑（对齐 regress 的 confirm 人签门）。
- 选项 B：flow 草稿内存态，闸过即跑，events 是唯一落盘产物。

**倾向 A**：破坏性原子（建/删）上真机前有人眼一道，与「编译期唯一一次真机跑」的成本对称；落盘产物也是 G4 交接与对账追溯（flow→events→verdict）的锚。

分岔二（注册表来源）：
- 选项 A：只读引用 regress `tests/_atoms/atoms.registry.json`（单源，但跨仓耦合、regress 演进即漂移）。
- 选项 B：Casey 侧快照该注册表（ADR-0001 拷快照范式；ADR-0006 R13 已点名「字节复制会静默漂移」，快照须带来源版本标注）。

**倾向 B**，快照带 `snapshotOf` 溯源字段；只快照 `catalog_wf_crud` 用到的 6 原子还是整表 60 原子——倾向整表（后续飞轮条目直接吃），**route:human**。
**注意**：atomId 命名两套并存（registry 的 `workflow.create` 对 fixture 的 `wf.create`）——events `atom` 字段回链用哪套须钉死一套，倾向 registry 原名。
**人签**：（空）

## G4 断言草拟（P4）的交接面

**问题**：P3 产什么，P4 才能不缺料地草拟 `expected[]`。

交接面清单（倾向）：
1. `events.json`（动作序列 + intentId 卷回结构）；
2. `observed-<caseId>.json`（地面真值，schema 已冻）；
3. `TestCase`（归一后的意图语义——**关键**：`assert.onPage`/`assert.noErrorToast` 两个断言原子不产 event，其意图必须在 TestCase 对应 intent 的语义/expected 提示里留痕，否则 P4 只能从 observed 反猜「人到底想断什么」）；
4. 编译期核验记录（点击身份门唯一性证据、计数口径对账结论——草稿二 §3）。

分岔：P3 要不要预草 `expected[]` 草稿？
- 选项 A：不预草——相2 是 P4 的活，P3 只保证 observed 字段齐（层次干净）。
- 选项 B：编译 agent 顺手预草（它刚看过真机，语境最全），P4 复核收紧。

**倾向 A**：相位边界清晰、LLM 准入面最小；「语境最全」的价值由交接面 3（意图留痕）承接。
**遗留对账**：`countChange` 计数目标表达（expected 条目不带目标选择器 vs 回放侧 `.hr-table-row` 写死探针）——若草稿二 §3 编译期对账发现口径不等价，此处变接缝级决策，**route:human**。
**人签**：（空）

## G5 凭据红线的执行位（护栏 #7）

**问题**：编译器产物（events/observed/flow 草稿/编译日志）落盘前，谁来机器兜底扫凭据。

- 选项 A：编译器内联各写一段扫描。
- 选项 B：把 `lib/report.mjs` 已有的凭据兜底门（落盘前深扫敏感词 + 比对 site.json 字面量、命中拒写）抽成共享 helper，编译器所有落盘口统一过门。
- 选项 C：只靠 schema 的 `additionalProperties:false` 机制兜底，不加扫描。

**倾向 B**：单源、已实战（P7 credentialGate 有 coverage golden）；C 挡不住合法字段里的值泄漏（layer3-wiring F3 的教训：标量字符串照样携 `token=`）。**具体加固**：observed `requestLog[].url` 落盘前剥 query 或对 query 值脱敏（草稿二 §1.4）；`errorEnvelope` 的 `successField` 凭据字段名 denylist 复用 `lib/forensics.mjs` 已落的 A1 修复。
**人签**：（空）

## G6 已知环境前置：WSL 直连站点不通 + 可配置基址

**事实**（已亲验）：Windows 侧 TCP 通、WSL 直连不通。编译器要真机跑，网络路径必须先定。

分岔一（编译器跑在哪）：
- 选项 A：Windows 侧跑编译器（node + playwright Windows 版；仓在 `/mnt/d` 即 `D:`，双侧可见；注意 CLAUDE.md 已记 `PowerShell` 为 Windows 主壳）。
- 选项 B：WSL 跑，Windows 侧做端口转发（`netsh interface portproxy` 或等价转发件），编译器连转发端口。
- 选项 C：WSL 跑 + 修网络路由（成本与可行性未探明）。

**倾向 B**：Casey 全链（replay/verdict/gate/hook）都在 WSL 侧已验绿，换 Windows 跑编译器会劈出第二运行环境（行尾/路径/playwright 版本三处已知坑）；转发只加一层非凭据网络配置。B 需一次 `Spike` 验转发下 CDP 取证与录屏不失真；若转发不稳则退 A，**route:human**。

分岔二（可配置基址）：编译器 CLI 对齐 replay 已冻形态吃 `--sut <baseUrl>`（如 `casey compile <caseId> --sut <baseUrl> ...`），基址值来自 site.json 的 `target.startUrl` 投影或转发地址，绝不写死。
分岔三（events 落盘的 url 形态，草稿一 route:human ②）：
- 选项 A：完整地址落盘——events.json 从此携站点字面量，文件按凭据级对待、不进 git/报告（成本：fixture 与真产物双轨）。
- 选项 B：相对路径/路径段落盘，回放期与 `--sut` 拼接（events.schema 的 `url` 描述未禁相对形态；已冻 fixture 用假 host，形状不冲突）。
- 选项 C：基址占位符（如 `{{baseUrl}}`）+ `instantiate` 回填（与 `{{uniqueName}}` 同机制）。

**倾向 B**（凭据红线最省心、回放侧本就吃 `--sut`）；但「nav 到跨源页」场景 B 表达不了（本 flow 无此场景）——留 C 作升级路径，**route:human**。
**人签**：（空）

## G7 重表达残留决策（草稿一上升项）

1. **前置清理砍除**（草稿一 ①）：条件删除不可确定性回放。选项 A 砍除、残留靠保留前缀清扫 + `uniqueGuard` 建名查重兜底（倾向）；选项 B 保留线性版本（残留不存在时回放必红，等于把 flaky 冻进 spec，不建议）。**人签**：（空）
2. **抽屉遮罩 Esc**（草稿一 ⑥）：选项 A 记录为已知限制（遇遮罩 → 该步失败 → fail-safe 落 NEEDS_HUMAN，倾向——回放不猜）；选项 B 恒发一次 Esc `press` 事件（改变无遮罩路径行为，需真机验证无害）。**人签**：（空）
3. **intent 粒度**：断言原子折进前一 intent 的 `expected[]`（草稿一约定 2，倾向）；备选「断言原子独立 intent、零 event」会产生无 axes 的 intent、裁定无据，不建议。**人签**：（空）

---

## 附：本草稿未造新词自查

本三份草稿未登记新术语；「登录预备动作/`bootstrap`」若在 P3 契约正式采用，需先登记 CONTEXT.md（统一语言，ADR-0005）。
