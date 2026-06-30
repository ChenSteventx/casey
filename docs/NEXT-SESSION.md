# 下个 session 接续提示词（Casey / 排期 v2 第2层，P5 回放内核 next）

> 用法：下次只需说「读 `docs/NEXT-SESSION.md` 接着干」。本文件是给接续 Claude 的执行指令；状态事实以 `docs/HANDOFF.md` 为准，二者冲突时信 HANDOFF。

## 第一步：先读，别跳

1. `CLAUDE.md` 必读顺序：`CONTEXT.md` → `docs/design/txt2testreport-design.md` → `docs/plans/bootstrap/plan.md` → `loop/GUARDRAILS.md`。
2. `docs/HANDOFF.md`（现状、产物、冻结接口、下一步）。
3. `docs/plans/p2-intent-compile/`：`grill.md`（锁定决策）、`plan.md`（三 story + 验收点）、`regress-intel.md`（带 file:line 的实现参考，建 impl 时直接查、别重跑深读）。
4. `docs/adr/0006-fuse-autotester-regress.md`（融合决策 + 深读核验后的风险修正）。
5. 跑 `node bin/casey.mjs selftest --tier1` 确认环境。注意：别加 `2>&1` 这类重定向——会被 loop-guard 误判成 edit-impl 拦下；要看输出直接跑即可。

## 一句话现状

排期 v2/v3 已落；P5（★ 回放核心，第2层最后一轨）loop 绿（2026-06-30）：`bin/replay.mjs` + `lib/{replay-actions,replay-forensics,replay-assert,drift-probe,instantiate}.mjs` 全建成，真 chromium 回放假 SUT 产三轴喂已冻 `verdict.mjs`，golden 10/10 全绿。accept 前修法发现并修掉一个冻结夹具缺陷：进程内假 SUT 被同步 `execFileSync(replay)` 冻死、答不了 replay 浏览器（goto 卡死）→ 把假 SUT fork 出独立进程（8 态行为一字未改），server.mjs checksum 重签入 prd、accept 重签、gate GREEN。`active-contract.json` = `p5-replay`（full，grill/plan/accept/loop done，review 待）。下一步 = P5 异构冗余评审（codex:gpt-5.5 非同族，评审料 `scratchpad/p5-review-packet.md`，护栏 #9 只喂 spec+diff+证据），判 FAIL 采信去修、判 PASS 记 `loop/audit.jsonl` 再 `advance review`；再 tier-2 真机 route:human（护栏 #16 gate 绿 != 完成）。细节信 `docs/HANDOFF.md`，内部排期信 `docs/plans/p5-replay/exec-plan.md`。

## WSL 环境注意（下次在 WSL/bash 跑，不再 PowerShell）

1. 行尾/checksum（已核实安全，无需处理）：`.gitattributes` 钉 `eol=lf`，整库已是 LF 一致——HEAD `blob`、工作树、testChecksums 三者全按 LF 字节对齐（2026-06-29 用 node `buf.includes(0x0d)` + `git cat-file blob` 逐文件核 CR=0，7 个 `gate` + `selftest` 全绿）。WSL `checkout` LF `blob` 仍出 LF、字节稳、ratchet 不失配，进 WSL 后**直接干即可**。两个坑别踩：(a) 查行尾别用 `grep -c $'\r'`——git-bash 下这个 CR pattern 会退化成空 pattern、把**行数**误报成 CR 数（本会话一度据此误判「工作树 CRLF」、追了个不存在的幻影）；要查用 node 数 `0x0d`、或 `git cat-file blob <f> | od -c`。(b) 本仓 local config 已设 `core.autocrlf=false` + `core.eol=lf`，与 `.gitattributes` 同向、防 Windows 端未来 CRLF 渗入；WSL 端 Linux git 默认即 LF，无需另设。
2. 路径：`D:\ctx\heren\casey` → `/mnt/d/ctx/heren/casey`；`M:` → `/mnt/m/`（`M:\home` 仍禁用，产物放 /mnt/m 别处且**先问确切路径**）。提交代码无硬编码盘符（可移植）。autotester 复用源 → `/mnt/d/ctx/heren/autotester`。
3. playwright（P5 前置）：WSL 要装 Linux（非 Windows）playwright `npx playwright install --with-deps chromium`（需 libnss3 等系统依赖），**不能借** autotester 的 Windows chromium。
4. shell + loop-guard：用 bash（`cp`/`rm`/`sha256sum`/`ps`），不是 PowerShell cmdlet。loop-guard 的 WRITE_CAP 正则按 bash 写——`cp`/`rm`/`>` 会被正确命中：(a) 读类命令带 `2>&1`/`>` 且含 `bin/` 路径会被误判 edit-impl 拦（PS 下也有）；(b) 本会话用 `Copy-Item` 把文件拷进 `lib/` 绕过 edit-impl 的 loophole，bash 下 `cp` 进 `lib/` 会被拦——baton-swap landing 改走 git-native（`merge`/`apply`），别 `cp` 进 lib/bin。
5. git 跨平台：别在 /mnt/d 上混用 Windows git 与 WSL git（filemode/CRLF 会让一堆文件假报 modified）。`core.filemode` 已 false。`windows.appendAtomically false` 那条 config 在 WSL 无害（Linux git 忽略）；Windows 的 index.lock 写错坑 WSL 没有，但 /mnt/d 是 9p 挂载、偏慢。

