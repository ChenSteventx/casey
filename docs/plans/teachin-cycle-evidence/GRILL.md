# GRILL — teachin-cycle-evidence（闭环取证边车，v3）

> 触发：真机闭环停 `RUN_COMPLETION_INVALID`、同码多分支+catch 吞真因不可诊断。
> Steven 裁定今晚挖穿。v1 初稿被 codex 三轮抬高，本版 v3 定案。

## 决策树（v3）

**D1 观测通道（codex H1，v3 收口）**：全链 exact-key 闭合——观测收集器
**不进任何 authority/入参/返回形状**。定案：模块级 `AsyncLocalStorage`，
`bin/record.mjs` 用 **`als.run(collector, () => 闭环())` 词法边界**包住单次
cycle（v3 弃 `enterWith`：无词法退出、迟到异步任务会串账——codex r2 中）；
聚合前**封存收集器**（封存后任何迟到 `safeEmit` 只计数不入档）；并发双 cycle
零串账入金牌（E8）。各生产点经统一 `safeEmit(point, payload)`——同步、
吞异常、零返回值消费、不进异步控制流。**模块拆分（codex r2 新高）**：
`cycle-evidence-context.mjs`（纯：上下文+safeEmit+枚举+收集器，**零 fs、
零 import output 件**，纯核心只许导入它）与 `cycle-evidence-output.mjs`
（四层闸+原子写+读取方 `readCycleEvidence`，**全仓 import 站点仅
`bin/record.mjs`**）——防传递依赖把写盘拖进双回放纯核心；依赖闭包入金牌
（E9 三钉，堵 context→output→fs 传递链与旁门导入）。
所有既有函数签名/键集/返回值**字节级不动**；production-boundary 金牌复跑作证。

**D2 归因枚举（codex H2；code-r1 M2 补签两员）**：新增闭合 `refusalPoint` 枚举，
**每个生产拒付点一员**——source completion 六分支（issuer-throw / result-shape /
artifact / raw-status / proof / observation）、resolved 同码组二员、distilled 同码组、
observer begin/finish（这两处现无 catch，v2 一并 safeEmit 通报——仍不加
catch 不改控制流）、formal replay（raw-axes-adapter）、prepared-runtime
两入口（claim / preflight）、orchestrator 阶段边界，外加 completion 公开导出面的
`extraInputs` 闭合键校验三员（`source-completion.input-shape` /
`resolved-completion.input-shape` / `distilled-completion.input-shape`）——这三枚分支在
canonical 编排下恒传闭合键而不可达，但函数由 `lib/dual-replay/index.mjs` 公开导出、
外部调用方可直达，A4 是「逐生产点唯一归因」，公开可达就得归因，不按「录制链不可达」挂账
（codex code-r1 M2 判挂账被拒）。`completeResolvedSourceReplay` 那枚与另两枚同形同理由，
只是拒付码为 `SOURCE_SEMANTIC_COMPLETION_INVALID`，一并接通——同形分支不留半接。
连 raw runner 逐事件面共冻结 **21 员**（金牌 E3 逐员钉，其中三员另配真实分支钉：
直调公开导出、传畸形 `extraInputs`、断言归因成员、拒付码与事件数）。逐事件面沿用
raw runner 的 `{seq, action, resolution, candidateCount, performOk, reason}`。
A4 验收=每个同码生产点可唯一归因（金牌矩阵逐点钉）。

**D3 凭据面（codex H3）**：**一切字符串出自固定枚举**——`stage`/`refusalPoint`/
`reason` 全闭合；异常名只认内建白名单（`TypeError`/`RangeError`/…），未知或
安全读取失败一律降格 `OtherError`（`name` 读取用 try + `Reflect.get` 防 getter
抛错）；数值字段限安全整数。落盘前四层闸：exact-key 白名单 → 类型/长度 →
URL/地址形态扫描（`hasEmbeddedScheme` 同口径）→ 规范化整文 `credentialGate`
末门。E4 覆盖 env 凭据串、任意 `error.name`、URL、getter 抛错、编码变体。

**D4 身份绑定与原子写（codex H4，v3 收口）**：边车顶层
`{schemaVersion, artifactKind: 'cycle-evidence', captureSha256, recordedAt,
stages, events}`（`stages` 冻结 12 员，按 orchestrator-core 编号步归组，
金牌为准）；**文件名按完整 digest 派生**
`cycle-evidence.<captureSha256 全量>.json`（v3 终修：12 位仅 48 位命名空间不够，全量零碰撞；E7 加「两 digest 前 12 位相同仍不同目标」用例）——异 capture 天然不碰撞，
误放旧档由「读取方只认 digest 匹配当前 capture、且顶层摘要复核内文」拦下（E7 收敛为**绑定单判**，
v2 的时间双判措辞作废；`recordedAt` 仅供人读）。
**威胁模型收窄（codex code-r1 M3 采信）**：边车是开发期诊断件、落点就是本次 run 可写的
out-dir，读取方防的是「误放/残留旧档被当成本次证据」，**不防**同一可写目录内的蓄意篡改——
协调改文件名与内文顶层摘要确实能把旧 `events` 冒充成当前档，但同一把写权限连 capture 本体
都能改，那已在本契约界外（要防须另立可信收据/manifest 链，属后继契约）。原子写时序（v3 终修，先闸后盘）：**内存内规范化/序列化→四层闸→才写临时文件→rename**——凭据拒写时零临时件零目标写入（E4b 钉）；写失败只清临时件、绝不触碰既有目标，CLI 报
`EVIDENCE_WRITE_FAILED` 非零。三码 `EVIDENCE_SCHEMA_REJECTED` /
`EVIDENCE_CREDENTIAL_REJECTED` / `EVIDENCE_WRITE_FAILED`——闭环结论原样，
请求取证而未产出合格边车时 CLI 非零。收集器语义
=「只追加、遇毒整批作废」（`append-or-poison`，白话：事件只能往后加，任何一条
形状非法就把整批标记为中毒、最终拒写——绝不静默丢单条冒充完整）。

