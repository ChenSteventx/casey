# sign — 相2 人签门（full）

## 背景

七相流水线的相2 后半：`draft` 产未签草稿，`sign` 盖章冻结。今天 `casey sign` 是诚实桩（exit 3），
只有读侧门 `lib/sign-gate.mjs` 存在。本相补签发端 + 未签 fail-closed 接线，让「未签→报告出结论」
这条 fail-safe 真生效，并让报告能显示「已签/期望版本」、解锁 verdict 的 CASE_DEFECT/SUT_DEFECT 分水岭。
决策全表见 `proposed/GRILL.md`（D1 未签闸落点 Steven 拍板、知 ~7 金牌爆炸半径仍选无后门）。

## 改动

1. `bin/sign.mjs`（新建，零 LLM 确定性 CLI）：`casey sign <caseId> --draft <f> --prd <f> --frozen-out <f>
   --signer <id> --against-build <id> [--signed-at <iso>] [--verdict-baseline <f>] [--resign] [--force]`。
   - draft→frozen：逐条 `intents[].expected[]` + `globalAssertions[]` 盖 signedAt/signedAgainstBuild/signerId；
     去 draft-only 的 `pending`（frozen schema `additionalProperties:false` 禁）；输出前自守
     `assertSignedContract(frozen).ok===true` + 白名单键自检；任一不过 exit 65 零落盘（半份比没有更危险）。
   - pending 非空默认拒签 exit 65；`--force` 放行 + 留痕独立旁车（D2）。
   - expectedVerdict 仅 `--verdict-baseline` 人给值、强制 fail-safe 不变量；缺则不写、绝不反推（D3）。
   - checksum：`sha256(frozen)` 写 prd `testChecksums[expectedFrozenPath]` + 设 `expectedFrozenPath`；
     只冻断言文件（D5）。重签 `--resign` 归档旧 frozen + anti-clobber（D4）。全落盘过 `lib/cred-gate.mjs`。
2. `bin/replay.mjs`（加法接线）：读完 expectedDoc 后、开浏览器前插 `assertSignedContract(expectedDoc)`
   前置闸，非 ok exit 65 fail-closed（护栏 #14，复用既有 65 码义，不改 0/1/64）。空断言 vacuously ok。
3. `bin/casey.mjs`：`sign` 分发从 notImplemented 改 `runNode(bin/sign.mjs)`（镜像 compile/draft）+ help 一行。
4. 共享测试 helper `tests/_golden/_sign-helper.mjs`（新建）：`signExpected(expected, {signer,build,at})`
   深盖签署字段——供涟漪金牌把 inline expected 转已签，减 churn。
5. 涟漪（D1 知情选择）：7 金牌 + 工具的 inline expected 全部经 signExpected 补签、各自 prd 重签重跑 GREEN——
   `p5-replay`/`layer3-wiring`/`chiefcomplaint-smoke`/`kinds-harden`/`replay-video`/`wf-history-version`/
   `wf-publish-states`/`scripts/sample-report.mjs`。

## 非目标

真人签身份核验 / 交互式签名（route:human）；verdict.mjs 判定树与入参零动（保 L0）；不产/不反推断言内容；
不改 gate.mjs 校验器、不冻 spec/events；不做真站真机 UAT。

## 验收

- 未签字非空契约 → replay 前置闸 exit 65 拒算数、零 axes；补签后 replay 正常产 axes。
- 人签后改一字符断言 → Test Ratchet（gate 校 testChecksums）报红。
- pending 非空拒签、`--force` 留痕不静默丢。
- 重签 bump signedAgainstBuild + 归档旧期望 + 不自动记缺陷 + anti-clobber。
- expectedVerdict 仅人给值、fail-safe 不变量强制、缺则不写不反推。
- 凭据兜底门 + caseId 一致/路径安全。
- 7 涟漪金牌补签后原样 GREEN + 各自 prd 重签 gate 复验；`p2-sign.golden.mjs` C1–C8 红先行后全绿；
  `selftest --tier1` 无回归；gate GREEN。