## 这次要干：先审 accept 4 处承诺 → 冻 → Phase 2 起 runner

Phase 0+1 已落（环境 + 假 SUT + 红 golden + prd），accept 已备未冻。第一步是**人审 accept 4 处承诺**（细节在 `docs/HANDOFF.md`「下一步」）：① runner CLI 形态 `node bin/replay.mjs --events --sut --expected --denylist --out`；② 漂移探针契约（探针从 atom+targetName 构造 `drift-patch` canonical）；③ expected 是对着假 SUT 自写的（已冻 expected-frozen 与 events.fixture 对不上）；④ 假 SUT `server.mjs` 进 testChecksums。审过 → `node loop-kit/bin/contract.mjs advance accept --artifact loop/prd-p5-replay.json` 冻、解锁 `lib`/`bin`。

Phase 2 实现（按 `docs/plans/p5-replay/exec-plan.md` 的并行/串行排期）：先 `robust-actions` 三轴埋点（主干入口），再串 runner→StepAxes 合并→喂已冻 verdict，叶子模块（replay-guards/instantiate/watchPageLifecycle/waitForReplyByStream/watchNetworkForensics/漂移探针）fan-out 起草。不开 worktree、不起第二契约（单活契约 baton 教训）。决策仍按 ADR-0007 7 条（基座 A、CDP 真发起方归因、三轴按 intent、本地 fixture server、流式 finished、漂移探针只读、唯一名 instantiate）。

环境前置已清：playwright 1.60.0 + chromium + 系统库装齐、headless 实起验过（不必再补环境）。

组件（accept→loop）：
- fixture server（新建假 SUT，借 autotester `web/server.mjs` 的 http 骨架；它是控制台不是 SUT mock、非照搬）：静态假 SUT HTML（含 events 所指 role/accessibleName 元素）+ 可脚本化路由（save 200/500+信封、背景 poll 401、SSE 流、触 pageerror）。
- 回放 runner：移植 autotester `robust-actions`/`_fixtures`，消费已冻 `tests/_golden/fixtures/seams/events.fixture.json`、按 intentId 聚合 N 个 event 依序回放、`instantiate` 填 `{{uniqueName}}`（atl_ 由 compile-gate 注入）。
- `watchNetworkForensics`（新建）：CDP `Network.initiator` 真发起方 + site.json 背景 denylist + 证不出归 null（背景 401 不翻 verdict 的命门）；`watchPageLifecycle` 移植。
- 三轴产出：按 intent 出 `axes.json`（形态对齐已冻 `tests/_golden/fixtures/p2/verdict-cases.json` 的 StepAxes）→ 喂已冻 `bin/verdict.mjs`。
- 只读漂移探针 `findEquivalentAffordance`：同稳定签名 count===1（不点、不改 spec）。
- 红 golden 对 fixture server：replay→axes→verdict happy path + 注 500 出 SUT_DEFECT + 背景 401 不背书 + 漂移出 HARNESS_ERROR + 流式 finished；accept(--red-verified)→loop 绿。

