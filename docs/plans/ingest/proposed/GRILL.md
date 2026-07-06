# ingest — grill 决策记录（相0 归一，full）

> 状态：**已签核**（Steven，2026-07-06）。三承重项全取缺席推定默认；机械项默认追认。缺席推定默认全部**可否决**；承重项标【承重·待签】，机械项标【机械·镜像先例】。
> 依据：`docs/design/txt2testreport-design.md` §1/§2/§3、`CONTEXT.md`（`TestCase`/归一/`intentId`）、下游 seam `lib/flow-bridge.mjs`、
> 姊妹 CLI 先例 `bin/flow-bridge.mjs`/`bin/draft.mjs`/`bin/sign.mjs`。

## 背景

相0 归一是流水线唯一未建的相：杂乱 excel/json/txt/自由文本 → 规范内部 `TestCase`（design §2 聚合根）。
design §1 定分工：「LLM（提案）→ 输出由确定性 `parseTestCase` 校验；不合规 `fail-closed`」。`TestCase` 建成即直喂
相1 `flow-bridge`（其 `--testcase` 输入），打通 hermetic「文本→spec→报告」全链前半。三件套：`lib/parse-testcase.mjs`
（纯函数解析+校验）+ `tests/_golden/schemas/testcase.schema.json`（冻结形态契约）+ `bin/ingest.mjs`（薄 CLI）+ `bin/casey.mjs` 接线。

## D1 相0 归一分工：LLM 提案在 CLI 外，`parseTestCase` 是 L0 确定性校验器【机械·镜像先例】

- 缺席推定：**镜像 `flow-bridge`/`draft` 范式**——LLM 在 CLI 外把杂乱原文归一成候选 `TestCase`（JSON），`bin/ingest.mjs`
  进程零 LLM、零真机，只做「读候选 → `parseTestCase` 确定性校验 → 落规范 `TestCase`」。同 ADR-0003「LLM 只编译期读、
  CLI 进程零 LLM」、同 `flow-bridge` 的 `mapping` / `draft` 的 `--patch` 均 CLI 外产。
- 理由：不新开 LLM 进程口；确定性内核（护栏 #15 精神）不塌进 LLM；测时用内联候选夹具、不烧真 LLM。
- 否决面：若要 CLI 内直调 LLM 归一自由文本——不建议（违范式、golden 无法确定性、增凭据/网络面）。

## D2 CLI 形态 + 数据流 round-trip【机械·镜像先例】

- 缺席推定：`node bin/ingest.mjs <caseId> --in <candidate.json> --out-dir <d>`（`casey ingest` 接线）。
  产物 `testcase-<caseId>.json` = 相1 `flow-bridge --testcase` 的输入。
- round-trip（golden 可证的 hermetic 链，无真机）：`candidate.json` ─ingest→ `testcase-<caseId>.json`
  ─(内联 mapping 夹具)→ `flow-bridge` → `flow-<caseId>.json` ─→ `compile --flow` gate 段 exit 0。
- 理由：命令签名逐字镜像 `flow-bridge`（`<caseId> --in/--testcase --out-dir`）；产物名镜像 `flow-<caseId>.json`/`expected.draft-<caseId>.json` 惯例。

## D3 schema 冻结形态契约：`testcase.schema.json` 的 required 字段集【承重·待签】

- 缺席推定（冻进 schema、棘轮护栏 #1，日后改需走契约）：
  - **必填**：`schemaVersion`（const 1）、`caseId`（`^[A-Za-z0-9_-]+$`）、`source.kind`（enum `excel|json|txt|freetext`）、
    `steps`（`minItems:1`，每步 `intentId` 非空字符串）、`uniquePrefix`（**非空字符串**——`flow-bridge`/`compile-gate`
    破坏性前缀硬闸拒空 `''`，空前缀会让 `startsWith('')` 恒真把破坏性闸静默清零，design §2 铁律）。
  - **可选**：`title`、`source.raw`/`source.ingestedAt`、`target`（`startUrl`/`auth`/`channel`）、`preconditions`（string[]）、
    `globalAssertions`、`boundContract`、以及各 `steps[]` 的 `intent`/`actionHint`（enum `click|fill|select|send|navigate|assert`）/
    `inputValue`/`uniqueGuard`/`expected`（数组，元素 `{kind:string, op?, value?}`——**形态校验，不校验 kind 是否已实现**：
    kind 词表归相2 `check.mjs`/`draft`，相0 只保结构，免把相0 耦合进断言实现集）。
- 承重点：这份 required 集是冻结棘轮，定「一个可编译的最小 `TestCase` 到底缺哪个就拒」。三项硬理由已锁死
  （`caseId`/`steps`/`uniquePrefix` 都是下游 seam 硬依赖）；`source`、`target`、`preconditions` 是否进 required 请 Steven 拍。
  倾向：只把「下游确定性依赖」列 required（上三项），`target`/`preconditions` 留 optional（真机 bring-up 才需 `target`；`preconditions` 缺省 `[]`）。