**D5 金牌矩阵（codex H5，红先行）**：
- E1 形状：白名单键闭合、未知键→整批毒化；
- E2 吞异常路×3（source issuer-throw / resolved / distilled 各合成一例）→
  `{refusalPoint, errorName}` 记录、无 message、主结论原样；**另加一枚真实路径钉
  （codex code-r1 M4）**：不经合成替身，用零 SUT harness 铸 genuine source run
  authority，让现役 `executeAuthorizedSourceReplay` 真跑进 issuer 吞异常位，
  断言观测上下文收到 `source-completion.issuer-throw`——合成替身逮不到「通报接错
  或通报位多套一层包裹改了时序」这类回归；配套的 `cycle-plan` 静态门威胁模型按
  codex code-r6 写诚实：它是**协作文件的回归闸**（防重构走形、防迎合钉的 rig 回归），
  **不防**拥有本仓写权的对抗性混淆——那样的对抗者可以直接改金牌本身，静态门在该威胁下自反；
  评审逐轮反例是把门磨利的砂轮，不是门的验收标准——**验收标准只有一条：
  真件自然写法原样过、任何走形当场红**；
- E3 发射点矩阵：每个 refusalPoint 枚举成员至少一例合成击发（含 observer
  begin/finish、formal、prepared 各分支），三枚 input-shape 另配真实分支钉；
- E4a 异常名安全规范化组（任意 `error.name`、getter 抛错→降格 `OtherError`
  **成功记录**、不拒写）；E4b 凭据/URL 注入组（env 凭据串、URL、编码变体→
  整文拒写零落盘）——两组预期分开（v2 自相矛盾已拆）。E4b 判法分层：末门
  `screenCycleEvidenceText` 严判 `EVIDENCE_CREDENTIAL_REJECTED`；文档级注入
  因四层闸序早层可先拦成 `EVIDENCE_SCHEMA_REJECTED`，故只判拒写+拒付码落
  三码闭合，不倒裁到预定码；
- E5 缺省零行为差：同输入双跑（带/不带观测上下文）——返回对象深等 +
  **产物字节全等** + 各 authority 调用/关闭次数相等 + 不落任何边车文件 +
  控制台输出全等；**E5c（codex code-r1 M4）**把双跑从入口入参校验推进到现役
  source completion 真发射通报的那一层（零 SUT harness）；带真实浏览器的活体段
  仍由 §3 的 A4 真机重录承接，本金牌如实标注不冒充覆盖；
- E4c 凭据闸隔离根（codex code-r1 M5）：金牌把自己重启进一枚隔离根
  （`lib`/`bin`/`tests`/`node_modules` 均符号链接指向真仓，`.auth/credentials.json`
  与 `site.json` 是合成夹具，子进程 `--preserve-symlinks`），于是传递依赖
  `screenCycleEvidenceText → credentialGate → collectSecretLiterals` 的凭据源
  恒落隔离根内。自证钉由「扫本文件 readFileSync 字面量」升级为三重机制证据：
  凭据源路径解析进隔离根 + 合成夹具字面量真被闸吃到（正控）且干净整文仍放行（负控）
  + 读盘探针逐条核路径（真仓 `.auth`/`site.json` 零读取）。生产件零改动，
  凭据源**不加任何注入口**——给闸开注入口等于给闸开后门；
- E6 收集器中毒钉：敌意/异物收集器（含抛错 getter 载荷）→ 全部发射点
  吞掉、闭环结论与 E5 基线全等；
- E7 身份绑定：captureSha256 失配读取拒认（绑定单判）；旧档在场+本次拒写→
  CLI 非零且旧档不被误认；两枚完整 digest 前 12 位相同→不同目标文件；
  钉的是「误放旧档不被当成本次证据」，不钉「可写目录内蓄意篡改也测不出」（威胁模型见 D4）；
- E8 并发双 cycle（各自 `als.run`）零串账；
- E9 依赖闭包三钉：①`cycle-evidence-context.mjs` 源零 `node:fs` 且零 import
  output 件；②output 件全仓 import 站点仅 `bin/record.mjs`（全仓扫描断言）；
  ③各纯核心件（completion 等）取证相关 import 只指向 context 件。

## 挂账（route:human）

- 新金牌冻结人签；仪表落地后 Steven 重录取真因；真因修复=后继契约。
