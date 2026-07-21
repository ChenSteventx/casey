总判：**plan v1 有阻断项，不可进 accept。** 数量账与大方向基本正确，但 A 家族仍有错因假绿，B2/B3 按现方案无法闭合，反向突变与清理门也不成立。

## 逐条结论

1. **不成立——共享 MAPPING 能修 happy，但“负向零误伤”不成立。**

   两行补绑定确实会修复共享 happy 路径：[flow-bridge.golden.mjs:39](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:39)、[ingest.golden.mjs:42](/mnt/d/ctx/heren/casey/tests/_golden/ingest.golden.mjs:42)。C9 不一致分支在实体闸前即拒：[bin/flow-bridge.mjs:43](/mnt/d/ctx/heren/casey/bin/flow-bridge.mjs:43)；C11 的 `mapOne/MAPPING` 会随共享修复得到绑定：[flow-bridge.golden.mjs:149](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:149)。

   但以下负向仍缺绑定，仅断非零，后置闸回退也会继续绿：

   - C4 未知原子：[flow-bridge.golden.mjs:82](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:82)
   - C6 `badPrefix`：[flow-bridge.golden.mjs:102](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:102)
   - C7 两个投影分支：[flow-bridge.golden.mjs:115](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:115)
   - C15 桥拒半段：[flow-bridge.golden.mjs:192](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:192)

   C5 虽也混入实体错误，但已有“编译知识”精确断言：[flow-bridge.golden.mjs:90](/mnt/d/ctx/heren/casey/tests/_golden/flow-bridge.golden.mjs:90)，不是纯错因绿；仍建议补绑定以隔离原因。修法：给 C4/C5/C6/C7/C15 中所有非目标原子补合法 subject 绑定，并逐条断精确目标诊断；C10 可保留“任一闸拒不留半份”的宽口径。

2. **不成立——反向锁方向对，但突变证伪设计错了。**

   内核已经提供精确原因 `ENTITY_BINDING_REQUIRED_ROLES_INVALID`：[entity-semantic-lock-preflight.mjs:481](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:481)、[entity-semantic-lock-preflight.mjs:489](/mnt/d/ctx/heren/casey/lib/entity-semantic-lock-preflight.mjs:489)，桥闸会把原因带到 stderr：[flow-bridge.mjs:132](/mnt/d/ctx/heren/casey/lib/flow-bridge.mjs:132)。因此必须断 exit 65、精确错误码、零落盘。

   [plan.md:50](/mnt/d/ctx/heren/casey/docs/plans/flow-bridge-golden-refit/plan.md:50) 的“移除夹具 entityBindings → 必红”不能证明内核放宽会被抓住；缺绑定本来就是该反向锁的输入。应临时注入“允许 mutation 无绑定”的内核 mutant，或绕掉 `requiredFlowEntityBindings` 调用，确认金牌必红后还原。

3. **需补证——NODE_OPTIONS 链路静态上成立，降级判据不机械。**

   MCP server、CLI、intake 链上均未覆盖子进程环境：

   - MCP server 启动：[cli-mcp-face.golden.mjs:27](/mnt/d/ctx/heren/casey/tests/_golden/cli-mcp-face.golden.mjs:27)
   - server → CLI：[mcp/casey-server.mjs:142](/mnt/d/ctx/heren/casey/mcp/casey-server.mjs:142)
   - CLI → intake：[bin/casey.mjs:46](/mnt/d/ctx/heren/casey/bin/casey.mjs:46)
   - intake 直接导入 authority root，不再 spawn：[bin/intake.mjs:9](/mnt/d/ctx/heren/casey/bin/intake.mjs:9)

   所以继承推理成立。但“缺三件套”负向只命中 intake 前置闸：[bin/intake.mjs:61](/mnt/d/ctx/heren/casey/bin/intake.mjs:61)，证明不了 loader 到达孙进程。修法：用同一份合法三件套跑两个独立 MCP server：

   - 无 loader：精确 `DRIVER_NOT_PUBLISHED`、exit 65、零 ledger。
   - 有 loader：exit 0、accepted ledger。

   只有“包已验证且唯一失败是 loader 未传播”才能触发降级；任意 accept 红不能作为判据。并须改写仍声称“真 record→MCP intake”的 PRD task/story/observability：[prd-mcp-parity.json:3](/mnt/d/ctx/heren/casey/loop/prd-mcp-parity.json:3)、[prd-mcp-parity.json:10](/mnt/d/ctx/heren/casey/loop/prd-mcp-parity.json:10)、[prd-mcp-parity.json:17](/mnt/d/ctx/heren/casey/loop/prd-mcp-parity.json:17)。

