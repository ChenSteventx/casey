# GRILL — p9-tier2-live-smoke（P9 tier-2 真机冒烟自检）

> 触发：Steven 2026-07-29 定「今天把 P9 做完」。tier-2 现状=`bin/casey.mjs:313`
> 唯一桩（exit 3）。侦察报告（Explore 2026-07-29）为本纪要事实源，引用见其原文。

## 一、边界事实（先钉死，防撞冻结令）

1. **「gate live」层不可建**：ADR-0009 把真机 UAT 证据层指向 gate live，但该族属
   loop 改革冻结面（Steven 2026-07-22 令，解冻唯一条件=Steven 明确要求）。本契约
   **不碰** gate 分层——route:human 门用现有机制落地：prd `observability` 挂账 +
   人裁记录文件 + 报告交付，机器绝不自动翻绿（ADR-0009 语义由此承接，机制不另造）。
2. **MCP 面不动**：selftest 属自检类、按 casey-doctor 契约 GRILL D9 不进 MCP 工具
   目录；`cli-mcp-face` 冻结的 `['selftest','--tier1']` 映射零改。
3. **凭据纪律**：tier-2 输出与证据零凭据值、零真目标地址（doctor 同款口径）；
   `--sut` 只吃隧道回环基址。

## 二、决策树

**D1 tier-2 到底验什么？**（P9 定义：live smoke 覆盖 SUT_DEFECT/取证/流式分支、
gated route:human）定案：tier-2 验的是**分支机器面在真机上真实运转**，不是分支
结论的语义真值（后者 route:human，ADR-0009）。**覆盖矩阵必须非空**（codex r1 H1）：
三面各须至少一条已授权用例真实行使——流式面无合格件（含硬 `streamReplyReceived`
的已签用例）时 exit 2 而非绿，条件式检查不得空转成全绿。具体三面：
- 取证面：真机 run 的 `axes.json`/`report-model.json` 含按发起方归因的网络取证结构、
  生命周期取证在场、凭据兜底门扫过（字节级复扫零命中）；
- 流式面：含 `streamReplyReceived` 断言的用例其硬断言被真实裁过（只判回完，
  bodyText/耗时绝不入裁）；
- SUT_DEFECT 面（v3 加固，codex r2 High）：**不造假缺陷**（用户已裁不许真造
  500；代理注入路挂 P3 grill 账）——通道健在的证明升级为**真调现役
  `verdict.mjs`**：tier-2 内置冻结三轴反例集（SUT_DEFECT 两到达口、错步归因、
  catch-all）逐条喂当前裁判二进制、断言产出四态精确（这是对裁判本体的
  运行时冒烟，非产物 well-formed 松证）；历史真机先例作为证据引用须**按产物 hash 绑定**进证据文件——先例修正
  （金牌起草期全仓普查实证）：07-22 三链为全 PASS，`SUT_DEFECT` 真先例是
  attestation run-1 真 503（在册文书带 hash）与 `runs/p0-real-sut-20260716/formal-publish`
  （盘上 verdict 在、无在册文书，正签时裁是否补录）。健康 SUT 下 SUT_DEFECT=0 是**合法结果**不是覆盖缺口——把
  「必须见到 SUT_DEFECT」写成验收就是逼人造假。
- 附带（工装完整性）：登录引导、录屏、报告三件套、退出码归一在真机全链成立。