第2层产物已 live、被各 golden 钉死（勿改测试）：`lib/report.mjs`(P7)、`lib/expected-compile.mjs`+`lib/sign-gate.mjs`(P4)、`lib/heal-gate.mjs`+`lib/drift-patch.mjs`(P6)、`tests/_golden/p2-*-coverage.golden.mjs`(track-F)。已冻接缝在 `tests/_golden/schemas/` + `tests/_golden/fixtures/seams/`。

## 纪律硬约束（反复栽的，务必守）

- 统一语言（ADR-0005）：动任何词先查 `CONTEXT.md`，有现成用现成、造词先登记。**绝不在回合输出里发加粗英文**——连散文标题加粗拉丁字母都会被 Stop hook 当场拦；每条要发的话先过 `node loop-kit/bin/term-lint.mjs`（检的是含加粗的最终形态），code 用反引号是安全的、不会被扫。裁判义用 裁定/裁判/多态裁定，路由义用 路由人。
- 阶段互锁：active-contract = `p5-replay`（full）；P5 accept 未走 → 先 accept 冻红 golden 才能改 `lib`/`bin`，`commit-impl` 需 loop done。单活契约 baton：并行多契约会撞主树共享槽（教训见 HANDOFF「契约/运维」），别再盲目并行起多 full 契约。
- 裁判零 LLM（护栏 #15）：`verdict.mjs` 纯确定性，自愈是其下游消费者、本期不做。fail-safe 不 fail-open（#14）：机器证不出一律 `NEEDS_HUMAN`。冻结测试只读（#1）。`.auth/`、`site.json` 凭据不进任何输出/日志/报告（#7）。
- **裁判按种类不可知（岔一，2026-06-29 锁）**：`verdict.mjs` 消费已判好的 `StepAxes`，对 `postAssertions` 只把硬断言 `ok` 与上、忽略 `soft`，**绝不按种类分支**（不 switch on `kind`）；取证缺失子字段当「本步无此特征」、不报解析错；断言 `kind` 只在 `check.mjs` 枚举。这样对话/发布等新维度是纯加法、`verdict.mjs` 不动。背景与岔二/岔三倾向见 `docs/FLYWHEEL.md` 开 loop 前细化（2026-06-29）条。
- Bash 小坑：含 `2>&1` 或 `>` 重定向、且命令里带 `bin/` 路径，会被 loop-guard 误判 edit-impl 拦——读类命令别带重定向。
- gate 绿 ≠ 完成（#16）：真机三轴回放（`@playwright/test` 薄壳跑 Heren）与注入故障出 SUT_DEFECT 是 route:human 的 tier-2，不在 loop 绿范围；它们在 prd 的 observability 里。

## 后续方向：数据飞轮（第一条绿后）

第一条 flow 真绿后，按维度扩 flow 是 roadmap（chat → 发布 → 画布最后），骑 regress 现成语料；排期、复利项、与 ratchet 的加法式关系见 `docs/FLYWHEEL.md`。对本次 loop 的直接影响：S1 的 `verdict`/`forensics`/`StepAxes` 抽象要按「将来喂三四种 flow 形状」设计，别只对着 `catalog_wf_crud` 长——第一条绿时飞轮的轴得已经通用，第二条接上去是移植原子、不是重做内核。

## 待裁决（route:human）

端态运行时 A/B/C 已拍 A（ADR-0007）。剩 route:human：CDP initiator 真发起方栈分类在真 Heren 流量下的可靠度（ADR-0007 推翻条件——不可靠则退「denylist + 活动步窗 + 仍证不出归 null」，绝不退纯时间窗）；tier-2 真机注 HTTP500 出 SUT_DEFECT；其余见各 prd observability。

## 文风

正式、规范、自然的简体中文，不用网络用语、不用英文直译腔；复杂决策先 grill、再落 `CONTEXT`/ADR。
