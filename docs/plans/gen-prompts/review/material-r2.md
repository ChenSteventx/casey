# gen-prompts 修复层评审料（r2，round-1 finding 修复后，异构冗余评审第二轮）

本文件是喂给异构评审者（codex / pi）的 round-2 评审料：只含本轮修复的 `git diff`（`7cabd8f..HEAD`，仅列受影响的 5 个文件）+ 逐条处置表（`dispositions-r1.md` 全文）。不含凭据、不含无关代码、不含实现者内心推理（护栏 #9）。

评审对象：`docs/plans/gen-prompts/review/arb-r1.md`（fable@xhigh 汇裁）采信的 10 条 finding（4 HIGH + 4 MED + 2 LOW），经 sonnet5 修复者逐条红先行修死后的结果（commit `1416147`，父提交 `7cabd8f`）。上一轮（r1）codex + pi 各自独立代码层评审的原始 finding 见 `docs/plans/gen-prompts/review/codex-r1.md`、`docs/plans/gen-prompts/review/pi-r1.md`，汇裁记录见 `docs/plans/gen-prompts/review/arb-r1.md`。

**本轮请重点核实**：
1. r1 的 10 条 finding 是否每条都真的被兑现（不是文案改了但逻辑没改、或改了但留了新缺口）；
2. 逐条处置表里给出的"红先行证据"是否可信（有没有可能是自证式测试，测试本身就配合实现改，而非真复现了原始缺陷）；
3. 本轮修复本身有没有引入新的缺陷（例如：`sanitizeFreezeError` 的类别码正则提取是否可能被特殊构造的候选值绕过而泄露原始信息；`wx` 旗标 + 随机 tmp 名是否有遗留的竞态窗口；`scanEquivalentEncodings` 的候选提取正则是否有性能或假阳性/假阴性问题）；
4. 铁不变量是否仍然成立：裁判零 LLM（`bin/verdict.mjs`、`lib/sign-gate.mjs` 字节不动）、authoring 绝不进回放/裁定闭包、零 API key/零网络/零凭据接线、任何内网/真实目标地址不出现在代码与文档。

## 门禁证据摘录

```
$ node tests/_golden/gen-prompts.golden.mjs
gen-prompts golden: 72 过 / 0 败

$ node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json
ok    ratchet  tests/_golden/gen-prompts.golden.mjs
ok    ratchet  bin/verdict.mjs
ok    ratchet  lib/sign-gate.mjs
ok    term     术语检查通过
ok    s1-gen-prompts-seed-freeze  node tests/_golden/gen-prompts.golden.mjs
ok    s2-tier1-regression  node bin/casey.mjs selftest --tier1

gate: GREEN —— story 2/2 过

$ node bin/casey.mjs selftest --tier1
ok   统一语言注册表完整（term-lint --registry exit 0）
ok   弃用别名被 term-lint 拦红（黑名单方向）
ok   熔断器可清零（breaker --reset exit 0）
ok   质量门禁消费 1-story 契约并翻绿（gate exit 0 + passes 翻 true）
ok   裁判零 LLM：verdict.mjs 闭包无 LLM/网络客户端（verdict-purity-guard exit 0）
selftest --tier1: 全链路 GREEN —— 确定性内核 + 统一语言双向有效。

git diff --stat 7cabd8f..HEAD -- bin/verdict.mjs lib/sign-gate.mjs lib/promptset.mjs tests/_golden/cli-mcp-face.golden.mjs
（空——本轮零改动，裁判进程与既有共冻 prd 无需重签）
```

---

# 逐条处置表（dispositions-r1.md 全文）

# gen-prompts round-1 逐条处置（修复者 sonnet5，2026-07-14）

依据 `docs/plans/gen-prompts/review/arb-r1.md`（fable@xhigh 汇裁）的 10 条采信 finding 逐条处置。10 条全部判定为真问题（无一条在本轮被我证伪——arb-r1.md 里唯一的证伪点，即 pi 的「0 新增会改字节」claim，已由 fable 汇裁阶段自行证伪并采信 codex 的自检旁路方向，见该文件"分歧"一节，不在本文档重复举证）。以下逐条给出修法、改动位置、以及可复核的红先行证据（代码行 + 行为实测）。

## A1（HIGH）金牌含姊妹项目真实内网地址，S3h 自扫描漏扫自身

**修法**：
1. `tests/_golden/gen-prompts.golden.mjs` S3f 的 `10.0.0.0/8` 哨兵地址由真实内网地址（与 `regress_autotest/scripts/gen-prompts.mjs:27` 默认 API 基址逐字节一致）改为合成占位地址 `10.20.30.40`（同落 `10.0.0.0/8` 网段正则，覆盖语义不变）。
2. S3h（第 255 行）改用具名常量 `OLD_REGRESS_FLAG_REMNANTS`（不再含任何真实地址字面量），私网地址检查改用 `scanPrivateAddress` 模式扫描（不依赖特定地址值即可覆盖任意私网地址）。
3. 新增 S3i（第 266 行）：金牌自身源码里，`OLD_REGRESS_FLAG_REMNANTS` 里每个残留字样必须恰好出现 1 次（即只在清单定义处），出现 0 次判"清单缺失"、出现 >1 次判"别处混入"——把自扫描面从"只查两新 bin"补到"金牌自身也查"。
4. 顺带清理：`docs/plans/gen-prompts/review/material-r1.md` 里两处引用该真实地址的评审材料原文（第 1894、1926 行附近）做了脱敏替换（`<REDACTED-真实内网地址>`），因为它是即将随本轮提交进仓库历史的文档，"任何内网/真目标地址不许出现在代码与文档"对文档同样成立。

**证据**：
- 全仓 sweep（脱敏方式核对，不在本文档写出该地址字面量本身——写出即视为把它重新带回仓库）：修复前 `tests/_golden/gen-prompts.golden.mjs:212` 与 `:244` 两处含一个私网地址字面量，与 `regress_autotest/scripts/gen-prompts.mjs:27` 的默认 API 基址逐字节一致（已用文件+行号核对，不复述具体数值）；修复后对该字面量的全仓字符串检索（排除 `node_modules`）0 处命中，包括本篇处置文档与 round-2 评审材料自身。
- S3i 红先行：新常量刚加入、检查逻辑写成"计数"式之前，先在会话里对旧版金牌文本手工计数确认 `--base` 等字样只应出现 1 次而不查金牌自身是假绿的路径；写成 S3i 后跑一次金牌，因检查描述字符串本身含 `--base` 使计数变 2，判红（真实抓到"自身包含旗标字样超过 1 次"这一类问题，即便触发原因是描述文案而非真实残留），随即把 S3h 描述文案里的具体旗标名去掉、S3i 转绿——证明该检查确有分辨力，不是摆设。

## A2（HIGH）错误路径回显原始字段值，违 D3 output-seal

**修法**：`bin/promptset-freeze.mjs` 新增 `VALIDATION_ERROR_HINT`（第 96 行起）与 `sanitizeFreezeError(e)`（第 110 行起）——校验/合并失败只输出固定类别说明 + 位置下标，不再把 `CandidateValidationError.message`（或 `freezeMergePromptset` 里两处普通 `Error` 的 message）原样透传。两处调用点：
- 第 127 行 `catch (e) { die(65, sanitizeFreezeError(e)); }`（原为 `die(65, e.message)`）；
- 第 147 行 green-by-construction 自检的 `catch` 块改为固定文案，不再插值 `e.message`（原为 `` die(65, `...：${e.message}`) ``）。

**证据（红先行）**：
- 修复前手工验证（`bin/promptset-freeze.mjs --candidates` 传一条含未登记键 `ZZQQSENTINELKEY` 的候选）：stderr 完整回显 `ZZQQSENTINELKEY: 'leak-me-if-buggy'`，见会话记录。
- 修复后同一输入：`promptset-freeze: 候选校验失败[UNKNOWN_KEY]（第 0 条）：候选含未登记键（闭合白名单 id/text/category/expect，不得自带 source）（原始键名/字段取值不回显）`——`ZZQQSENTINELKEY` 不再出现。
- 金牌钉：`tests/_golden/gen-prompts.golden.mjs` 第 556 行 F3o（使用独立哨兵键名 `ZZQQ_UNREGISTERED_SENTINEL_KEY_9f31`，断言 stderr 不含该键名）；F2d（第 450 行）与 F4j 也各自断言自检/凭据门失败路径不回显哨兵值。经 `git stash` 把 `bin/promptset-freeze.mjs` 还原到修复前版本重跑金牌：F3o 判红（`报错不得回显未登记键名原文`），修复后转绿。

## A3 / A8（HIGH / MED，同根）固定 `.tmp` sidecar 符号链接可覆写受害文件；并发共用同一 tmp 名

