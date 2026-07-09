---
name: casey
description: 用自然语言把测试用例跑成 Casey 测试报告，或启动示教录制。当用户说"跑一下历史版本用例""把这段用例测一遍""生成测试报告""我要手动录制"时使用。用户操作面必须只收自然语言；底层 CLI/MCP 参数由代理内部处理，绝不要求用户复制命令，绝不把桩当成已完成。
---

# casey — 自然语言 → 测试报告

本 skill 的用户操作面只接受自然语言。真正的活由 `bin/casey.mjs` 与 `loop-kit/bin/*` 干（在仓根执行），但命令、路径、参数是代理内部实现细节，不作为用户要手动复制的步骤输出。

## 用户怎么说

用户只需要这样说：

- “帮我跑刚刚那个历史版本用例，生成测试报告。”
- “跑一个 0 error 的真实用例给我看报告。”
- “我要手动录制一个新流程，名字叫采购审批冒烟。”
- “把这段用例在中台上测一遍，出 HTML 报告。”
- “打开最近一次报告给我看。”

代理职责：

1. 自行判断可用入口：已有签署用例走回放报告；新自然语言用例先走归一/编译/草拟/人签流程；手动操作走示教录制。
2. 自行检查环境：仓根、反向隧道、本地基址、凭据文件是否具备；缺失时用一句自然语言说明缺什么，不输出复杂命令清单。
3. 自行执行底层命令，最后只给用户报告链接、四态计数、是否 0 error、失败原因摘要。
4. 用户明确问“给我命令”时才展示命令；否则不要把 CLI 参数当成使用说明。

## 内部动作表（不要直接要求用户照抄）

| 自然语言意图 | 代理内部动作 |
|---|---|
| “跑刚刚那个历史版本用例/跑历史版本报告” | 跑 `tc_wf_history_version`，生成报告后用 `verify-zero-error-report` 校验，返回 HTML/MD/JSON 链接。 |
| “跑一个真实 0 error 用例” | 优先选择最近现场复跑已 0 error 的用例；当前已现场验证的是 `tc_wf_history_version`。不要把历史绿但今天复跑红的用例冒充 0 error。 |
| “手动录制/示教录制” | 启动 `casey record`，打开浏览器让用户操作；关闭浏览器后返回 `teach-in-capture.json` 路径，并说明它只是蒸馏语料、不是正式报告。 |
| “把这段文本用例跑成报告” | 若已有完整签署产物则直接跑；否则先产候选 TestCase/flow/expected 草稿并要求用户签署，不能代签。 |
| “把一段自由文本用例变成候选骨架 / 我要从头写个用例” | 代理内部跑 `scaffold-case` 把自由文本零 LLM 包成候选骨架（`source.kind:freetext` + `route:human` 占位，开箱过 `parseTestCase`），再按归一提示模板 `docs/plans/ingest-scaffold/proposed/from-text-candidate.draft.md` 把 `source.raw` 归一成真实意图步、经 `ingest` 入场；如实说明候选须 LLM 归一 + 人签才算数、不是正式报告，别盲写 JSON。 |
| “看最近报告” | 在 `runs/` 下找最新 `.report.html`，返回链接和四态摘要。 |

## 内核（不可让渡，违反即停）

