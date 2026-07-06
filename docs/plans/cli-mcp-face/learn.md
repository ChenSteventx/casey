# cli-mcp-face — learn（light，codex 两轮 R2 PASS）

上下文：三面统一标识符（CLI/skill/MCP）后两面滞后 CLI 现状三个月量级；CLI 三分发桩接通 +
MCP 工具目录 6→12 + skill 命令映射对齐 + 漂移锁金牌（C1–C7）。

## 1. 「门面滞后」是无人报错的债——薄壳面要有漂移锁

底层 bin 各自收口了、run 编排内部直连在用，但 CLI 分发桩、MCP 目录、skill 映射三处门面全在
说旧话（照 MCP 目录调用 `casey_run` 必 exit 64、`verdict` 误标「尚未实现」）。门面不在任何金牌
覆盖下就没人看见它烂。修法不只是对齐一次，是留一枚漂移锁金牌让「下次滞后」变成红。

## 2. 映射层的锁 = 导出映射表直接 deepEq，胜过行为探针

R1-F1 说得对：空参用法错探针证明不了旗标拼写/kebab 转换没漂。行为探针要为每个旗标构造可观察
差异、成本高且有盲区；把 `TOOLS` 导出、对 `toArgs` 全量入参做 argv 数组 deepEq，一张表钉死全部
映射语义（含「布尔 false 不拼旗标」这种行为探针很难覆盖的负形态）。副作用（模块导入挂 readline）
用显式 `process.exit` 兜——比为可测性重构传输层便宜得多。

## 3. 组合正确性可以分层锁，不必端到端重烧

R2-F2 要 MCP 层跑全链 happy——修正采纳成「映射层 deepEq + CLI 层既有全链金牌 + 单通道 callCli
的代表性 happy（便宜的 ingest 真产物）」三件套：两层各自钉死、中间只有一条共用通道，组合面
无第三处可漂。评审员收了。分层论证要点名「两层之间还剩什么」，剩的那条通道给个代表性实证。

## 4. 历史退出码不整形、先如实标注

`report` 用法错是 exit 2（早于 64 约定成型，与 casey 的熔断类语义撞车）。本契约不动它——改码
会涟漪 report 全家金牌；但在三处（MCP description、skill 进度段、金牌期望表例外项）如实标注，
收敛另案挂账。诚实标注的债 < 静默不一致的债 < 顺手重构的险。

## 挂账（不静默丢）

- report 退出码收敛（2→64）另案（动 bin/report.mjs + 其金牌涟漪），记 `prd-cli-mcp-face` observability。
- MCP 真机挂载核验（`claude mcp add` 后 tools/call 实调）route:human。
- skill/MCP 与 CLI 的三面一致性目前靠本金牌锁 CLI↔MCP 两面；skill 文档面（md 表格）无机器锁，
  滞后风险仍在——若再犯可考虑把 skill 命令表生成化（单一事实源产出），属另案。