4. **不成立——B2 的“20 字段重写后保住原语义”不成立。**

   原真接缝是 `record → intake`：[record-distill.golden.mjs:33](/mnt/d/ctx/heren/casey/tests/_golden/record-distill.golden.mjs:33)。改形后仍能保住真 intake、真 distill、三件套、签名根、committed ledger、投影/忠实闸/输出卫生；明确丢失的是 record producer、布局兼容及 record→intake 接缝。

   更关键的是，rehydrate 在读 ledger 前先做 package、闭合身份包和 receipt 校验：[teachin-observation-authority-root.mjs:702](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:702)、[teachin-observation-authority-root.mjs:707](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:707)。编码凭据与不收敛也已在闭合 validator 前置拒绝：[teachin-identity-package-validator.mjs:167](/mnt/d/ctx/heren/casey/lib/teachin-identity-package-validator.mjs:167)、[teachin-identity-package-validator.mjs:175](/mnt/d/ctx/heren/casey/lib/teachin-identity-package-validator.mjs:175)。因此仅把 C2d/C2f/C2h 的旧 ledger 改成 20 字段，仍到不了原 distill 拒因；尤其 C2h 原先钉死 exit 1 +“不收敛”：[record-distill.golden.mjs:190](/mnt/d/ctx/heren/casey/tests/_golden/record-distill.golden.mjs:190)，新链会先以 authority `CRED_GATE_HIT`/exit 65 拒绝。

   修法：

   - C2d 明确改成 authority closed-package/rereview 拒绝；
   - C2f/C2h 要么诚实改为精确 `CRED_GATE_HIT`、exit 65，要么另建纯函数用例保留 distill 本地门；不得声称原行为级语义未变；
   - PRD task、observability、story 全部改写：[prd-record-distill.json:3](/mnt/d/ctx/heren/casey/loop/prd-record-distill.json:3)、[prd-record-distill.json:10](/mnt/d/ctx/heren/casey/loop/prd-record-distill.json:10)、[prd-record-distill.json:25](/mnt/d/ctx/heren/casey/loop/prd-record-distill.json:25)；
   - `record-three-piece-producer` 须登记精确丢失断言、接手条件与 route，不只留一个名字。

5. **不成立——外部跑后检查不足，必须金牌内 finally。**

   租约 cleanup 会先核目录和 marker 身份再删：[canonical-case-lease.mjs:65](/mnt/d/ctx/heren/casey/tests/_golden/support/canonical-case-lease.mjs:65)。现役正确先例在 finally 中检查结果并使失败转红：[observation-cli-authority-wiring.zero-sut.golden.mjs:184](/mnt/d/ctx/heren/casey/tests/_golden/observation-cli-authority-wiring.zero-sut.golden.mjs:184)。

   当前 record-distill 的 `fail()` 直接 `process.exit(1)`：[record-distill.golden.mjs:16](/mnt/d/ctx/heren/casey/tests/_golden/record-distill.golden.mjs:16)，不会展开外层 finally：[record-distill.golden.mjs:232](/mnt/d/ctx/heren/casey/tests/_golden/record-distill.golden.mjs:232)。而 `cases/` 被忽略，[.gitignore:11](/mnt/d/ctx/heren/casey/.gitignore:11)，`git status` 看不见残留。

   修法：B1/B2/B3 每份租约均入 `try/finally`；把 `process.exit` 改为 throw/失败汇总；`cleanup().ok !== true` 必须令金牌自红。外部目录扫描只作第二层验收。

