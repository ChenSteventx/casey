# agent-id-readback · learn（阶段 5 沉淀）

> 状态注记（2026-07-22 晚，交接时点）：评审未闭合——R1 FAIL(1C+6H+3M)→修单→R2 FAIL(H1/H6/M1
> PARTIAL、7 FIXED、零新增)→H1/M1 二波已修、H6 余 sol 五面构造未实现（sol max 咨询 CHANGES
> REQUIRED，构造清单见 review/fix-dispositions-r1.md 末节）。gate 第四轮 GREEN 6/6。plan §6 修正
> 与 codex R3 随五面实现走（Steven 2026-07-22 拍板交接下一 session）。本文教训按已发生事实成稿，
> R3 收口后补终判记录。诚实标注，不预支结论。

## 交付结果

- 智能体平台 ID 网络信封读回 + DOM/信封双证门全链落地：请求级身份观察事务（arm→settle→seal→consume，
  归属在 requestWillBeSent 时刻冻结、有界终态、一次性消费）+ 双证判定纯函数（完整性先决→同名计数→
  唯一行联合判据→三方全等放行）+ 编译 v2 草稿双 digest 接线 + sign 五元 join 对账 + 回放点击前对已签
  platformId 比对（双定位闭合到点击那一刻）。
- 验收面五金牌 + 存量回归四金牌 + tier1；真机活数据双证实证绿（evidence/realmachine-live-verify.md）。
- codex 异构评审 R1 FAIL（1C+6H+3M）→ 修单全采信修复（红对抗钉+无实现态重钉红）→ R2 复审收口。

## 教训与沉淀

1. **「协议写全了、接线只接一半」是本契约的中心病灶**：观察事务/双证门纯函数按 plan 写得很全，
   但编译产物没升 v2——sign 的整条 v2 对账链对真实产物是死代码，五金牌各自绿掩盖了「链没接通」。
   修单钉法=真实 compile→sign→replay 全链金牌（C6），手造 v2 只允许作 sign 面单元考场。
   往后任何「A 产、B 验、C 消费」的多段协议，验收必须至少含一条不许手造中间件的端到端链。
2. **DOM 证据要「物理句柄级」而不是「读了个名字」**：name 单锚+全页 getByText 重定位=双证门降级回
   DOM-only 门还留 TOCTOU。正门是 entity-ui-wiring learn #2 的老教训在新原子上重犯——身份门类实现
   第一版就该按全协议写（同卡读双锚、点击前同句柄重验、句柄内落笔）。
3. **判定序是安全属性**：先跑 DOM 门再消费信封，会把「完整性证不出」洗成 ambiguous/absent。
   完整性先决优先于 DOM 分类必须由接线顺序兑现，纯函数门对了不够。
4. **义务集合绝不由被验件自报驱动**：sign 用观察件自报 source.atom 找终端 click=矛头可被转移。
   义务集合一律从已签 events 按字面量独立推导，自报字段只许被校验、不许被消费。
5. **「声明即义务」的缺席语义要显式**：hasNextPath 声明后字段缺席被 undefined 放行=声明变摆设。
   剖面声明的每个路径都要写清缺席时的拒绝分支，禁靠 falsy 巧合。
6. **poison spy 用真实加载证据，不用源码 grep**：静态 import 扫描逮不住间接拉入（compile-atoms 静态
   import 身份门，扫 replay-forensics 恒绿）。node --import 解析钩子探针 + 正负控是零 SUT 可复用配方；
   配套纪律：可选通道模块一律动态按需加载。
7. **冻不确定字节=制造 flaky 假红**：plan 允诺的「CLI 三流+完整产物集逐字节」面撞上 receipt 等
   跨运行确定性未证的字节，诚实处置是缩窄披露（interface-spec §7 + prd checksumAmendments）
   换行为钉覆盖，并把裁定权交给异构评审，而不是硬冻或静默砍面。
8. **修单红证的合法路径复用顺畅**（entity-ui-wiring learn #4 第三次实证）：断言零弱化 + git stash
   外科式无实现态重钉红（金牌/夹具/规格留场，只 stash 实现）+ checksumAmendments 记账。
9. **「不可达/不确定」的断言必须先实测再落账，异构评审逼出两次收回**：① R2 前我按直觉断言
   「sign 产物跨运行字节不确定（receipt 之类）」并据此缩窄义务——双跑探针实测六产物+prd+三流
   全同，假设收回、面照冻（还顺手拿到「v1 路径逐字不变」的机器证据）；② 我断言「动作轴/axes/
   report 字节面零 SUT 不可达」——sol 给出 mock 替身驱真实生产函数的完整构造，判定不成立。
   两次都是同一型错误：把「我没想到做法」当「物理不可达」。先探针、后断言；说不可达前先问
   「替身能不能把浏览器边界外的生产代码全部驱起来」。
10. **回放 press→click 零等待是旧 DOM-only 门在 fetch 渲染页上的固有竞态**（gate 两轮 C7 none 红
   实证；settleBeforeCapture 只跑 intent 末事件、searchOpen 末事件即 click）。考场治法=确定性化
   （idtwins-sync 同步渲卡），不用重试遮竞态；真机侧该竞态的实际影响随真机链义务评估。

## 挂账（route:human，见 prd observability）

- 完整真机用例链：执行权威→sign 消费观察件→回放点击前对已签 platformId（hermetic 配方已全链绿，
  完成闸仍=真机，ADR-0009）。
- 同名敌意真机用例（预置一对真同名智能体验 AMBIGUOUS）；runtime adapter 同源读回。
- 密钥签名威胁面（内容自哈希不防有写权限者整链重算，ADR-0010 口径如实挂账）。
- axes/events/report 字节级差分面依赖浏览器执行，随真机链义务处置。
- SKILL.md 执行边界条文与范围化例外实践的措辞统一（Steven 另日处理）。

## 合并注意（给 dev 合并会话）

- 本分支含 lib/bin/mcp/夹具/五金牌/剖面 schema 扩展（listApi.queryParam 必填 + cardFields）/
  interface-spec 修单/prd 重钉。合并后主树复跑受影响金牌（护栏 #19）。
- 剖面 schema 收紧对存量的影响=零（未声明 agents.listApi 的剖面零行为差；真机身份剖面在 route:human
  链上线时补 queryParam/cardFields）。
- worktree node_modules 是指回主树的符号链接且不入库，树退役自然消失。
