# gen-prompts round-1 逐条处置（修复者 sonnet5，2026-07-14）

依据 `docs/plans/gen-prompts/review/arb-r1.md`（fable@xhigh 汇裁）的 10 条采信 finding 逐条处置。10 条全部判定为真问题（无一条在本轮被我证伪——arb-r1.md 里唯一的证伪点，即 pi 的「0 新增会改字节」claim，已由 fable 汇裁阶段自行证伪并采信 codex 的自检旁路方向，见该文件"分歧"一节，不在本文档重复举证）。以下逐条给出修法、改动位置、以及可复核的红先行证据（代码行 + 行为实测）。

## A1（HIGH）金牌含姊妹项目真实内网地址，S3h 自扫描漏扫自身

**修法**：
1. `tests/_golden/gen-prompts.golden.mjs` S3f 的 `10.0.0.0/8` 哨兵地址由真实内网地址（与 `regress_autotest/scripts/gen-prompts.mjs:27` 默认 API 基址逐字节一致）改为合成占位地址 `10.20.30.40`（同落 `10.0.0.0/8` 网段正则，覆盖语义不变）。
2. S3h（第 255 行）改用具名常量 `OLD_REGRESS_FLAG_REMNANTS`（不再含任何真实地址字面量），私网地址检查改用 `scanPrivateAddress` 模式扫描（不依赖特定地址值即可覆盖任意私网地址）。
3. 新增 S3i（第 266 行）：金牌自身源码里，`OLD_REGRESS_FLAG_REMNANTS` 里每个残留字样必须恰好出现 1 次（即只在清单定义处），出现 0 次判"清单缺失"、出现 >1 次判"别处混入"——把自扫描面从"只查两新 bin"补到"金牌自身也查"。
4. 顺带清理：`docs/plans/gen-prompts/review/material-r1.md` 里两处引用该真实地址的评审材料原文（第 1894、1926 行附近）做了脱敏替换（`<REDACTED-真实内网地址>`），因为它是即将随本轮提交进仓库历史的文档，"任何内网/真目标地址不许出现在代码与文档"对文档同样成立。

**证据**：
- 全仓 sweep：`grep -rn "10.10.76.237" .`（排除 node_modules）在本轮修复后返回 0 处命中（修复前返回 `tests/_golden/gen-prompts.golden.mjs:212` 与 `:244` 两处，与 `regress_autotest/scripts/gen-prompts.mjs:27` 的 `http://10.10.76.237:18000/api` 逐字节一致，已核对）。
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
1. tmp 名从固定 `${path}.tmp` 改为 `` `${path}.${randomBytes(9).toString('hex')}.tmp` ``（第 257 行，72 位随机熵）——每次调用互不相同，структур上消除"两进程/两次调用共用同一 tmp 名互相覆写"（A8 的主要子问题）。
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