6. **需补证——22 个 PRD 数量正确，但 dry-run 不能做结果分类。**

   `gate --dry` 在 acceptance 处直接跳过执行：[gate.mjs:89](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:89)、[gate.mjs:92](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:92)；只有非 dry 才更新 passes/evidence：[gate.mjs:106](/mnt/d/ctx/heren/loop-kit/bin/gate.mjs:106)。所以 accept 前可以冻结“命令 + 传递 spawn 安全性 + 预期翻转”矩阵，不能靠 dry 得到红绿分类。

   顺序应为：所有金牌、语义 PRD、checksum 一次性定稿并人签 → 静态安全闭包 → 再按固定 22 项顺序复 gate。尤其 record-distill checksum 必须先更新，因为 authority-root 金牌会读取并复核它：[teachin-observation-authority-root.zero-sut.golden.mjs:420](/mnt/d/ctx/heren/casey/tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs:420)、[teachin-observation-authority-root.zero-sut.golden.mjs:426](/mnt/d/ctx/heren/casey/tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs:426)。不要边修边 gate。

7. **成立（明确判词：另立 direct 小契约，不搭车）。**

   该用例确实仍是 30s：[observation-active-suite-contract-v2.zero-sut.golden.mjs:15](/mnt/d/ctx/heren/casey/tests/_golden/observation-active-suite-contract-v2.zero-sut.golden.mjs:15)，而它会把同一 SAFE_V2 跑两遍：[active-suite-v2.json:12](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/observation-runtime-trust-root/active-suite-v2.json:12)、[active-suite-v2.json:21](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/observation-runtime-trust-root/active-suite-v2.json:21)。姊妹金牌已有 47–61s 实证并改成 180s：[observation-active-suite-supersession.zero-sut.golden.mjs:14](/mnt/d/ctx/heren/casey/tests/_golden/observation-active-suite-supersession.zero-sut.golden.mjs:14)。

   但它属于不同的“环境耦合”根因和独立 checksum/story：[prd-observation-contract-closure.json:9](/mnt/d/ctx/heren/casey/loop/prd-observation-contract-closure.json:9)、[prd-observation-contract-closure.json:49](/mnt/d/ctx/heren/casey/loop/prd-observation-contract-closure.json:49)，不应扩入本次 Steven 已裁定的“内核收紧未复跑六条”。另立单行 direct 契约可独立收口，也无需等待本 plan 的 B 家族重构。

