# plan-debt-sweep — grill 决策记录（full）

> 授权链：Steven 三问之二「对照计划复核遗失」+ 点单排序③「计划欠账小清洗」；四件欠账全部来自
> 2026-07-07 四路审计（A/B 组）逐锚点产出。件 1 的承重决策 Steven 早已签（2026-07-02 晚 ⑥
> 「同意——自动提取 ?v= 查询串」），本契约只是兑现接线；其余三件机械对齐事实，零新决策。

## D1 capturedAgainstBuild `?v=` 提取接线（compile 执行段加法）

- 兑现 Steven 决议：编译执行段结束、投影 observed 前，从当前页 `document.scripts` 的 `src` 提取
  首个 `[?&]v=<发版号>` 查询串填 `capturedAgainstBuild`；**取不到/异常照旧 null（fail-safe 方向
  一字不变）**。SPA 下脚本跨路由常驻，尾页提取即入口提取。
- 夹具：fake-sut 加法场景 `versioned`（pageHtml 条件注入 `<script src="/api-config.js?v=9.9.9-test">`
  + 该路由回 200 空 js）；既有九场景渲染字节零动。共享夹具冻结归属仅 `prd-p5-replay` 一家——重签 +
  其 gate 复验。
- happy 场景照旧 null（金牌双向钉：versioned 提取到 / happy null）。

## D2 冻结期易变字面量 lint（sign 门加法，护栏 #5 冻结面 → full 依据）

- 计划 P2 验收「冻结期 equals-字面量 lint」只在草拟期兑现（validateDraft）；sign 是冻结落盘唯一口，
  手编草稿/重签路径可绕草拟闸。加法：sign 在 schema 严校后对全部断言字符串值跑同款两正则
  （未模板化 `atl_` 字面量 / 9+ 位连续数字长串），命中 die 65 零落盘。**正则与 validateDraft 逐字
  同款**（单一事实源候选：本轮先镜像 + 注释互指，抽公共件属另案——两处 2 行不值抽象税）。
- 覆盖全部 op 不只 equals（validateDraft R1-F2 先例：contains/matches 冻会话 ID 同罪）。

## D3 CONTEXT.md 三词条失配修（术语表是唯一事实源，失配污染草拟与评审）

- `verdict.json`：删「passes + 期望对实际字面量 + 取证引用」富形状描述，改为冻结实现的最小五字段
  （{stepId,intentId,atom,verdict,reason}）+ 指明富信息在 report-model.json（report-spec §4 已裁）。
- `trace`：注明「未建挂账」（全链无 tracing 调用，报告 traceRef 恒 null）。
- recorder-as-library：标「已被 ADR-0006 atoms/flow 编译路线取代（陌生站点孵化支线保留概念）」。
- 词条改后 `term-lint --registry` 必须仍绿（四列制不破）。

## D4 设计文档勘误对账表（防零上下文读者按过时文面走死路）

两份设计文档头部各加「与实现的已知偏离（对账表）」短节，逐条列审计确认的偏离与真身指针：
mp4 内嵌→webm 独立文件+报告引用；recorder-as-library→atoms/flow（ADR-0006）；sv2 prd 字段实际形态
（caseId/channel/expectedFrozenPath，签署元数据在 expected.frozen 旁车）；trace/截图未建；§3.1
progress 哈希未建；取证「标注」小节只进机读 model 未进人看 HTML；countChange 计数选择器待走通道剖面。
只加对账不改正文（正文是历史决策记录，勘误表是活对账）。

## D5 非目标

不抽 lint 公共件（另案）；不实现 trace/截图/进度哈希（对账表如实挂账即可）；不动 verdict/gate
冻结内核；真机 `?v=` 提取实证 route:human（随下次真机行程顺带核）。