**D2 命令形态（v3：suite manifest 人签冻结，codex r2 Critical）**：
`casey selftest --tier2 --sut <回环基址> [--case <id> 可多次]`。用例集**不做动态
发现**——「已签+准入可过」不等于授权周期性 live smoke（变更型用例被周期跑=
未经授权改真实环境）。改为人签 manifest（`cases/tier2-suite.manifest.json`，
冻入本契约 prd checksum）：逐例记 artifact hash、effect 类别、超时、清理义务、
smoke 授权标志；变更型用例入集须 Steven 逐次明确授权；`--case` 只能选 manifest
内成员且数量有上限（超限 exit 64）。每例走生产 `runPipeline` 同链（相 3-4-6），
不自建第二条编排。**tier-2 专用严格解析器**（codex r1 M6：现役解析器 `--case`
后值覆盖前值）：重复 `--case` 收数组、拒缺值/重复 case/危险 caseId/未知参数/
`--tier1 --tier2` 并出/非回环 `--sut`。凭据扫描时序硬定（codex r1 M7）：
**原始文本字节先扫**（含子进程 stdout/stderr 与目标地址形态）→ 解析 →
白名单投影 → 证据文件落盘前再扫 → 命中即零证据落盘（fail-closed），
不许「先投影后扫」洗掉白名单外嵌套敏感值。

**D3 壳/纯分层（doctor 模板）**：新 `lib/selftest-tier2.mjs` 纯层（零 fs/spawn/net）
吃「run 产物投影 + doctor 项 + 环境形状」出逐项判定与退出码；`bin/casey.mjs`
壳层只采集与转发。金牌全部打纯层 + 壳层 spawn 稳定输出（hermetic 可验），
真机 live 跑本身不进金牌（ADR-0009：那是人签面）。

**D4 退出码与失败归类（v2 按 codex r1 H2 重构）**：per-case 产**机器可读
run receipt**，区分 `pipeline_complete_with_verdict`（产物齐全+四态合法——机器面
已运转，业务非 PASS 属 route:human 语义面，**不判机器红**）与 `stage_failed`
（工装面红）。总退出码：0=覆盖矩阵非空且全部机器面绿；1=任一 `stage_failed`
或证据判定红；2=前置门失败/覆盖矩阵空（fail-closed 不空转）；64=用法错。
凭据/登录/隧道类**系统性故障立即停全集**（不继续轰余例），单例业务性失败记
receipt 后续跑。exit 0 尾行固定「机器面绿≠完成，须人签真机 UAT（ADR-0009）」。
前置门显式清单（codex r1 H3）：凭据形状、登录引导（**逐例强制
`--login-bootstrap`**，production 受众锁无登录必被凭据上下文门拒）、执行目标、
隧道监听、带外账户回执标志、两段真实连通证据；doctor 现役探针私有且 `main()`
无条件执行——须先做**结构化采集复用重构**（探针导出化，行为零变化）再复用，
不许照抄私有函数。

**D5 P9 验收口径账（v2 补全，须 Steven 明签不代签）**：bootstrap plan `:177`
说 tier-1 含假 SUT 管线+四态徽章，实现不含。修订须**三层证据分别交代**
（codex r1 H5）：①管线义务处置（明记 waiver 或替代证据，不许只删）；②分类四态
证据=`p2-verdict` 金牌（只核 `verdict.json` 四态）；③**徽章渲染证据=
`p7-report` 金牌**（p2 不能证明徽章）。同步修订面：bootstrap plan、
`CONTEXT.md:156-157` 旧两层定义、README/help 文本。

**D6 完成判定两层分离（v2 按 codex r1 H4 重构）**：
- 「tier-2 实现契约完成」＝金牌绿 + gate 绿 + 联审闭环 + 真机机器面 exit 0；
- 「P9 需求完成」＝真机 UAT 清单**全部人签通过**（bootstrap `:182` + ADR-0009
  原义，不弱化）——任何 open/pending 项保持 P9 open，除非 Steven 对该项
  **明确 waiver**。人签落成仿 `real-uat-attestation/evidence/uat-signoff.md`
  形制：签认人、run 目录、产物 hash、逐项结论，文件冻入 prd checksum。
  冻结令禁建 gate-live，ADR-0009 的流程强制义务继续挂账、不宣称已机制兑现。

## 三、挂账（route:human）

- D5 的 P9 验收口径修订签字；
- tier-2 live 全集跑完后的 UAT 逐项人签；
- SUT_DEFECT 代理注入路（P3 grill 账，本契约不动）；
- claude 侧 MCP 真挂载核验（等额度）。