## D4 `parseTestCase` 语义校验（schema 之上，JSON Schema 表达不了的）【机械·镜像先例】

- 缺席推定：`parseTestCase(candidate, { caseId })` 纯函数返回 `{ ok, testcase, problems }`，在 schema 形态校验之上补：
  1. **`intentId` 全局唯一**（JSON Schema 跨元素唯一表达不了）——镜像 `flow-bridge.validateBridge` 的 `seenIntent` 闸，
     重复会让相1 投影忠实退化；
  2. **`caseId===命令行 caseId`**（镜像 `flow-bridge`/`draft` 一致闸，防产物名与内容错配）；
  3. **`uniquePrefix` 非空**（与 schema 双保）。
  全部 fail-closed 汇总 problems、逐条回显（但敏感值前置门已拦、见 D6）。
- 理由：`parseTestCase` 是 design §1 点名的确定性校验器；语义闸镜像已建姊妹件、不另造判据。

## D5 坏输入 fail-closed 契约码【机械·镜像先例】

- 缺席推定（逐字镜像 `flow-bridge`/`draft`/`sign`）：`0` 成功；`64` 缺参（缺 `caseId`/`--in`/`--out-dir`）；
  `65` 输入坏·闸拒（读/`JSON.parse` 失败、`caseId` 非法字符、schema 或语义闸拒）；`1` 凭据兜底门拦截。
  任一闸拒**零落盘**（半份 `TestCase` 比没有更危险）、通过后才 `mkdir`（拒时零目录副作用，同 `flow-bridge` codex R1-F4）。
- 理由：全项目退出码语义已固化，新 CLI 不另立新码。

## D6 凭据门扫输入原文 + `source.raw` 处置【承重·待签】

- 缺席推定：
  1. **cred-gate 前置扫输入原文**（早于 `JSON.parse`、早于任何闸拒逐条回显、早于 `mkdir`/落盘）——命中即
     `exit 1` 零落盘，逐字镜像 `flow-bridge` 的 `credentialGate({[path]:text})` 前置门。自由文本原文最可能贴凭据，
     故相0 是凭据入口第一道闸（NEXT-SESSION 明列「凭据门须扫输入原文」）。
  2. 输出侧再过一道 cred-gate（防御纵深，同 `flow-bridge`）。
  3. **`source.raw` 处置**：缺省**保留原文进产物**（design §2 溯源），因前置门已保证「含凭据的原文根本进不来」
     （命中即整份拒收 `exit 1`）——存下来的必是干净原文。
- 承重点：`source.raw` 存不存是溯源 vs 产物极简/凭据面收窄的取舍。两案：
  - A（缺省）：**存 raw**——溯源全（报告可回指原文），前置门兜底凭据；
  - B：**丢 raw 只留 `source.kind`+`ingestedAt`**——凭据面按构造归零、产物瘦，但丢原文溯源。
  倾向 A（前置门已是硬保证，且报告溯源有价值）；请 Steven 拍。

## D7 本契约范围 + 非目标【承重·待签（范围）】

- 缺席推定（**范围**）：本契约只建「候选 `TestCase`（结构化 JSON）→ `parseTestCase` 校验 → 规范 `TestCase`」。
  杂乱原文（excel 列/csv/自由文本）→ 结构化候选，一律 **LLM 在 CLI 外归一**（同 D1）；
  **内建确定性格式解析器（excel 列映射等）不在本契约**（后续加法，且真机无关不阻断 hermetic 全链）。
- 承重点：是否本契约就要内建一个确定性 excel/csv 列解析器？倾向否（scope 收敛、mirror `flow-bridge` 只当校验器、
  格式解析可后续按真实用例形态增量建）；请 Steven 拍。
- 非目标：不碰真机 / tier2 route:human；不建/改 `flow-bridge`/`sign`/`compile`（已建）；不烧真 LLM；
  不改冻结的 `verdict.mjs`/`gate.mjs`/断言冻结内核；不扩断言词表（相2 事）；不校验 `expected[].kind` 是否已实现（相2 事）。

## hermetic 可建性

纯确定性、无浏览器、无真机。golden：内联候选夹具（good/坏五形态：缺 `caseId`/空 `uniquePrefix`/`intentId` 重复/
非法 `caseId` 字符/凭据命中）逐条红先行；round-trip 一条（candidate ─ingest→ testcase ─flow-bridge→ flow ─compile gate→ exit 0）证相0→相1 seam 贯通。真机侧不涉。

## Steven 签核清单（已签，2026-07-06）

- [x] D3 schema required 字段集 → **`source.kind` 也 required；`target`/`preconditions` optional**（三硬项 `caseId`/`steps`/`uniquePrefix` + `source.kind`）。
- [x] D6 `source.raw` 存 or 丢 → **存 raw**（溯源，前置 cred-gate 门兜底）。
- [x] D7 本契约是否内建确定性 excel/csv 列解析器 → **否**：只当结构化候选的确定性校验器，格式解析归 LLM CLI 外归一 + 后续加法。
- [x] D1/D2/D4/D5 机械镜像先例 → 无异议，默认追认。