**修法**：`lib/promptset-authoring.mjs` 的 `atomicWriteFileSync`（第 254-268 行）：
1. tmp 名从固定 `${path}.tmp` 改为 `` `${path}.${randomBytes(9).toString('hex')}.tmp` ``（第 257 行，72 位随机熵）——每次调用互不相同，结构上消除"两进程/两次调用共用同一 tmp 名互相覆写"（A8 的主要子问题）。
2. 默认 `writeFn` 加 `{ flag: 'wx' }`（第 254 行，`O_CREAT|O_EXCL|O_WRONLY`）——POSIX 语义下，目标路径若已是符号链接（不论悬空与否），`open()` 必以 `EEXIST` 失败、绝不跟随，作为第二道防线。
3. `mkdirSync` 便利建目录在写失败时留下的空目录残留，维持原设计取舍（代码注释里原本已声明"不是原子性契约的一部分，纯为便利"）——本轮不做事务化建目录回滚，判定为可接受的既有取舍，非本轮新增问题，见下方"未完全解决的边角"说明。

**证据（黑盒红先行，零测试侧 mock）**：
用 `git stash` 把 `lib/promptset-authoring.mjs` 还原到修复前版本，构造：受害文件 `victim.txt`（内容 `VICTIM-ORIGINAL-BYTES`）、目标文件 `target.txt`（内容 `TARGET-ORIGINAL-BYTES`），预先在固定路径 `target.txt.tmp` 落一个指向 `victim.txt` 的符号链接，然后**不注入任何 fs 替身**、直接调用 `atomicWriteFileSync(target, 'ATTACKER-PAYLOAD-NO-INJECTION')`：
- 修复前：不抛异常，`victim.txt` 内容被覆写成 `ATTACKER-PAYLOAD-NO-INJECTION`（`victim UNCHANGED: false`），`target.txt` 也变成同样内容——真实的符号链接跟随写入漏洞，非假设。
- 修复后（同一黑盒脚本，`git stash pop` 恢复修复后重跑）：预置的 legacy 符号链接因 tmp 名已随机化而完全不被触及，`victim.txt` 内容原样保留（`VICTIM-ORIGINAL-BYTES`），`target.txt` 正常拿到本次真实写入内容——攻击面已消除。
另补一组"即便攻击者已知/预测到确切 tmp 路径"的注入式验证（`writeFn` 里手工复现同款 `wx` 旗标语义直接写向预置符号链接）：`open EEXIST` 抛出，受害文件不变——证明 `wx` 旗标这道防线本身在直接命中场景下也生效，不只是靠随机名侥幸躲开。
金牌钉：`tests/_golden/gen-prompts.golden.mjs` 第 677 行 F4h（两次调用 tmp 名不同）、第 688 行 F4i（黑盒符号链接场景）；F4e/F4f（第 652/663 行附近）改用"扫整个目录零残留文件"取代原先假设固定 `.tmp` 后缀的写法（tmp 名已随机化，原写法会变成永远为真的空判断，因此一并修正，避免测试退化成摆设）。

**未完全解决的边角（明确记账，非挂账不修）**：`mkdirSync(dirname(path), {recursive:true})` 新建父目录后、若后续 `writeFn`/`renameFn` 失败，会留下一个空目录（不含任何文件，只是目录本身）。这不是数据完整性问题（没有半成品文件、没有被覆写的受害数据），代码里原有的设计注释已明确声明这不属于原子性承诺范围。本轮判定：与 A3 的"共用 tmp 名互相覆写"（已修复）相比，这是严重度低得多的残留美观问题，不做事务化目录创建（成本/收益不对称），维持现状。

## A4（HIGH）0 新增提前 exit 0 旁路 green-by-construction 自检

**修法**：`bin/promptset-freeze.mjs` 把 green-by-construction 自检（`parsePromptset`+`mergeCases`，第 143-147 行）挪到 `fresh.length === 0` 的提前退出（第 149 行）**之前**，使自检无论是否有新增都跑。

**证据（红先行，`git stash` 前后对照）**：
构造：存量含 3 条——`p01_existing_user`（合法）、`p10_normal_llm`（`source:'llm'`，与某候选逐字段等价，制造真 0 新增）、`p91_bad_source`（`source:'not_a_real_source'`，非法值，候选完全不触及）。候选只含 1 条与 `p10_normal_llm` 等价的项（触发幂等跳过，真 0 新增）。
- 修复前：`node bin/promptset-freeze.mjs --candidates ... --promptset ...` → `promptset-freeze: 0 新增（已幂等跳过 1 条），未写盘。` exit 0——坏数据被静默放行，文件字节确认未变（0 新增分支本就不写盘，与 pi 的"改字节"claim 无关，印证 arb-r1.md 的证伪结论）。
- 修复后：同一输入 → `promptset-freeze: green-by-construction 自检未过（fail-closed 拒写；详情不回显，可能含存量原始字段取值）` exit 65，`not_a_real_source` 不出现在输出里（同时验证 A2 的不回显）。
金牌钉：`tests/_golden/gen-prompts.golden.mjs` 第 450 行 F2d，复现上述场景并断言 exit 65 + 文件字节不变 + 不回显。

## A5（MED，both：codex + pi 独立收敛）term-lint parseRegistry 裸 `split('|')` 幽灵别名

**修法**：`CONTEXT.md` 第 109 行 `promptset` 词条的 `source` 枚举分隔符由反斜杠转义管道 `\|` 改为全角竖线 `｜`（与本仓其他"三选一"枚举描述的既有写法一致，例如 `lib/promptset-authoring.mjs` 里 `` `normal`（常规）｜`boundary`（边界）｜`security`（安全） `` 的写法）。根因在复用件 `loop-kit`（独立包，`/mnt/d/ctx/heren/loop-kit`，`kit-lock.json` sha256 签定）的 `parseRegistry` 用裸 `line.split('|')` 解析四列制表格、不认 Markdown 转义——这是保护面之外的上游解析器缺陷，本契约不改该包（超出契约边界，且改包需走独立的 kit-lock 重签流程），只确保己方新增词条的书写不再触发它。

**证据**：
- 修复前：`parseRegistry(CONTEXT.md).deny` 含 `{"alias":"\`builtin\`（随 注入向量库 发）\\","canonical":"promptset"}`（幽灵项，第一个 `\|` 把 gloss 列错裂，真实 aliases 列"—"从未被读到）；`node loop-kit/bin/term-lint.mjs --registry` 仍 exit 0（`registryErrors` 是另一个数组，不含此类裂列问题，故检测不到）。
- 修复后：`parseRegistry().deny` 里 `canonical === 'promptset'` 的项数为 0（原 16 项变 15 项），`--registry` 仍 exit 0（无退化）。
- 追加验证：该行原本在 CONTEXT.md 里也是历史遗留写法（改前 `git show 7cabd8f` 的旧版本就已是 `` `user\|builtin` ``，本契约把它从两选项扩到三选项时沿用了同一有缺陷的转义写法，而非本轮新造的缺陷模式，只是本轮暴露/放大了它——一并修正）。
金牌钉：`tests/_golden/gen-prompts.golden.mjs` 第 784-801 行 T1a/T1b/T1c。

## A6（MED）私网地址扫描漏 URL 可归一的等价写法

**修法**：`lib/promptset-authoring.mjs` 新增 `scanEquivalentEncodings`（第 313 行起）——用 Node 内置 `URL`（无第三方依赖）把"像数字型主机"的候选片段（十六进制前缀、点分数字串、长十进制串、百分号编码点号）丢给标准主机解析器归一，再核对既有网段正则；`scanPrivateAddress`（第 292 行）在既有字面量正则之外追加调用它。另加一条直接正则覆盖 IPv6 展开/前导零回环形态（第 294 行，裸文本不便走 URL 解析）。

**证据**：直接对 `scanPrivateAddress` 跑 5 个等价写法（IPv6 展开回环 `0:0:0:0:0:0:0:1`、八进制 `0177.0.0.1`、十进制整数 `2130706433`、十六进制 `0x7f000001`、百分号编码 `127%2e0%2e0%2e1`），修复前全部 `hit:false`，修复后全部 `hit:true`（归一后落在 `127.0.0.0/8`）。同时验证一批干净中文文本（含普通数字、版本号）不误报，收窄假阳性面。金牌钉：第 604 行 F4c1（单元级 5 形态）+ 第 623 行 F4c2（经真实 `promptset-freeze` CLI 端到端验证十进制整数形态）。仍非穷举（内部域名与更冷门写法维持既有"静态证不出，route:human 抽检兜底"口径，代码注释已更新说明）。

## A7（MED）N1 spawn 边金牌只扫三入口，helper 转发可绕

**修法**：`tests/_golden/gen-prompts.golden.mjs` 第 820 行 N1b 从"只读三入口文件自身源文本"改为"用 `scanClosure` 展开完整 import 闭包、逐文件（去注释后）扫描"。去注释是必要的：`lib/promptset.mjs` 头部注释里本就合法地提到 `lib/promptset-authoring.mjs`（纯文档交叉引用，非 spawn 边），若不去注释会产生假阳性——已在真实闭包上验证过（详见下方证据）。

