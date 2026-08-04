All checks complete. Let me compile the review.

---

# R2 复核：p9-replay-authority-split（grok R1 findings 修订闭合审）

## 一、可复现实证（只信退出码）

| 项 | 结果 |
|---|---|
| 红金牌实跑 | `node tests/_golden/p9-replay-authority-split.zero-sut.golden.mjs` → **0/14，exit 1**，14 条全部 FAIL，红因与红证逐字一致（R1/R2 哨兵已落盘=无门实证；R3–R13 `ERR_MODULE_NOT_FOUND`=生产面未动工） |
| sha256 对账 | 实测 `c61b7046e147f5c64c541f13aeb33a5b355a6915d401e6cd0467eb699d0cd027`，与红证头部**一致** |
| 零浏览器启动 | 全部 spawn 带 `CASEY_LAUNCH_SENTINEL`（`bin/replay.mjs:450` launch 前短路 exit 66）；R1/R2 的「哨兵已落盘」证明的是**洞还在**，非真启 chromium |
| 生产件零动 | `git diff --stat -- lib bin loop` 为空；`git status` 无已跟踪改动；基线 HEAD=96f6107 与红证一致 |
| 八枚 v3 金牌 | 逐枚实跑**全部 exit 0**（8/8、8/8、6/6、9/9、6/6、4/4、5/5、4/4），与 evidence 基线表逐行一致，红金牌加入零副作用 |
| 工作树夹具 | 两清单真实复制非软链，sha256 与 evidence 一致；`cases/`、`runs/` 在 .gitignore |

## 二、R1 findings 修订闭合核实（逐条）

- **C1 时序**：`plan.md` §3.3（:83-107）改为 launch 前原子 check-and-set（先记再放行、落盘失败 `allowLaunch:false`、崩溃不默认复用旧 nonce）。先例引证实测准确：`consumeWinProbeChallenge` 确在前置门后、成员循环（:387）前作废（collect.mjs:371-372）。**R10（golden:389）可证伪面成立**——第一进程到达哨兵点（launch 前瞬间）时断言台账已存在且含 nonce；「跑完再写」实现必然读不到台账而红。R13（golden:473）钉写失败/抛异常 → fail-closed。全文档无残留「跑完写台账」处方（仅 :91/:94 诊断性引用初稿错误）。
- **C2 临界路径**：`plan.md` §4（:154-159）台账校验与占用和 grant handle 同级必填进浏览器前门、单一台账根、采集层「不做闸、不写台账」（:141/:147/:249）。R10 是**直接 spawn `bin/replay.mjs`** 的第二进程拒跑，钉的就是绕过采集层的直跑路径——「仅 collect 写台账」语义缝已消除。
- **H1**：§3.5（:116-124）生产 `now`=主机墙钟、禁 CLI 喂时、注入只留纯 judge；R9 过期→exit 65 `REPLAY_GRANT_EXPIRED`、哨兵证未 launch。
- **H2**：§3.1（:59-62）**删字段并论证**（留计数字段=将来被理解成「可>1」的口子），非钉死变通；GRILL:108 同步。全文档除排除说明外零残留。
- **H3**：§3.6（:125-134）全文改口「批级一次性票据」，run 绑定=核销后审计映射；GRILL D3 本就批级。设计件无残留处方性 run-scoped。
- **M1/M2/M3/M4/L1/L2**：R11（golden:426 拒跑+回执+正控）、§3.4（:108-115 台账协议）、R12（golden:448 两向拒）、§3.1（:63-66 机器 draft 生成 `randomBytes(16)`——已实测 `ensureWinProbeChallenge` 同款：manifest.mjs:257-259）、§4.1（:164-181 三句有界豁免，实测对准 casey.mjs:109-110 / replay.mjs:144 / manifest.mjs:111-117）、§3.1（:72-74 摘要签名边界）。全部落位。
- **R3a 诚实性**：实测今日结构 reader 对 `created-workflow-replay-grant` 形状件已拒（`CREATED_WORKFLOW_AUTHORITY_INVALID`），红因确系造不出夹具而非守卫缺席——标注属实。

## 三、修正范围核实

四处 controller 直调（authority-cli:77、legacy:56/65、replay-evidence:51）与 A6 spawn、T5 清单夹具——实测全仓唯此 4 个调用点、无 v3 族外金牌用 controller 或 spawn 带 `--created-workflow-authority`，§6 清单精确无遗漏。A5 次序约束（新门须在 batch-token 门后）与 `replay.mjs:70-73` 实测一致。T9a「断言零改」属实（钉的是真件过校验器；真清单今天本来就红，SIGNING-SESSION.md:432 在册）。

## 四、残差 findings（非否决，实现前应钉死/落位）

- **[Low-Med] 并发原子性原语未指定，R10 只钉顺序双跑**：§3.4「先写者赢：两个进程不可能都拿到放行」承诺高于所描述的「临时文件+rename」——两个进程同时读到空台账时，后者 rename 会覆盖前者记录，once 在真并发窗口仍可被击穿。§3.3 已承诺「原子 check-and-set」，但未指定原语（O_EXCL 标记 / 文件锁 / 目录 rename 原子性），R10 是串行（第一进程先退出）。实现须选真互斥原语，建议加并发 spawn 钉或至少收口措辞。
- **[Low] R9 的禁喂时仅靠 `!output.includes('--now')` 文本守卫**：过期拒跑功能已钉（真实墙钟下确定性红），但「实现加了个 --now 旗标」不会翻钉——属设计约束，非机制。
- **[Low/nit] `plan.md` §3.1「前四项的理由是结构闭包已由结构件签死」**对 `platformId`/`batchToken` 不精确（两者不在结构闭包内；batchToken 的真实理由是 §3.3 的运行期现生成）。排除结论与论证正确，仅措辞粗。
- **[Info] 直接 `bin/replay.mjs` 无结构件路径（无 trio 无票）跑变更型**：与 v3 契约同界，非本修订引入，§4.1 豁免口径诚实，不构成回归。

## 五、结论

R1 全部 findings（C1/C2/H1/H2/H3/M1–M4/L1–L5）在修订稿中**干净闭合**：时序、临界路径、时钟、字段、名实、台账协议、受众、熵、豁免、签名边界逐条落位且引证准确；红证真实可复现（0/14、exit 1、sha256 对账、零浏览器）；生产件零动；八枚 v3 金牌实测全绿、amendment 清单精确无遗漏。残差均非修出的新洞，属实现期需收口的最低层契约细节，不足以否决前提。

VERDICT: PREMISE_SOUND