8. **不成立——反向引用数闭合，但实际修改 scope 未闭合。**

   静态核得 22 个唯一 PRD：

   - flow-bridge 14 个：`caseid-echo-mask`、`drawer-lock-hardening`、`flow-bridge`、`handover-pack`、`ingest`、`integrate-regress-agent-tool-slice`、`regress-agent-tool-first-slice`、`replay-nth-visible-hardening`、六个 `wf-*`；代表锚点见 [prd-caseid-echo-mask.json:31](/mnt/d/ctx/heren/casey/loop/prd-caseid-echo-mask.json:31)、[prd-ingest.json:36](/mnt/d/ctx/heren/casey/loop/prd-ingest.json:36)、[prd-wf-set-node-field.json:24](/mnt/d/ctx/heren/casey/loop/prd-wf-set-node-field.json:24)。
   - ingest 2 个均已包含在上述集合：[prd-handover-pack.json:32](/mnt/d/ctx/heren/casey/loop/prd-handover-pack.json:32)、[prd-ingest.json:25](/mnt/d/ctx/heren/casey/loop/prd-ingest.json:25)。
   - cli-mcp-face 6 个：[prd-casey-doctor.json:35](/mnt/d/ctx/heren/casey/loop/prd-casey-doctor.json:35)、[prd-distribution.json:32](/mnt/d/ctx/heren/casey/loop/prd-distribution.json:32)、[prd-handover-pack.json:33](/mnt/d/ctx/heren/casey/loop/prd-handover-pack.json:33)、[prd-mcp-parity.json:20](/mnt/d/ctx/heren/casey/loop/prd-mcp-parity.json:20)、[prd-report-exit64.json:16](/mnt/d/ctx/heren/casey/loop/prd-report-exit64.json:16)、[prd-resign-drift-closure.json:15](/mnt/d/ctx/heren/casey/loop/prd-resign-drift-closure.json:15)。
   - 再加 record-distill、authority-root、p2-intent-compile：[prd-record-distill.json:28](/mnt/d/ctx/heren/casey/loop/prd-record-distill.json:28)、[prd-teachin-observation-authority-root.json:33](/mnt/d/ctx/heren/casey/loop/prd-teachin-observation-authority-root.json:33)、[prd-p2-intent-compile.json:69](/mnt/d/ctx/heren/casey/loop/prd-p2-intent-compile.json:69)。

   遗漏 scope 有三处：

   - 固定签名 receipt 精确绑定单一 caseId 和三份哈希：[identity-readback-receipt.signed.json:8](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/teachin-observation-safe-case-lease-v2/identity-readback-receipt.signed.json:8)。不能供 B2/B3 任意 case/package 复用。仓内已有可行先例：临时 Ed25519 key + 临时 publication loader + 动态签 receipt，[observation-identity-contract-closure.zero-sut.golden.mjs:51](/mnt/d/ctx/heren/casey/tests/_golden/observation-identity-contract-closure.zero-sut.golden.mjs:51)、[observation-identity-contract-closure.zero-sut.golden.mjs:106](/mnt/d/ctx/heren/casey/tests/_golden/observation-identity-contract-closure.zero-sut.golden.mjs:106)。
   - B3 当前 receipt 是旧无签名形态：[identity-readback-receipt.json:1](/mnt/d/ctx/heren/casey/tests/_golden/fixtures/teachin-observation-authority-root/identity-readback-receipt.json:1)，而现内核要求 keyId/algorithm/signature 等完整信封：[teachin-observation-authority-root.mjs:828](/mnt/d/ctx/heren/casey/lib/teachin-observation-authority-root.mjs:828)。所以“其余断言语义不动”不可实现。
   - B3 PRD 仍以裸 `node` 启动：[prd-teachin-observation-authority-root.json:33](/mnt/d/ctx/heren/casey/loop/prd-teachin-observation-authority-root.json:33)，而 authority root 在测试开头即导入：[teachin-observation-authority-root.zero-sut.golden.mjs:25](/mnt/d/ctx/heren/casey/tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs:25)。必须明确改 acceptance 启动参数、使用 bootstrap worker，或使用可审计的动态 loader 注册方案。

   共享 loader、租约助手和固定 receipt 已另被 checksum 冻结：[prd-observation-runtime-trust-root.json:12](/mnt/d/ctx/heren/casey/loop/prd-observation-runtime-trust-root.json:12)、[prd-teachin-observation-safe-case-lease-v2.json:6](/mnt/d/ctx/heren/casey/loop/prd-teachin-observation-safe-case-lease-v2.json:6)；若保持字节不变无需扩签，若抽新 helper 或修改它们，必须扩充 owner PRD 与人签清单。

## 阻断项与修法

按严重度：

1. **High：B 家族共同 fixture 方案不可闭合。** 改为仓内已有的临时 key/publication loader 动态签名模式；B3 增加明确 bootstrap/loader 启动结构。
2. **High：B2 错称原拒因保留。** 逐 C2d/C2f/C2h 写“保留/迁移/丢失”表，重写精确 exit/reason 与 PRD；生产零改前提下不得伪称仍命中 distill 本地门。
3. **High：A 家族仍有错因假绿，反向突变无效。** 补齐负向夹具绑定、精确断原因；用“放宽内核”的 mutant 证伪。
4. **High：失败路径会污染 canonical `cases/`。** 所有 lease 强制 `try/finally`，cleanup 失败即金牌红，禁止测试体内直接 `process.exit`。
5. **Medium：B1 loader 降级判据不机械。** 增加同包双 server 的 `DRIVER_NOT_PUBLISHED ↔ accepted` 成对证据，并同步改 mcp-parity 语义文本。
6. **Medium：复 gate 只给了数量，未给确定性执行账。** 修订稿列出 22 个 PRD、全部 acceptance/传递 spawn 安全结论、预期翻转；所有改动和重签完成后一次性执行。
7. **Scope：30→180s 另立 direct。**

核验边界：本轮仅静态只读源码、PRD、金牌与门禁实现；**未运行任何 golden、gate、selftest、夹具或 SUT，也未验证传递 spawn 的运行时安全闭包**。工作树未改动。