**证据（合成对照，未改动仓内文件）**：在临时目录构造一个 `entry.mjs` 经 `import` 引一个 `helper.mjs`、`helper.mjs` 内含字符串 `'promptset-freeze'`：旧写法（只读 entry 自身文本）判"未命中"（漏报，与 finding 描述的"helper 转发可绕"一致）；新写法（`scanClosure` 展开 + 去注释扫描）判"命中"。当前 `bin/replay.mjs`/`bin/verdict.mjs`/`bin/promptset.mjs` 的真实闭包里没有任何文件引用两个新 authoring bin（`node tests/_golden/gen-prompts.golden.mjs` 全绿可证），故这是加固覆盖面、不是修一个已存在的活缺陷，与 arb-r1.md 的定性一致。

## A9（LOW）`--dry-run` 打整条候选正文而非摘要

**修法**：`bin/promptset-freeze.mjs` 第 154-158 行，`--dry-run` 输出从 `console.log(JSON.stringify(fresh, null, 2))`（打印整条 `text`/`expect` 正文）改为逐条打印 `- <id>（category=<category>，含 expect 软期望）` 摘要行。

**证据**：构造候选 `text` 为独一无二的哨兵字符串 `DRYRUN_FULLTEXT_SHOULD_NOT_BE_ECHOED_ZZQQ`，`expect.note` 为另一哨兵 `DRYRUN_EXPECT_NOTE_SHOULD_NOT_BE_ECHOED_WWEE`：修复前两个哨兵均完整出现在 `--dry-run` 输出里；修复后仅出现 `id`/`category` 摘要，两个哨兵均不出现。金牌钉：第 436 行 F2c2。`git stash` 还原验证：F2c2 判红（`--dry-run 不应回显候选 text 正文`），修复后转绿。

## A10（LOW，pi 独有）金牌缺"存量含凭据/私网地址 → freeze 拒"负面钉

**修法**：无需改动实现——机制本就存在（`bin/promptset-freeze.mjs` 对 `--promptset` 已有文件的原文同样先过 `gateRawTextOrExit`，第 84 行），只是此前金牌未覆盖该场景。新增金牌钉：第 701 行 F4j，分别构造存量文件原文含凭据字样、含私网地址两种场景，断言 exit 1、零写盘、哨兵值不回显。

**证据**：`git stash` 把 `bin/promptset-freeze.mjs` 还原到本轮修复前（该机制在本轮之前就已存在，非本轮引入），F4j 依然通过——印证这是纯粹的测试覆盖缺口，机制本身此前已经是对的，不是本轮引入或本轮才修复的行为变更。

## 汇总核验

- 全部改动跑 `node tests/_golden/gen-prompts.golden.mjs`：72 过 / 0 败。
- `node loop-kit/bin/gate.mjs --prd loop/prd-gen-prompts.json`：ratchet（三份冻结文件 sha256）+ term-lint + 两条 story 全绿，`tests/_golden/gen-prompts.golden.mjs` 的 testChecksums 已重签为修复后文件的新 sha256（`53689ce80e4cdc301b8f91463ea8769cfc4f7439acf7e3a9b4bd739b6643afe8`）。
- `bin/verdict.mjs`、`lib/sign-gate.mjs`、`lib/promptset.mjs`、`tests/_golden/cli-mcp-face.golden.mjs` 本轮零改动（`git diff --stat` 可核）——裁判进程字节不动、`prd-cli-mcp-face`/`prd-mcp-parity` 两份 prd 无需重签。
- 全程未使用真实内网/真实目标地址；`.auth/`、`site.json` 未被读取或引用。

---

# 本轮修复 diff（`git diff 7cabd8f..HEAD`，仅列受影响文件）

