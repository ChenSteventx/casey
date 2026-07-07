---
name: casey
description: 把一段文本测试用例（excel/json/txt/自由文本）在给定平台上跑成测试报告。当用户说"跑这个测试用例""把这份用例在中台上测一遍""生成测试报告（带录屏/断言/裁定/页面输出）""txt2testreport"时使用。底层是本仓 bin/casey.mjs 的 CLI；本 skill 是薄壳，只把意图映射到 casey 命令，绝不在此做裁定或把桩当成已完成。
---

# casey — 文本用例 → 测试报告

本仓 CLI 的薄壳。真正的活由 `bin/casey.mjs` 与 `loop-kit/bin/*` 干（在仓根执行），本 skill 只把用户的自然语言意图映射到正确命令并执行。

## 内核（不可让渡，违反即停）

- **确定性是默认，LLM 是手术刀**：LLM 只在归一(相0)、编译(相1)、断言草拟(相2)、自愈(相5) 出现；回放(相3)、多态裁定(相4)、报告(相6) 是零 LLM 确定性。
- **裁判零 LLM**：测试结论由 `casey verdict`（确定性 `verdict.mjs`）出。**绝不**用 LLM 判「过没过」，绝不把 LLM 的印象当裁定。
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

## 命令映射（在 casey 目录下执行）

| 用户意图 | 执行 |
|---|---|
| 相3-4-6 编排（回放→裁定→报告） | `node bin/casey.mjs run <caseId> --sut <url> --events <f> --expected <f> --profile <f> [--run-dir <d> --login-bootstrap --no-video]`（相0-2 前段须先各自跑完备好 events 与已签 expected） |
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

> 当前进度：七相全建且 hermetic「文本→报告」全链已由集成金牌贯通（`tests/_golden/e2e-chain.golden.mjs`）；`heal` 是唯一诚实桩（exit 3，相5 未吃过真场景）。真机端到端仍需一次真机 compile bring-up + 人签在场（route:human）。桩返回 exit 3 时**如实告诉用户该阶段未实现**，绝不假装跑完了；全部生命周期命令用法错统一 exit 64（`report` 历史例外 2 已由 report-exit64 契约收敛）。

## 报告里有什么（设计 §6）

操作说明 + 标注（LLM 接口/生命周期取证/网络取证）+ 回放录屏(mp4) + 文本/抓取输出（**含 LLM 的回答原文 + 截图**）+ 每步裁定徽章 + 缺陷单（仅 `SUT_DEFECT`）+ trace + 截图。机读产物 `verdict.json` 是 golden 唯一校验对象。

## 执行边界（重要）

- **凭据让用户设**：`.auth/`、`site.json` 是凭据，CC 不把账号密码写进命令行/文件/报告。
- **冻结断言只读**：人签后改断言 = Test Ratchet 判红，别去改。
- **改实现先 contract**：动 `lib`/`bin` 前先 `node loop-kit/bin/contract.mjs init <slug> --lane <...> --reason "..."`，否则 hook 拦截。
- **真机变更有副作用**：编辑型用例（新建/发布/删除）回放=真实改环境数据，实体必带 Reserved Prefix `atl_`。
