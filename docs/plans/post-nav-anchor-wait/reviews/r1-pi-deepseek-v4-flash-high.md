评审完毕。以下是核验过程与结论。

## 核验记录（全部实证）

| 项 | 结果 |
|---|---|
| 全量 diff | 恰 6 文件、379+/1-，白名单外零改动 |
| 金牌（HEAD） | 5/5 exit 0 |
| PRD `testChecksums` 三条 sha256 | 自算逐字节相符（golden `b4fb3a78…`、plan `38f50d24…`、red `c82fc0f4…`） |
| 红证真实性（/tmp 回退 04803c1 两 lib 文件实跑） | exit 1、2/5（S1/S2/S5 红、S3/S4 绿），与提交红证**逐字节一致**（仅去 2 行头注）；复原后 sha256 与工作树逐字节相同、再 exit 0 |
| 邻接 | wf-create-entry-anchor-wait 0、wf-crud-sleep-import 0（S4 普查钉实证覆盖 nav 新消费点）、login-nav-budget 0、term-lint --registry 0、selftest --tier1 0 |
| wf-open-smoke（闸直邻，非本契约声明邻接） | HEAD 红；**基线同红**（原子数钉 18 vs 26 + 身份绑定环境）→ 既存陈旧，非本契约引入 |
| sleep 导入（风险 6） | support.mjs:7 导出、nav 无本地遮蔽、support 不 import nav/crud 无环、其他导出逐字节未动 |

## 静态结论（风险 1/2/4 核对）

- **风险 1**：锚与闸探针定位器语义**完全同一**（均 `getByText(instantiate(openName), {exact:true})`）；多命中 n>1 时锚先 break、闸重采样 n>1 跳容器判定交 emit 身份门——fail-closed 不变，仅极端时序下 resolution 标签 absent→ambiguous（同样 route:human、不 acted），无安全位移；容器外命中 blocker 路径由「absent」升级为「点名容器外」是诊断增强非行为回退。
- **风险 2**：真缺席路径的 rollback/mark、候选 evidence 全文、note 文案逐字节保持（红证 S2 evidence 与修复后 S4 断言同形已验）；锚轮询零事件副作用（S4 钉 rollback 后 `emitted.length===0` 通过）。
- **风险 4**：S2 能挡「删锚/改 waitFor/减预算」回退（行为钉 + 采样≥2）；S1 的 `evaluate 恒 true` 无法表达容器外形态——闸 fail-closed 面只由 wf-open-smoke C5 钉，而 C5 现处既存陈旧红（非本契约责任，建议另期重钉）；S5 切片中 `count()` 只存在于真实轮询代码（注释未含），故「锚代码移至闸下」会被 S5 拦，残留缝仅剩对抗性「注释与代码分离」——本仓结构钉惯例内可接受。

---

## Findings

- **[Medium] lib/compile-atoms-workflow-nav.mjs:78-80 与 lib/compile-atoms-workflow-crud.mjs:294-296 ——失败路径最坏时长再 +15s×2**：叠加 login 30s 天花板、create 入口锚 15s、每 emit 定位窗（resolveTarget 1.5s + quietPoint）后，全耗尽链路（容器已挂载但卡片/搜索框永不挂载、无身份通道提前 abort 的形态）估算 ~85–100s，距 compile 看门狗 120s（bin/compile.mjs:267，武装于浏览器启动前、覆盖 login+flow）余量仅 ~20–35s，较本契约前（~50–65s 余量）显著收窄；若 flow 再含 addNode/connectNodes 类自带 5s waitFor 的原子，存在逼近/越线的可能。与 login-nav-budget 已挂账的 pi Medium 同一观察面，本 PRD observability 亦已 route:human 并记「B4 六跑记录总耗时」——建议：六跑实测全链路最坏耗时并核看门狗余量，必要时为同面锚点做预算共享或抬高看门狗。**
- **[Low] lib/compile-atoms-workflow-crud.mjs:302-306 ——CASE_DEFECT 候选 evidence 不记录「已做过 15s 有界轮询」**：缺席判定现在只在耗尽后才成立，但 evidence 仍写 `count: 0` + 「全 DOM count===0」，阅者无法区分 t=0 即时缺席与轮询 15s 后缺席；建议在候选 evidence 或 note 补 `waitedMs`（或 awaited 标志），保持诊断可核。
- **[Low] tests/_golden/post-nav-anchor-wait.zero-sut.golden.mjs:62 ——S1 容器归属探针 `evaluate 恒 true`，金牌无法检出闸的 fail-open/容器选择器回归**（如 closest() 列表丢 `.agent-card`）：闸 fail-closed 面仅靠 wf-open-smoke C5 钉，而 C5 当前因既存陈旧（原子数钉 18 vs 26）红着——建议另期重钉 C5，本契约内以 B4 六跑真机作闸 fail-closed 的复核载体（PRD 已 route:human，可接受）。
- **[Low] tests/_golden/post-nav-anchor-wait.zero-sut.golden.mjs:234-249 ——S5 结构钉文本耦合**：切片依赖注释词组「容器归属闸」与代码串 `const n = await search.count()`，注释改写会误红；本仓结构钉惯例、PRD 已声明注释措辞避让纪律，可接受，不构成阻断。

「零 Critical/High」；Medium 1 条（与 login-nav-budget 已接受并 route:human 的 pi Medium 同面、增量 +30s，PRD 已挂同面观测），Low 3 条。红证真实、校验和相符、突变闭环复现、邻接全绿、风险 1/2/6 静态核对无行为位移。

IMPLEMENTATION_VERDICT: APPROVE