```diff
diff --git a/CONTEXT.md b/CONTEXT.md
index 9aa1a6a..306ed57 100644
--- a/CONTEXT.md
+++ b/CONTEXT.md
@@ -106,7 +106,7 @@
 | `trace` | 回放追踪档 | Playwright 逐帧追踪归档（.zip）；报告里不内嵌、复制到 `trace/` 加下载链接与 show-trace 提示。**未建挂账**（2026-07-07 审计核实：全链无 tracing 调用、报告 traceRef 恒 null；设计文档「已知偏离」表有账） | — |
 | `channel` | 通道 | 回放目标类型：`web`（Heren 中台）/`cef`（Hi小助）/`arbitrary`（任意站点）；裁定/报告/熔断/契约层 channel 无关 | — |
 | `chat` | 对话流 | 飞轮排期第二维度：覆盖 catalog 维度碰不到的流式回复取证（`streamReplyReceived`、`waitForReplyByStream` 底座）与 `replyContains`；骑 regress `chiefcomplaint_smoke` 语料（`echo_default_on` 经 2026-07-03 摸底实证属画布维度错档：测节点抽屉开关、带坐标拖拽，不走对话流） | — |
-| `promptset` | 提示词集 | 数据驱动回归的被测参数输入层：一份 JSON 数组 `[{id,text,source,category,expect?}]`，把一条冻结 `chat` flow 复用成 N 条独立用例（每行一 caseId/录屏/裁定），聚合成一份报告；血缘 xUnit 数据驱动测试（data-driven testing）。忠实对标 regress `_promptset.ts`（字段名 `text`）。`source` 枚举 `user`（人写）\|`builtin`（随 注入向量库 发）\|`llm`（`gen-prompts` 契约扩容：CLI 外 LLM 合成，经 `promptset-freeze` 强制标注） | — |
+| `promptset` | 提示词集 | 数据驱动回归的被测参数输入层：一份 JSON 数组 `[{id,text,source,category,expect?}]`，把一条冻结 `chat` flow 复用成 N 条独立用例（每行一 caseId/录屏/裁定），聚合成一份报告；血缘 xUnit 数据驱动测试（data-driven testing）。忠实对标 regress `_promptset.ts`（字段名 `text`）。`source` 枚举 `user`（人写）｜`builtin`（随 注入向量库 发）｜`llm`（`gen-prompts` 契约扩容：CLI 外 LLM 合成，经 `promptset-freeze` 强制标注） | — |
 | 被测参数 | Prompt Parameter | `promptset` 每行的 `text`——真正打进 SUT 对话框、喂给 `chat.sendAndWait` 的 `prompt` 槽的消息文本；数据驱动多行参数化的「参数」。**消歧**：本项「参数化」专指此，显式区别于 `caseId` 并发参数化（`worktree-baton` 已解）与 `entityNameParam` 前缀参数化（R12/`compile-gate` 已落） | — |
 | 注入向量库 | Injection Vector Library | 随工具发、用户可编辑扩展的通用边界/安全被测参数库（`prompts/_lib/boundary.json` + `security.json`）；category 由文件名强制、`source` 强制 `builtin`、id 前缀 `bnd_`/`sec_` 防撞，`被测参数 overlay` 按开关并入每个数据驱动用例集；血缘安全测试注入向量 + 模糊测试语料。**消歧**：本项「内置提示词」专指此，显式区别于 Casey 自身归一/编译工装提示词（委托 CLI 外 LLM、仓内无实体，见 `归一提示模板`） | — |
 | 软期望 | Soft Expectation | `promptset` 行的 `expect{mustInclude?,mustNotInclude?,note?}`——只在报告里标命中与否的 soft 断言，绝不进多态裁定树、绝不判红（护栏 #17）；非确定性 LLM 输出不做 exact 硬断言。落地 = 强制 `soft:true` 的 `replyContains`/`replyMatches`，经 `--soft-expect` 通道并入现成 soft 链路进报告黄标（不碰 `sign-gate`、不进裁判） | — |
diff --git a/bin/promptset-freeze.mjs b/bin/promptset-freeze.mjs
index 5938f14..a5f7902 100644
--- a/bin/promptset-freeze.mjs
+++ b/bin/promptset-freeze.mjs
@@ -90,9 +90,41 @@ if (candidates.length === 0) die(65, '候选文件须为非空数组');
 const existing = existingRaw === null ? [] : safeJsonParse(existingRaw, '已有 promptset 文件');
 if (!Array.isArray(existing)) die(65, '已有 promptset.json 非数组，拒绝合并（保护人写存量）');
 
+// 候选校验错误 → 只出类别码 + 位置下标 + 固定中文说明，绝不透传 e.message 原文节选（D3 output-seal）：
+// CandidateValidationError.message 内嵌未登记键名/非法字段取值等候选自带内容，即便"干净"（未命中凭据兜底门
+// 关键词）也不该回显——防 LLM 候选借意外字段名/取值本身把内容送进 stderr，绕过只扫值的凭据门（round-1 HIGH A2）。
+const VALIDATION_ERROR_HINT = {
+  SHAPE: '候选须为对象',
+  UNKNOWN_KEY: '候选含未登记键（闭合白名单 id/text/category/expect，不得自带 source）',
+  ID_SHAPE: 'id 非法（须匹配 ^[a-z0-9_]+$）',
+  ID_RESERVED_PREFIX: 'id 撞注入向量库保留前缀（bnd_/sec_）',
+  TEXT_EMPTY: 'text 须为非空字符串',
+  CATEGORY_MISSING: 'category 必填（须 normal|boundary|security）',
+  CATEGORY_ENUM: 'category 非法（须 normal|boundary|security）',
+  EXPECT_SHAPE: 'expect 须为对象',
+  EXPECT_UNKNOWN_KEY: 'expect 含未登记键',
+  EXPECT_FIELD_SHAPE: 'expect 子字段形状非法',
+  BATCH_DUP_ID: '批内 id 重复',
+  ID_CONFLICT: '候选与已有条目冲突（id 已存在但内容或来源不同）',
+};
+function sanitizeFreezeError(e) {
+  // 结构化 code（CandidateValidationError）优先；freezeMergePromptset 里两处普通 Error（BATCH_DUP_ID/
+  // ID_CONFLICT）没有 .code 属性，退化用正则从 message 头部提取方括号类别码——码本身是硬编码字面量、
+  // 永不受候选取值影响（e.g. `候选校验失败[BATCH_DUP_ID]（第 i 条）：...`，方括号内容恒为开发者写死的
+  // 枚举值，不是候选自带数据），故此提取不构成原值回显。
+  const explicitCode = e && typeof e.code === 'string' ? e.code : null;
+  const parsedCode = !explicitCode && e && typeof e.message === 'string' ? (/\[([A-Z_]+)\]/.exec(e.message) || [])[1] : null;
+  const code = explicitCode || parsedCode;
+  if (code && VALIDATION_ERROR_HINT[code]) {
+    const at = Number.isInteger(e && e.index) ? `（第 ${e.index} 条）` : '';
+    return `候选校验失败[${code}]${at}：${VALIDATION_ERROR_HINT[code]}（原始键名/字段取值不回显）`;
+  }
+  return '候选校验或合并失败（fail-closed 拒写；详情不回显，防原始字段取值经报错泄露）';
+}
+
 let merged, fresh, skippedExisting;
 try { ({ merged, fresh, skippedExisting } = freezeMergePromptset({ existing, candidates })); }
-catch (e) { die(65, e.message); }
+catch (e) { die(65, sanitizeFreezeError(e)); }
 
 // 新增候选条目文本零裸 ://（存量条目不追溯，GRILL D3 修订）——覆盖 text 与 expect 全部子字段（mustInclude/
 // mustNotInclude/note），不止 text（漏 note 会放行 expect.note 夹带的裸 :// ）。
@@ -103,21 +135,27 @@ for (const c of fresh) {
   }
 }
 
-if (fresh.length === 0) {
-  console.log(`promptset-freeze: 0 新增（已幂等跳过 ${skippedExisting.length} 条），未写盘。`);
-  process.exit(0);
-}
-
-// green-by-construction 自检（写盘前对合并结果自跑 parsePromptset + 与随发注入向量库 mergeCases 无撞）。
+// green-by-construction 自检（写盘前对合并结果自跑 parsePromptset + 与随发注入向量库 mergeCases 无撞）——
+// 无论 fresh 是否为空都跑（round-1 HIGH A4 修订：此前 0 新增分支在本自检之前就 exit 0，坏存量——如非法
+// source 值或撞注入向量库保留前缀的既有条目——在幂等 no-op 重跑时被静默判成功，绕过了本应 fail-closed 的
+// 自检）。报错只出固定类别说明，绝不透传 e.message 原文节选（D3 output-seal，round-1 HIGH A2：parsePromptset/
+// mergeCases 的报错会内嵌存量原始字段取值，即便这是自检失败的边缘路径也不例外）。
 try {
   const cases = parsePromptset(merged);
   const libs = loadBuiltinLibs(join(PROJECT_ROOT, 'prompts', '_lib'));
   mergeCases(cases, libs);
-} catch (e) { die(65, `green-by-construction 自检未过（fail-closed 拒写）：${e.message}`); }
+} catch { die(65, 'green-by-construction 自检未过（fail-closed 拒写；详情不回显，可能含存量原始字段取值）'); }
+
+if (fresh.length === 0) {
+  console.log(`promptset-freeze: 0 新增（已幂等跳过 ${skippedExisting.length} 条），未写盘。`);
+  process.exit(0);
+}
 
 if (dryRun) {
   console.log(`promptset-freeze: --dry-run，新增 ${fresh.length} 条（未写盘）：`);
-  console.log(JSON.stringify(fresh, null, 2));
+  for (const c of fresh) {
+    console.log(`  - ${c.id}（category=${c.category}${c.expect ? '，含 expect 软期望' : ''}）`);
+  }
   process.exit(0);
 }
 
diff --git a/lib/promptset-authoring.mjs b/lib/promptset-authoring.mjs
index 2326635..dedbeab 100644
--- a/lib/promptset-authoring.mjs
+++ b/lib/promptset-authoring.mjs
@@ -13,6 +13,7 @@
 // 只吃已读入的字符串/对象，同输入产同字节；atomicWriteFileSync 是唯一真正碰盘的导出，且可整体替身测试。
 import { writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
 import { dirname, relative, isAbsolute, sep } from 'node:path';
+import { randomBytes } from 'node:crypto';
 
 const ID_RE = /^[a-z0-9_]+$/;
 const CATEGORIES = ['normal', 'boundary', 'security']; // 独立于 lib/promptset.mjs 的 CATEGORIES（GRILL D7 要求本文件独立、零 import 该模块）
@@ -237,14 +238,23 @@ export function freezeMergePromptset({ existing, candidates } = {}) {
 
 // ---------------- 原子写（可注入故障，唯一真正碰盘的导出） ----------------
 
-// tmp + rename 原子写：先写 <path>.tmp 再原子 rename 到 path，任一步失败清理 tmp、不留半份、抛错上抛。
+// tmp + rename 原子写：先写 <path>.<随机>.tmp 再原子 rename 到 path，任一步失败清理 tmp、不留半份、抛错上抛。
 // writeFn/renameFn 可注入（金牌用来模拟磁盘写失败/改名失败），默认走真实 fs。父目录自动创建（mkdir 不注入、
 // 不是"原子性"契约的一部分，纯为便利）。
+//
+// tmp 名双重防线（round-1 HIGH A3/A8：固定 `${path}.tmp` 可被预置符号链接抢注，默认 writeFn 的 writeFileSync
+// 会跟随符号链接截断/改写其指向的受害文件，rename 再把符号链接本身搬到 path，两步合力可覆写任意受害文件）：
+//   1) 每次调用生成随机唯一 tmp 名（crypto.randomBytes，72 位熵）——攻击者预先猜中/落地符号链接的窗口消失，
+//      顺带堵住 A8「两进程共用同一固定 .tmp 互相覆写」（各调用各用各的 tmp 名，无共享覆写面）；
+//   2) 默认 writeFn 用 { flag: 'wx' }（O_CREAT|O_EXCL|O_WRONLY）——POSIX 语义：目标路径若已是符号链接
+//      （无论悬空与否），open() 必定以 EEXIST 失败、绝不跟随；即便随机名意外撞上残留文件/符号链接也 fail-closed。
+//   写失败/rename 失败后残留的（至多）新建空父目录不在原子性承诺范围内（同一贯设计取舍，纯为便利的 mkdir
+//   不做事务回滚）。
 export function atomicWriteFileSync(path, text, { writeFn, renameFn } = {}) {
-  const doWrite = writeFn || ((p, t) => writeFileSync(p, t, 'utf8'));
+  const doWrite = writeFn || ((p, t) => writeFileSync(p, t, { encoding: 'utf8', flag: 'wx' }));
   const doRename = renameFn || ((from, to) => renameSync(from, to));
   mkdirSync(dirname(path), { recursive: true });
-  const tmpPath = `${path}.tmp`;
+  const tmpPath = `${path}.${randomBytes(9).toString('hex')}.tmp`;
   try {
     doWrite(tmpPath, text);
   } catch (e) {
@@ -278,10 +288,39 @@ const PRIVATE_ADDR_PATTERNS = [
   // 只锚定 fc/fd 前缀 + 2 位十六进制 + 冒号（镜像 fe80::/10 同款宽松写法，Codex L2 咨询 2026-07 指出原正则漏检）。
   { kind: 'fc00::/7', re: /\bf[cd][0-9a-fA-F]{2}:/i },
   { kind: 'fe80::/10', re: /\bfe[89ab][0-9a-fA-F]:/i },
+  // IPv6 回环的展开/前导零形态（round-1 MED A6）：如 0:0:0:0:0:0:0:1、0000:0000:0000:0000:0000:0000:0000:0001。
+  // 裸（不带方括号）出现在文本里时不走 URL 主机解析（无格式化端口分隔符会误判），直接正则锚定 8 组、
+  // 前 7 组全零、末组零值前导 + 1。
+  { kind: 'IPv6 本机回环地址（展开/前导零形态）', re: /\b(?:0{1,4}:){7}0{0,3}1\b/ },
 ];
 export function scanPrivateAddress(text) {
   const s = String(text);
   for (const { kind, re } of PRIVATE_ADDR_PATTERNS) if (re.test(s)) return { hit: true, kind };
+  const equiv = scanEquivalentEncodings(s);
+  if (equiv.hit) return equiv;
+  return { hit: false };
+}
+
+// 数字型主机等价编码扫描（round-1 MED A6）：既有正则只认标准点分十进制字面量，漏检 WHATWG URL 主机解析器
+// 会认得的等价写法——十进制 32 位整数（2130706433）、八进制前导零每段（0177.0.0.1）、十六进制（0x7f000001）、
+// 百分号编码点号（127%2e0%2e0%2e1）。用 Node 内置 URL（无第三方依赖，S4 零第三方裸说明符不破）把「像数字型
+// 主机」的片段丢给标准解析器归一，再用既有网段正则核对归一结果——不是重新枚举网段，是复用上面那份权威清单。
+// 候选提取刻意收窄（只挑十六进制前缀/点分数字串/长十进制串/百分号编码点号片段），避免把任意散落数字都喂进
+// 解析器造成误判；仍非穷举——更冷门的等价写法与内部域名形态静态证不出，route:human 抽检兜底（同既有说明）。
+function tryUrlNormalizeHost(token) {
+  try { return new URL(`http://${token}/`).hostname; } catch { return null; }
+}
+function scanEquivalentEncodings(text) {
+  const candidates = new Set();
+  for (const m of text.matchAll(/\b0x[0-9a-fA-F]+\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(/\b\d{1,8}(?:\.\d{1,8}){1,3}\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(/\b\d{8,10}\b/g)) candidates.add(m[0]);
+  for (const m of text.matchAll(/(?:\d{1,3}%2[eE]){1,3}\d{1,3}/g)) candidates.add(m[0]);
+  for (const tok of candidates) {
+    const hostname = tryUrlNormalizeHost(tok);
+    if (!hostname) continue;
+    for (const { kind, re } of PRIVATE_ADDR_PATTERNS) if (re.test(hostname)) return { hit: true, kind };
+  }
   return { hit: false };
 }
 
diff --git a/loop/prd-gen-prompts.json b/loop/prd-gen-prompts.json
index 8c5ed4b..720f868 100644
--- a/loop/prd-gen-prompts.json
+++ b/loop/prd-gen-prompts.json
@@ -3,7 +3,7 @@
   "task": "gen-prompts（full）：被测参数的 CLI 外 LLM 合成 authoring——regress scope C 改形态（Steven 2026-07-13 定案：合成在 coding agent 会话里做，casey CLI 只出两段零 LLM 确定性工作）。① 新建 lib/promptset-authoring.mjs（buildSeedTemplate 出字节稳定合成种子模板：embedded 先 CRLF→LF 规范化、全文过凭据/地址扫描在截断之前、按 Unicode 码点截断 4000 并标「已截断」；freezeMergePromptset 先整批完整校验（闭合白名单 id/text/category/expect、禁 bnd_/sec_ 前缀、批内去重、不许自带 source）再分类幂等/冲突（已有 id 深等跳过、不同内容整批拒）、新条强制 source:llm；atomicWriteFileSync 可注入 write/rename 故障验真原子）。② 新建 bin/promptset-seed.mjs：路径闸（--out 强制 .md、拒覆盖已存在、canonical 化后拒写保护面）+ 双侧凭据门 + 私网地址负向扫描（10/8,172.16/12,192.168/16,127/8,169.254/16,::1,fc00::/7,fe80::/10）+ 零内网地址/--base/--key/--model 字样。③ 新建 bin/promptset-freeze.mjs：路径闸（--promptset 强制 .json）+ 解析前原文扫描（防 JSON.parse 报错携原文走 stderr 旁路）+ 幂等冻结追加 + green-by-construction 自检（parsePromptset+mergeCases）+ 输出侧双门 + 原子写。④ lib/promptset.mjs SOURCES 扩 'llm' + 头注释与报错文案同步（三处口径，报错文案从 SOURCES 派生）。⑤ bin/casey.mjs 两 case + help 两行（标注合成在 CLI 外）。⑥ 涟漪：regress-promptset.golden.mjs 第 61 行 source:llm 负向钉改正向 + 补 robot 未知 source 负向钉（重签 prd-regress-promptset）；cli-mcp-face.golden.mjs 的 CLI_MCP_EXCLUDED 追加两命令 + A4 新增反向断言 CLI_MCP_EXCLUDED ⊆ switch 派生集（双 prd 共冻，prd-cli-mcp-face + prd-mcp-parity 一并重签）；CONTEXT.md 登记合成种子模板/被测参数候选/幂等冻结三词条 + promptset 词条 source 枚举更新；docs/design/txt2testreport-design.md §13 头注改口 + §13.2 注释同步 + 新增 §13.7。铁不变量：authoring 绝不进回放/裁定闭包（N1 静态核 + spawn 边源文本扫描）、verdict.mjs 与 sign-gate.mjs 字节不动（本表同冻两者当前 sha256 基线，把「裁判字节不动」从行为守卫补成机器可验字节锚）、零 API key/零网络/零凭据接线、落盘产物照旧过凭据兜底门。决策见 docs/plans/gen-prompts/proposed/GRILL.md（D1-D9，含 codex-sol@max 设计评审修订）+ plan.md。",
   "specPath": "docs/plans/gen-prompts/plan.md",
   "testChecksums": {
-    "tests/_golden/gen-prompts.golden.mjs": "df3027ed18db517a77d2d08b5a4b635b924b350a1254cbbdb6c9c4f114a82f1c",
+    "tests/_golden/gen-prompts.golden.mjs": "53689ce80e4cdc301b8f91463ea8769cfc4f7439acf7e3a9b4bd739b6643afe8",
     "bin/verdict.mjs": "ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53",
     "lib/sign-gate.mjs": "a1018927b0465de0df98523aba1e2b15499ecc682477f7cbf3768cc9ddd7f919"
   },
@@ -30,7 +30,7 @@
         "node tests/_golden/gen-prompts.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:28:55.117Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T00:21:41.111Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-tier1-regression",
@@ -40,7 +40,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-13T22:28:58.014Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T00:21:44.049Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/tests/_golden/gen-prompts.golden.mjs b/tests/_golden/gen-prompts.golden.mjs
index eb91a3f..80ee4fd 100644
--- a/tests/_golden/gen-prompts.golden.mjs
+++ b/tests/_golden/gen-prompts.golden.mjs
@@ -12,7 +12,13 @@
 //
 // 分组：S1 确定性 | S2 内容契约 | S3 门与负向 | S4 零 LLM/零网络闭包 | S5 seed 路径闸 |
 //       F1 冻结 happy | F2 幂等与冲突 | F3 准入闸 | F4 凭据/地址门与原子性 | F5 freeze 路径闸 |
-//       P1 source 枚举扩展 | N1 不进回放/裁定闭包 | C1 CLI 门面全覆盖
+//       P1 source 枚举扩展 | T1 CONTEXT 词条对 term-lint 解析器无退化 | N1 不进回放/裁定闭包 | C1 CLI 门面全覆盖
+//
+// round-1 异构冗余评审（codex+pi，fable@xhigh 汇裁，docs/plans/gen-prompts/review/arb-r1.md）修订钉：
+//   A1（金牌自身含姊妹项目真实内网地址）S3f 改合成占位地址 + S3h/S3i 扩自扫描面；A2（错误回显原字段值）
+//   F3o/F4k 不回显钉；A3/A8（固定 .tmp 符号链接可覆写）F4h/F4i；A4（0 新增绕自检）F2d；A5（term-lint
+//   parseRegistry 幽灵别名，both）T1；A6（地址等价编码漏检）F4c 已扩五形态；A7（N1 spawn 扫描面窄）N1b 改
+//   闭包扫描；A9（--dry-run 打全文）F2c 摘要钉；A10（存量藏凭据/地址未钉）F4j。
 import {
   readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, symlinkSync, readdirSync, rmSync,
 } from 'node:fs';
@@ -24,6 +30,8 @@ import { createHash } from 'node:crypto';
 import { parsePromptset, loadBuiltinLibs, mergeCases } from '../../lib/promptset.mjs';
 import { credentialGate } from '../../lib/cred-gate.mjs';
 import { scanClosure } from '../../bin/verdict-purity-guard.mjs';
+import { atomicWriteFileSync, scanPrivateAddress } from '../../lib/promptset-authoring.mjs';
+import { parseRegistry } from '../../loop-kit/bin/term-lint.mjs';
 
 const HERE = dirname(fileURLToPath(import.meta.url));
 const ROOT = resolve(HERE, '..', '..');
@@ -39,7 +47,6 @@ const tmp = mkdtempSync(join(tmpdir(), 'casey-gen-prompts-'));
 const fails = [];
 let pass = 0;
 function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
-async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
 
 function run(bin, args) { return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', timeout: 60000 }); }
 const runSeed = (args) => run(SEED, args);
@@ -209,7 +216,10 @@ check('S3e 凭据出现在第 4000 码点之后仍拦（先全文过门、后截
 });
 check('S3f embedded 夹私网地址哨兵 → exit 1，零落盘，原地址值不回显（credentialGate 非地址门，靠独立地址扫描拦；覆盖 PRD 声明的全部八类网段）', () => {
   const sentinels = [
-    ['10.0.0.0/8', '系统内网地址 http://<REDACTED-真实内网地址，round-1 已改合成占位地址>:18000/api 请勿外传', '<REDACTED-真实内网地址>'],
+    // 合成占位地址（round-1 HIGH A1 修订：此前用姊妹项目 regress_autotest 真实内网地址逐字节哨兵，违
+    // 「任何内网/真目标地址不许出现在代码与文档」硬约束；改用不对应任何真实主机的合成 10.x 地址，
+    // 覆盖面语义不变——同落 10.0.0.0/8 网段正则）。
+    ['10.0.0.0/8', '系统内网地址 http://10.20.30.40:18000/api 请勿外传', '10.20.30.40'],
     ['172.16.0.0/12', '内部服务 https://172.16.0.5/x', '172.16.0.5'],
     ['192.168.0.0/16', '管理面 http://192.168.1.7/internal', '192.168.1.7'],
     ['127.0.0.0/8', '本机回环 http://127.0.0.1:9000', '127.0.0.1'],
@@ -237,13 +247,30 @@ check('S3g 负向场景 stderr/stdout 不含输入绝对路径', () => {
   if (outText(r).includes(d)) throw new Error('不得回显临时目录绝对路径');
   if (outText(r).includes(emb)) throw new Error('不得回显 --embedded 绝对路径');
 });
-check('S3h 两新 bin 源码零内网地址字样 / 零 --base·--key·--model 旗标字样', () => {
+// regress 直调 API 旧形态的 CLI 旗标/关键词残留字样（已作废不搬）——均为通用词/旗标名，非机密，可安全字面量化；
+// 真实内网地址刻意不进此列表字面量（round-1 HIGH A1）——把「已作废地址」焊进检查器本身，等于把它重新写回仓库，
+// 违「任何内网/真目标地址不许出现在代码与文档」硬约束本身。地址检查改用 scanPrivateAddress 模式扫描（下方），
+// 不依赖任何特定真实地址的字面量即可覆盖任意私网地址。
+const OLD_REGRESS_FLAG_REMNANTS = ['--base', '--key', '--model', 'deepseek', 'AI_API_KEY'];
+check('S3h 两新 bin 源码零内网地址（scanPrivateAddress 模式扫描）/ 零 regress 直调 API 旧形态旗标残留字样', () => {
   const srcSeed = readFileSync(SEED, 'utf8');
   const srcFreeze = readFileSync(FREEZE, 'utf8');
   for (const [label, src] of [['promptset-seed.mjs', srcSeed], ['promptset-freeze.mjs', srcFreeze]]) {
-    for (const banned of ['<REDACTED-真实内网地址>', '--base', '--key', '--model', 'deepseek', 'AI_API_KEY']) {
+    for (const banned of OLD_REGRESS_FLAG_REMNANTS) {
       if (src.includes(banned)) throw new Error(`${label} 源码不得含「${banned}」（regress 直调 API 旧形态字样，已作废不搬）`);
     }
+    const addr = scanPrivateAddress(src);
+    if (addr.hit) throw new Error(`${label} 源码不得含任何私网/内网地址字面量（命中 ${addr.kind}；两 bin 零网络零 API 接线，源码不应硬编码任何地址）`);
+  }
+});
+check('S3i 金牌自身源码零 regress 直调 API 旧形态旗标残留字样（此前 S3h 只扫两新 bin、漏扫金牌自身，构成假绿——round-1 HIGH A1）', () => {
+  const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
+  for (const banned of OLD_REGRESS_FLAG_REMNANTS) {
+    // 计数而非排除定义行：本文件里每个残留字样只应在 OLD_REGRESS_FLAG_REMNANTS 自身定义处出现恰好 1 次；
+    // 出现 0 次说明清单本身缺失（检查器失能），出现 >1 次说明别处又混入了这些字样（真退化）。
+    const count = selfSrc.split(banned).length - 1;
+    if (count === 0) throw new Error(`gen-prompts.golden.mjs 应在 OLD_REGRESS_FLAG_REMNANTS 定义处含「${banned}」（检查器清单本身缺失）`);
+    if (count > 1) throw new Error(`gen-prompts.golden.mjs 源码含「${banned}」共 ${count} 处，应仅在旗标残留清单定义处出现 1 次（别处出现视为旧形态字样重新混入）`);
   }
 });
 
@@ -406,6 +433,33 @@ check('F2c --dry-run：有新增仍打印摘要且整个工作目录零差量（
   const afterList = readdirSync(d).sort();
   if (JSON.stringify(beforeList) !== JSON.stringify(afterList)) throw new Error('--dry-run 不得在工作目录产生任何新文件');
 });
+check('F2c2 --dry-run 摘要不回显候选正文/软期望原文（只印 id/category 摘要，round-1 LOW A9 修订：此前打印整条 JSON.stringify(fresh) 正文）', () => {
+  const d = freshDir('f2c2');
+  const ps = setupPromptset(d, FROZEN_AFTER_F1);
+  const distinctiveText = 'DRYRUN_FULLTEXT_SHOULD_NOT_BE_ECHOED_ZZQQ';
+  const distinctiveNote = 'DRYRUN_EXPECT_NOTE_SHOULD_NOT_BE_ECHOED_WWEE';
+  const fresh = [{ id: 'p21_dryrun_summary', text: distinctiveText, category: 'normal', expect: { note: distinctiveNote } }];
+  const cand = writeJsonFile(d, 'candidates.json', fresh);
+  const r = runFreeze(['--candidates', cand, '--promptset', ps, '--dry-run']);
+  if (r.status !== 0) throw new Error(`--dry-run happy 应 exit 0，实际 ${r.status}：${outText(r).slice(-300)}`);
+  if (!outText(r).includes('p21_dryrun_summary')) throw new Error('--dry-run 摘要应含新增 id');
+  if (!outText(r).includes('normal')) throw new Error('--dry-run 摘要应含 category');
+  if (outText(r).includes(distinctiveText)) throw new Error('--dry-run 不应回显候选 text 正文（只应打印 id/category 摘要）');
+  if (outText(r).includes(distinctiveNote)) throw new Error('--dry-run 不应回显 expect.note 正文');
+});
+check('F2d 存量含非法数据（source 非法）时即便 0 新增也须过自检、不得放行 exit 0（round-1 HIGH A4：此前 fresh.length===0 在自检之前就提前 exit 0，坏存量在幂等 no-op 重跑时被静默判成功；红先行实测：把本修复回退后此场景 exit 0 未写盘，坏数据放行——证据见 dispositions-r1.md）', () => {
+  const d = freshDir('f2d');
+  const badExisting = [...FROZEN_AFTER_F1, { id: 'p91_bad_source', text: '这条存量数据的 source 已非法（非本工具产生，模拟手改/旧数据混入）', source: 'not_a_real_source', category: 'normal' }];
+  const ps = setupPromptset(d, badExisting);
+  const before = readFileSync(ps);
+  // 候选与 FROZEN_AFTER_F1 部分逐字段等价 → 全部幂等跳过 → 真 0 新增（非"没给候选"）；p91_bad_source 未被
+  // 任何候选触及，只能靠自检（parsePromptset）在 merged 全量上跑才会被发现。
+  const cand = writeJsonFile(d, 'candidates.json', CAND_HAPPY);
+  const r = runFreeze(['--candidates', cand, '--promptset', ps]);
+  if (r.status !== 65) throw new Error(`存量含非法 source 时，即便候选 0 新增也应 exit 65（自检应挡住坏存量），实际 ${r.status}：${outText(r).slice(-300)}`);
+  if (!readFileSync(ps).equals(before)) throw new Error('拒绝时文件应不变（0 新增更不该写盘）');
+  if (outText(r).includes('not_a_real_source')) throw new Error('自检失败报错不应回显存量原始非法取值（round-1 HIGH A2 output-seal）');
+});
 
 // ================= F3 准入闸（整批拒、零写盘、exit 65） =================
 function f3Case(tag, candidates, opts = {}) {
@@ -499,6 +553,14 @@ check('F3n expect 内含未登记键 → 整批拒 exit 65（expect 子键闭合
   if (r.status !== 65) throw new Error(`应 exit 65，实际 ${r.status}：${outText(r).slice(-300)}`);
   if (!readFileSync(ps).equals(before)) throw new Error('拒绝时文件应不变');
 });
+check('F3o 未知键名不回显原键名（即便是干净、非凭据形状的哨兵字符串）——round-1 HIGH A2：此前 die(65,e.message) 把 CandidateValidationError 里内嵌的未登记键名原样带进 stderr', () => {
+  const distinctiveKey = 'ZZQQ_UNREGISTERED_SENTINEL_KEY_9f31';
+  const { r, ps, before } = f3Case('unknown-key-noecho', [{ id: 'p39_x', text: '内容', category: 'normal', [distinctiveKey]: 'value-does-not-matter' }]);
+  if (r.status !== 65) throw new Error(`应 exit 65，实际 ${r.status}：${outText(r).slice(-300)}`);
+  if (!readFileSync(ps).equals(before)) throw new Error('拒绝时文件应不变');
+  if (outText(r).includes(distinctiveKey)) throw new Error('报错不得回显未登记键名原文（即便键名本身干净不含凭据关键词）');
+  if (!outText(r).includes('UNKNOWN_KEY')) throw new Error('报错应含类别码 UNKNOWN_KEY（只出类别码，不透传原键名）');
+});
 
 // ================= F4 凭据门、地址门与原子性 =================
 check('F4a 候选 text 含凭据字面量 → exit 1 零写盘', () => {
@@ -539,6 +601,36 @@ check('F4c 新增候选 text 含私网地址 → exit 1 拒（不写盘），原
     if (!readFileSync(ps).equals(before)) throw new Error(`［${kind}］拒绝时文件应不变`);
   }
 });
+check('F4c1 scanPrivateAddress 覆盖等价编码形态（round-1 MED A6：此前只认标准点分十进制/压缩 IPv6字面量，IPv6 展开回环/八进制前导零/十进制整数/十六进制/百分号编码点号五种等价写法漏检；WHATWG URL 主机解析器归一后核对既有网段正则，非重新枚举网段）', () => {
+  const dirtyCases = [
+    ['IPv6 展开回环', '内部地址 0:0:0:0:0:0:0:1 不应出现'],
+    ['八进制前导零 IPv4', '内部地址 0177.0.0.1 不应出现'],
+    ['十进制整数 IPv4', '内部地址 2130706433 不应出现'],
+    ['十六进制 IPv4', '内部地址 0x7f000001 不应出现'],
+    ['百分号编码点号', '内部地址 127%2e0%2e0%2e1 不应出现'],
+  ];
+  for (const [kind, text] of dirtyCases) {
+    const r = scanPrivateAddress(text);
+    if (!r.hit) throw new Error(`［${kind}］scanPrivateAddress 应命中私网地址，实际 hit=false（文本：${text}）`);
+  }
+  // 干净文本不应因收紧检测而误报（假阳性面佐证：候选提取刻意收窄，不应把无关数字/版本号都判命中）。
+  const cleanCases = ['这是一条常规问句被测参数，问头疼怎么办', '本批共有 2026 条记录，编号从 1 到 2026', '版本号 v1.2.3 不是地址', '订单号是 20260713'];
+  for (const text of cleanCases) {
+    const r = scanPrivateAddress(text);
+    if (r.hit) throw new Error(`干净文本不应误报命中，实际 kind=${r.kind}（文本：${text}）`);
+  }
+});
+check('F4c2 新增候选 text 含等价编码私网地址（十进制整数形态）→ 经真实 freeze CLI 仍 exit 1 拒、原值不回显（端到端验证 A6 修复已接线，不止库函数本身）', () => {
+  const d = freshDir('f4c2');
+  const ps = setupPromptset(d, EXISTING_PS);
+  const before = readFileSync(ps);
+  const cand = writeJsonFile(d, 'candidates.json', [{ id: 'p42b_x', text: '请查看 2130706433 这个数字型主机地址', category: 'normal' }]);
+  const r = runFreeze(['--candidates', cand, '--promptset', ps]);
+  if (r.status !== 1) throw new Error(`十进制整数形态私网地址应 exit 1，实际 ${r.status}：${outText(r).slice(-300)}`);
+  if (!/私网地址扫描拦截/.test(outText(r))) throw new Error('exit 1 须精确出自地址扫描点名（防与相邻分支共享的宽松锚混淆假绿）');
+  if (outText(r).includes('2130706433')) throw new Error('报错不得回显原地址值');
+  if (!readFileSync(ps).equals(before)) throw new Error('拒绝时文件应不变');
+});
 check('F4d 新增候选 text 含裸 :// → exit 65 拒（存量条目不追溯）；expect.note 同禁（此前实现只查 text/mustInclude/mustNotInclude 漏了 note）', () => {
   const d1 = freshDir('f4d');
   const ps1 = setupPromptset(d1, EXISTING_PS);
@@ -556,8 +648,7 @@ check('F4d 新增候选 text 含裸 :// → exit 65 拒（存量条目不追溯
   if (r2.status !== 65) throw new Error(`expect.note 裸 :// 应 exit 65，实际 ${r2.status}：${outText(r2).slice(-300)}`);
   if (!readFileSync(ps2).equals(before2)) throw new Error('拒绝时文件应不变（expect.note 场景）');
 });
-await checkAsync('F4e atomicWriteFileSync 注入 write 失败：目标原字节保留，无 .tmp 残留', async () => {
-  const { atomicWriteFileSync } = await import(`file://${join(ROOT, 'lib', 'promptset-authoring.mjs').replace(/\\/g, '/')}`);
+check('F4e atomicWriteFileSync 注入 write 失败：目标原字节保留，无残留临时文件（round-1 HIGH A3 修订：tmp 名现改随机唯一，不再假设固定 .tmp 后缀，改扫整个目录）', () => {
   const d = freshDir('f4e');
   const target = join(d, 'atomic.txt');
   writeFileSync(target, 'ORIGINAL-BYTES');
@@ -565,10 +656,10 @@ await checkAsync('F4e atomicWriteFileSync 注入 write 失败：目标原字节
   try { atomicWriteFileSync(target, 'NEW-BYTES', { writeFn: () => { throw new Error('注入 write 失败'); } }); } catch { threw = true; }
   if (!threw) throw new Error('注入 write 失败应向上抛');
   if (readFileSync(target, 'utf8') !== 'ORIGINAL-BYTES') throw new Error('write 失败后目标原字节应保留');
-  if (existsSync(`${target}.tmp`)) throw new Error('write 失败后不得残留 .tmp');
+  const leftovers = readdirSync(d).filter((f) => f !== 'atomic.txt');
+  if (leftovers.length) throw new Error(`write 失败后不得残留任何临时文件，实际：${leftovers.join(',')}`);
 });
-await checkAsync('F4f atomicWriteFileSync 注入 rename 失败：目标原字节保留，无 .tmp 残留', async () => {
-  const { atomicWriteFileSync } = await import(`file://${join(ROOT, 'lib', 'promptset-authoring.mjs').replace(/\\/g, '/')}`);
+check('F4f atomicWriteFileSync 注入 rename 失败：目标原字节保留，无残留临时文件（同上，改扫整个目录）', () => {
   const d = freshDir('f4f');
   const target = join(d, 'atomic2.txt');
   writeFileSync(target, 'ORIGINAL-BYTES-2');
@@ -576,14 +667,62 @@ await checkAsync('F4f atomicWriteFileSync 注入 rename 失败：目标原字节
   try { atomicWriteFileSync(target, 'NEW-BYTES-2', { renameFn: () => { throw new Error('注入 rename 失败'); } }); } catch { threw = true; }
   if (!threw) throw new Error('注入 rename 失败应向上抛');
   if (readFileSync(target, 'utf8') !== 'ORIGINAL-BYTES-2') throw new Error('rename 失败后目标原字节应保留');
-  if (existsSync(`${target}.tmp`)) throw new Error('rename 失败后不得残留 .tmp（须清理）');
+  const leftovers = readdirSync(d).filter((f) => f !== 'atomic2.txt');
+  if (leftovers.length) throw new Error(`rename 失败后不得残留任何临时文件，实际：${leftovers.join(',')}`);
 });
-check('F4g happy 路径跑完无 .tmp 残留', () => {
-  const d = freshDir('f4g');
-  if (existsSync(`${F1_PS}.tmp`)) throw new Error('F1 happy 之后不应残留 .tmp');
+check('F4g happy 路径跑完无残留临时文件', () => {
   const files = readdirSync(F1_D);
   if (files.some((f) => f.endsWith('.tmp'))) throw new Error(`happy 目录下不应有 .tmp 文件，实际：${files.join(',')}`);
 });
+check('F4h atomicWriteFileSync 每次调用生成互不相同的随机临时文件名（round-1 HIGH A3/A8 修订：此前固定 ${path}.tmp，两次调用/两进程共用同一 tmp 名会互相覆写；实测同目标连打两枪，tmp 名不同）', () => {
+  const d = freshDir('f4h');
+  const target = join(d, 'atomic3.txt');
+  const seenTmpPaths = [];
+  const capture = (p, t) => { seenTmpPaths.push(p); writeFileSync(p, t, { encoding: 'utf8', flag: 'wx' }); };
+  atomicWriteFileSync(target, 'A', { writeFn: capture });
+  atomicWriteFileSync(target, 'B', { writeFn: capture });
+  if (seenTmpPaths.length !== 2) throw new Error(`应各调用一次注入的 writeFn，实际 ${seenTmpPaths.length} 次`);
+  if (seenTmpPaths[0] === seenTmpPaths[1]) throw new Error(`两次调用应使用互不相同的随机临时文件名，实际相同：${seenTmpPaths[0]}`);
+  if (readFileSync(target, 'utf8') !== 'B') throw new Error('两次连续调用后目标应是最后一次写入的内容（正常"后写者赢"语义，非损坏）');
+});
+check('F4i atomicWriteFileSync 防符号链接 sidecar 攻击：黑盒复现——预先在此前固定使用的 legacy tmp 路径（${target}.tmp）落地指向受害文件的符号链接，不注入任何 fs 替身，直接调用默认实现；受害文件字节不变、目标文件正常拿到真实写入内容（round-1 HIGH A3：修复前同一黑盒复现会导致受害文件被截断改写，见 dispositions-r1.md 红证）', () => {
+  const d = freshDir('f4i');
+  const victim = join(d, 'victim.txt');
+  writeFileSync(victim, 'VICTIM-ORIGINAL-BYTES');
+  const target = join(d, 'target.txt');
+  writeFileSync(target, 'TARGET-ORIGINAL-BYTES');
+  const legacyFixedTmpPath = `${target}.tmp`; // 修复前固定使用的 tmp 命名规则——攻击者据此可预先落地符号链接
+  symlinkSync(victim, legacyFixedTmpPath);
+  let threw = false;
+  try { atomicWriteFileSync(target, 'REAL-NEW-CONTENT'); } catch { threw = true; }
+  if (readFileSync(victim, 'utf8') !== 'VICTIM-ORIGINAL-BYTES') throw new Error('受害文件字节不得被改动（符号链接跟随攻击应被随机 tmp 名 + wx 旗标挡住）');
+  if (!threw && readFileSync(target, 'utf8') !== 'REAL-NEW-CONTENT') throw new Error('未抛异常时，目标文件应正常拿到本次真实写入内容（说明写入走的是新随机 tmp 名，未被预置符号链接影响）');
+});
+check('F4j 已有 promptset.json 原文夹带凭据/私网地址 → freeze 拒（exit 1），零写盘、原值不回显（round-1 LOW A10：机制实存但此前金牌未钉覆盖）', () => {
+  const d1 = freshDir('f4j-cred');
+  const ps1 = join(d1, 'promptset.json');
+  const credSentinel = 'ZZQQEXISTINGSECRETSENTINEL';
+  writeFileSync(ps1, JSON.stringify([{ id: 'p92_x', text: `已冻结存量里混进了 password 是 ${credSentinel}`, source: 'user', category: 'normal' }], null, 2) + '\n');
+  const before1 = readFileSync(ps1);
+  const cand1 = writeJsonFile(d1, 'candidates.json', [{ id: 'p93_new', text: '正常新候选', category: 'normal' }]);
+  const r1 = runFreeze(['--candidates', cand1, '--promptset', ps1]);
+  if (r1.status !== 1) throw new Error(`存量原文含凭据应 exit 1，实际 ${r1.status}：${outText(r1).slice(-300)}`);
+  if (!/凭据兜底门拦截/.test(outText(r1))) throw new Error('exit 1 须精确出自凭据兜底门点名（防与相邻分支共享的宽松锚混淆假绿）');
+  if (outText(r1).includes(credSentinel)) throw new Error('报错不得回显存量原文里的凭据哨兵值');
+  if (!readFileSync(ps1).equals(before1)) throw new Error('拒绝时存量文件应不变');
+
+  const d2 = freshDir('f4j-addr');
+  const ps2 = join(d2, 'promptset.json');
+  const addrNeedle = '192.168.44.55';
+  writeFileSync(ps2, JSON.stringify([{ id: 'p94_x', text: `已冻结存量里混进了内部地址 ${addrNeedle}`, source: 'user', category: 'normal' }], null, 2) + '\n');
+  const before2 = readFileSync(ps2);
+  const cand2 = writeJsonFile(d2, 'candidates.json', [{ id: 'p95_new', text: '正常新候选二', category: 'normal' }]);
+  const r2 = runFreeze(['--candidates', cand2, '--promptset', ps2]);
+  if (r2.status !== 1) throw new Error(`存量原文含私网地址应 exit 1，实际 ${r2.status}：${outText(r2).slice(-300)}`);
+  if (!/私网地址扫描拦截/.test(outText(r2))) throw new Error('exit 1 须精确出自地址扫描点名（防与相邻分支共享的宽松锚混淆假绿）');
+  if (outText(r2).includes(addrNeedle)) throw new Error('报错不得回显存量原文里的私网地址值');
+  if (!readFileSync(ps2).equals(before2)) throw new Error('拒绝时存量文件应不变');
+});
 
 // ================= F5 freeze 路径闸 =================
 check('F5a --promptset 无 .json 后缀 → exit 65', () => {
@@ -637,6 +776,30 @@ check('P1 parsePromptset 收 source:llm；未知 source(robot) 仍抛且报错
   if (!threw) throw new Error('未知 source(robot) 应仍抛');
 });
 
+// ================= T1 CONTEXT 词条对 term-lint 解析器无退化（round-1 MED A5，both 源汇聚） =================
+// parseRegistry 用裸 split('|') 解析四列制注册表、不认 Markdown \| 转义；本契约新增的 promptset 词条
+// source 枚举描述此前用 \| 分隔三选项，被误裂出多余列、把「builtin（随 注入向量库 发）」错判成 promptset
+// 的弃用别名（幽灵别名）。修法：词条改用全角｜分隔（不触发 ASCII split('|')），根因在复用件 loop-kit 的
+// 解析器（保护面，另案），本契约只钉住「己方词条书写不再触发该缺陷」。
+check('T1a CONTEXT.md 的 promptset 词条不产生任何幽灵弃用别名（parseRegistry().deny 不应含 canonical=promptset 的项）', () => {
+  const reg = parseRegistry();
+  const ghost = reg.deny.find((d) => d.canonical === 'promptset');
+  if (ghost) throw new Error(`promptset 词条不应产生任何幽灵别名，实际命中：${JSON.stringify(ghost)}`);
+});
+check('T1b CONTEXT.md 的 promptset 词条 gloss 完整含 user/builtin/llm 三枚举说明（未被误裂截断）、且不再使用 \\| 转义管道', () => {
+  const text = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
+  const line = text.split(/\r?\n/).find((l) => l.startsWith('| `promptset` |'));
+  if (!line) throw new Error('CONTEXT.md 应含 `promptset` 词条行');
+  if (!line.includes('`user`（人写）') || !line.includes('`builtin`（随 注入向量库 发）') || !line.includes('`llm`（`gen-prompts` 契约扩容')) {
+    throw new Error('promptset 词条行应完整含 user/builtin/llm 三枚举说明（未被裂列截断）');
+  }
+  if (line.includes('\\|')) throw new Error('promptset 词条行不应再使用 \\| 转义管道（parseRegistry 裸 split(\'|\') 不认转义会误裂列产生幽灵别名，改用全角｜）');
+});
+check('T1c node loop-kit/bin/term-lint.mjs --registry 经 CLI 实跑 exit 0（防导入态与 CLI 态解析口径分叉）', () => {
+  const r = run(join(ROOT, 'loop-kit', 'bin', 'term-lint.mjs'), ['--registry']);
+  if (r.status !== 0) throw new Error(`--registry 应 exit 0，实际 ${r.status}：${outText(r).slice(-300)}`);
+});
+
 // ================= N1 不进回放/裁定闭包（防退化钉） =================
 check('N1a import 闭包核：bin/replay.mjs / bin/verdict.mjs / bin/promptset.mjs 均不含 authoring 模块', () => {
   for (const [label, entry] of [['replay', REPLAY], ['verdict', VERDICT], ['promptset', PROMPTSET_BIN]]) {
@@ -646,11 +809,23 @@ check('N1a import 闭包核：bin/replay.mjs / bin/verdict.mjs / bin/promptset.m
     }
   }
 });
-check('N1b spawn 边扫描：三份回放侧文件源文本零 promptset-seed/promptset-freeze/promptset-authoring 字样', () => {
+// 去块注释/行注释后再扫（镜像 bin/verdict-purity-guard.mjs 内部 stripComments 的同款近似做法，该函数未导出
+// 故本文件另起一份等价实现）——纯文档性质的交叉引用注释（如"见 lib/promptset-authoring.mjs"）不是 spawn 边，
+// 不该被误判；真正的 spawnSync(...) 调用/字符串拼目标必然落在可执行代码里，去注释后依然会被扫到。
+function stripCommentsForScan(text) {
+  let s = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
+  s = s.replace(/([^:'"\\])\/\/[^\n]*/g, '$1');
+  return s;
+}
+check('N1b spawn 边扫描：三份回放侧文件的整个 import 闭包（不止入口自身）去注释后零 promptset-seed/promptset-freeze/promptset-authoring 字样（round-1 MED A7 修订：此前只查入口文件自身源文本，helper 转发 spawnSync 可绕；改核闭包内每个文件，去注释防文档性交叉引用误判）', () => {
   for (const [label, entry] of [['replay', REPLAY], ['verdict', VERDICT], ['promptset', PROMPTSET_BIN]]) {
-    const src = readFileSync(entry, 'utf8');
-    for (const bad of ['promptset-authoring', 'promptset-seed', 'promptset-freeze']) {
-      if (src.includes(bad)) throw new Error(`${label} 源文本不得含「${bad}」字样（spawn 边防退化）`);
+    const { visited } = scanClosure(entry);
+    const filesToScan = new Set([resolve(entry), ...visited]);
+    for (const file of filesToScan) {
+      let src; try { src = stripCommentsForScan(readFileSync(file, 'utf8')); } catch { continue; }
+      for (const bad of ['promptset-authoring', 'promptset-seed', 'promptset-freeze']) {
+        if (src.includes(bad)) throw new Error(`${label} 闭包内 ${file} 源文本（去注释后）不得含「${bad}」字样（spawn 边防退化）`);
+      }
     }
   }
 });
```