- 确定性是默认，`LLM` 是手术刀：`LLM` 只在归一(相0)、编译(相1)、断言草拟(相2)、自愈(相5) 出现；回放(相3)、多态裁定(相4)、报告(相6) 是零 `LLM` 确定性。
- 裁判零 `LLM`：测试结论由 `casey verdict`（确定性 `verdict.mjs`）出。绝不用 `LLM` 判「过没过」，绝不把 `LLM` 的印象当裁定。
- **fail-safe 不 fail-open**：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN`，写 Inbox 等人裁。绝不默认成「可自愈」或自动记缺陷。
- **完成是退出码，不是声明**：报告里「通过/失败」必须来自真实回放 + `verdict.json`，别拿「文件存在」或桩命令（exit 3）当通过。

## 区分三类错误（用户的核心要求，别混淆）

测试失败时，先分清是哪一类——这是 `verdict.mjs` 的判定树（设计 §4.2），不是凭感觉：

| 裁定 | 含义 | 谁的错 |
|---|---|---|
| `SUT_DEFECT` 被测缺陷 | 动作做对了、断言硬失败、且有取证背书（5xx/pageerror/crash/错误信封） | **被测系统**（真 bug，出缺陷单给研发） |
| `HARNESS_ERROR` 过程错误 | 正向确证的工装定位漂移（locator 不再命中，但同签名唯一元素仍在） | **测试工装**（步骤/录制层，可自愈） |
| `CASE_DEFECT` 用例缺陷（`NEEDS_HUMAN` 子类） | 编译期入口可证缺席或期望自相矛盾 | **测试用例本身**（修用例） |
| `AMBIGUOUS_ACTION`/`INDETERMINATE` 等 | 点没点对存疑 / 纯未知 | **机器不敢判，路由人** |

「测试用例的错误」≈ `CASE_DEFECT`；「测试步骤/工装的错误」≈ `HARNESS_ERROR`；「被测系统的错误」= `SUT_DEFECT`。三者落点不同，绝不能都报成「失败」了事。

## 底层命令映射（仅供代理内部执行）

| 用户意图 | 执行 |
|---|---|
| 相3-4-6 编排（回放→裁定→报告） | `node bin/casey.mjs run <caseId> --sut <url> --events <f> --expected <f> --profile <f> [--run-dir <d> --login-bootstrap --no-video]`（相0-2 前段须先各自跑完备好 events 与已签 expected） |
| 相0 前段脚手架（自由文本 → 候选骨架） | `node bin/casey.mjs scaffold-case <caseId> --from-text <text-file> --out-dir <d>`（零 LLM 产候选骨架，开箱过 `parseTestCase`；再按归一提示模板 `docs/plans/ingest-scaffold/proposed/from-text-candidate.draft.md` 把 `source.raw` 归一成真实意图步 → `ingest` 入场；候选非权威，须归一 + 重走全链 + 人签，门拒 fail-closed） |
| 相0 归一（候选须先由 LLM 在 CLI 外产出） | `node bin/casey.mjs ingest <caseId> --in <candidate.json> --out-dir <d>` |
| 相1 flow 桥（mapping 由 LLM 在 CLI 外产出） | `node bin/casey.mjs flow-bridge <caseId> --testcase <f> --mapping <f> --out-dir <d>` |
| 相1 编译（三段式：闸→人 confirm→执行） | `node bin/casey.mjs compile <caseId> --testcase <f> --flow <f> --out-dir <d>`；执行段加 `--execute --sut <url> --profile <f>`（须 flow 已 confirm，否则 exit 66） |
| 相2 草拟断言 | `node bin/casey.mjs draft <caseId> --observed <f> --compile-report <f> --out-dir <d> [--patch <f>]` |
| 相2 人签冻结断言 | `node bin/casey.mjs sign <caseId> --draft <f> --prd <f> --frozen-out <f> --signer <id> --against-build <id>`（**让用户签**，CC 不代签） |
| 相3 确定性回放 | `node bin/casey.mjs replay --events <f> --sut <url> --expected <f> --profile <f> --out <axes.json>`（未签契约拒回放） |
| 相4 出多态裁定 | `node bin/casey.mjs verdict --axes <f> --out <f>` |
| 相5 自愈（仅工装漂移） | `node bin/casey.mjs heal <caseId>`（诚实桩 exit 3，相5 只有 lib 件） |
| 相6 出报告 | `node bin/casey.mjs report --model <f> --out <d> [--run-history <f> --run-metrics <f>]` |
| 链路自检 | `node bin/casey.mjs selftest --tier1` |
| loop 纪律 | `node bin/casey.mjs lint\|gate\|breaker\|contract ...` |

执行后回给用户的标准格式：

- 报告：`<html 链接>`，必要时附 `<md/json 链接>`。
- 结论：`PASS=n / SUT_DEFECT=n / HARNESS_ERROR=n / NEEDS_HUMAN=n`。
- 0 error：只有 `SUT_DEFECT=0`、`HARNESS_ERROR=0`、`NEEDS_HUMAN=0` 且每步都是 `PASS` 才能说 0 error。
- 失败时只解释一层原因：被测缺陷、工装问题、用例问题或机器不敢判；不要用 LLM 自己裁定过没过。

> 当前进度：七相全建且 hermetic「文本→报告」全链已由集成金牌贯通（`tests/_golden/e2e-chain.golden.mjs`）；`heal` 是唯一诚实桩（exit 3，相5 未吃过真场景）。真机端到端仍需一次真机 compile bring-up + 人签在场（route:human）。桩返回 exit 3 时**如实告诉用户该阶段未实现**，绝不假装跑完了；全部生命周期命令用法错统一 exit 64（`report` 历史例外 2 已由 report-exit64 契约收敛）。

## 报告里有什么（设计 §6）

操作说明 + 标注（`LLM` 接口/生命周期取证/网络取证）+ 回放录屏(mp4) + 文本/抓取输出（含 `LLM` 的回答原文 + 截图）+ 每步裁定徽章 + 缺陷单（仅 `SUT_DEFECT`）+ trace + 截图。机读产物 `verdict.json` 是 golden 唯一校验对象。

## 执行边界（重要）

- **凭据让用户设**：`.auth/`、`site.json` 是凭据，CC 不把账号密码写进命令行/文件/报告。
- **冻结断言只读**：人签后改断言 = Test Ratchet 判红，别去改。
- 改实现先 `contract`：动 `lib`/`bin` 前先 `node loop-kit/bin/contract.mjs init <slug> --lane <...> --reason "..."`，否则 hook 拦截。
- **真机变更有副作用**：编辑型用例（新建/发布/删除）回放=真实改环境数据，实体必带 Reserved Prefix `atl_`。
