# ingest — 相0 归一（full）

## 背景

流水线唯一未建的相：杂乱输入（excel/json/txt/自由文本）→ 规范内部 `TestCase`（design §2 聚合根）。
LLM 在 CLI 外把杂乱原文归一成候选 JSON，`parseTestCase` 是 L0 确定性校验器（design §1：「输出由确定性
parseTestCase 校验；不合规 fail-closed」）。产物直喂相1 `flow-bridge --testcase`，建成即打通 hermetic
「文本→spec→报告」全链前半。决策全表见 `proposed/GRILL.md`（D1–D7 已签，2026-07-06）。

## 改动

1. `tests/_golden/schemas/testcase.schema.json`（新建，冻结形态契约，随 prd-ingest testChecksums 冻结）：
   - house 惯例：draft-07、`$id` `casey/testcase.json`、对象节点一律 `additionalProperties:false`、
     `definitions` + `#/definitions/x`、关键字限 seams-freeze-v2 校验器允许集（format 仅 date-time）、
     中文 title/description 引 design/护栏、属性名不含凭据形关键词。
   - 必填（D3 已签）：`schemaVersion`（const 1）、`caseId`（pattern `^[A-Za-z0-9_-]+$`）、
     `source`（其内 `kind` 必填，enum `excel|json|txt|freetext`）、`steps`（minItems 1，每步 `intentId`
     非空含非空白）、`uniquePrefix`（pattern `^\S+$`——**封「纯空白过 compile `.length` 闸」缝**，
     compile:61 只查 length、破坏性闸只在有破坏性原子时才兜）。
   - 可选：`title`、`source.raw`（D6 已签：存原文，前置凭据门兜底）、`source.ingestedAt`（date-time）、
     `target`（`startUrl`/`auth`/`channel` enum `web|cef|arbitrary`）、`preconditions`（string 数组——
     **schema 是唯一守点**：下游 compile-gate:69 对非数组静默吞成空种子、非 string 元素静默丢）、
     `globalAssertions`、`boundContract`、步级 `intent`/`actionHint`（enum
     `click|fill|select|send|navigate|assert`）/`inputValue`/`uniqueGuard`/`expected`/`route`/`reason`。
   - 断言元素（D3 已签，形态校验不校验词表——kind 词表归相2 `check.mjs`）：`{kind:非空 string, op?:string,
     value?:string|number|boolean}`。
   - 条件闸：`route` enum 只收 `human`（typo 如 `humann` fail-closed，不静默当普通步）；
     `route:human` ⟹ `reason` 必填含非空白（if/then，镜像 flow-bridge:61）。
   - 已知接缝张力（不在本契约动）：events.schema 的 caseId pattern `^tc_[a-z0-9_]+$` 严于本 schema 的
     `^[A-Za-z0-9_-]+$`（与 CLI 闸一致、D3 已签）；大写/横线 caseId 过相0 但真机 compile 落 events 后
     形态与 events.schema 不合——挂账观察，运行期无校验故无行为差。
2. `lib/parse-testcase.mjs`（新建，纯函数、零 LLM 零真机、零运行期 schema 加载——house 模式是手写
   `{ok, problems}` 字段闸，schema 当 golden 真值源防漂移，全仓无 ajv）：
   - `parseTestCase(candidate, { caseId })` → `{ok, testcase, problems}`：与 schema 逐条同刻的手写校验
     （必填集/类型/pattern/enum/条件闸/未知键拒——`additionalProperties:false` 语义），加 JSON Schema
     表达不了的语义闸：`steps[].intentId` 全局唯一（镜像 flow-bridge seenIntent，防相1 投影忠实退化）+
     `candidate.caseId === caseId`（一致闸）。全 problems 汇总逐条中文回显、结构坏时短路防 TypeError
     （镜像 flow-bridge codex R2 教训）。不变异输入；`ok:false` 时 `testcase:null`。
3. `bin/ingest.mjs`（新建，薄 CLI，镜像 `bin/flow-bridge.mjs`）：
   `casey ingest <caseId> --in <candidate.json> --out-dir <d>`。闸序（每道 fail-closed）：
   缺参 exit 64 → caseId pattern `^[A-Za-z0-9_-]+$` exit 65 → 读文件 exit 65 →
   **cred-gate 前置扫输入原文 exit 1**（早于 `JSON.parse`、早于闸拒逐条回显、早于任何 mkdir——自由文本
   最可能贴凭据，相0 是凭据入口第一道闸）→ `JSON.parse` 失败 exit 65 → `parseTestCase` 拒 exit 65
   逐条回显零落盘 → `source.ingestedAt` 缺席则落章（在场保留，golden 可字节确定）→ 输出侧 cred-gate
   exit 1（防御纵深）→ 全过才 mkdir + 落 `testcase-<caseId>.json`（半份比没有更危险）→ exit 0。
4. `bin/casey.mjs` 接线：`:226` 的 `case 'ingest'` notImplemented 桩换 `runNode` 一行式（同 flow-bridge
   `:230` 先例）；help `:183` 更新为真实旗标、去 `[P2]` 尾标（draft 先例）；顺手补 help 缺席的
   flow-bridge 一行（零行为差，纯 help 文案）。
5. `tests/_golden/ingest.golden.mjs`（新建，红先行）+ 夹具内联（同 flow-bridge golden 先例，无外置
   fixture 目录）；`loop/prd-ingest.json` 冻 golden + schema 两文件 checksum。

## 非目标

不碰真机 / tier2 route:human；进程内不烧 LLM（归一杂乱原文归 CLI 外 LLM，同 mapping/patch 先例）；
不内建 excel/csv 列解析器（D7 已签，后续加法）；不改 flow-bridge/compile/draft/sign/replay 本体；
不动 verdict/gate 冻结内核；不扩断言词表、不校验 `expected[].kind` 是否已实现（相2 事）；
不把 ingest 接进 `casey run` 编排器（run 现起于相3，相0-2 前段接线属后续契约）。

## 验收（红金牌，实现前 lib/bin 缺席全红）

- C1 件在册：`lib/parse-testcase.mjs` 导出 `parseTestCase`；schema 文件在、可解析、draft-07、
  `$id` `casey/testcase.json`。
- C2 happy：good 候选 → exit 0 落 `testcase-<caseId>.json`，字段全保、缺席 `ingestedAt` 被落章、
  在场 `ingestedAt` 原样保留。
- C3【载荷核心 round-trip 相0→相1→相1.5】：ingest 产物 → `casey flow-bridge`（内联 mock mapping）
  exit 0 产 flow → `casey compile --flow` gate 段 exit 0——三段贯通证 seam 无缝。
- C4【真值源防漂移】：从 schema 文件逐条读必填集，每缺一个必填字段构造一份坏候选 → `parseTestCase`
  必拒（锁 lib 手写闸与 schema 文件永同刻，姿势A 不抄副本）；`source.kind` enum 从 schema 读出逐个
  枚举外值拒。
- C5 语义闸：`intentId` 重复拒；缺/空/纯空白 `intentId` 拒。
- C6 caseId 三向：CLI caseId 非法字符 exit 65；候选 `caseId ≠ CLI` 拒；候选 caseId pattern 违例拒。
- C7 uniquePrefix：空串拒、纯空白 `'  '` 拒（封 compile `.length` 缝）。
- C8 preconditions：非数组拒、元素非 string 拒（唯一守点，下游静默吞）。
- C9 route:human：缺 reason 拒；带 reason 过且产物原样保留（相1 靠它走跳过通道）；`route` 枚举外值
  （如 `humann`）拒。
- C10 未知键拒：顶层/step 级/source 级未知键各拒（additionalProperties:false 语义）。
- C11 凭据门：候选原文含凭据关键词 → exit 1、零落盘、全新 out-dir 不被创建（零目录副作用）。
- C12 半份安全：任一闸拒 → out-dir 无 `testcase-*.json` 残留。
- C13 契约码：坏 JSON exit 65（非未捕获 exit 1）；缺参 exit 64。
- C14 `schemaVersion ≠ 1` 拒；`expected[]` 元素坏形态（缺 kind / value 非法类型）拒、未知 kind **不**拒
  （词表归相2）。
- C15 schema 自守：schema 每个对象节点 `additionalProperties:false`；properties 键名不含
  `FORBIDDEN_KEYWORDS`（从 `lib/cred-gate.mjs` import 比对，护栏 #7 key 侧）；关键字全在
  seams-freeze-v2 允许集内。
- C16 casey 接线：`casey ingest` 分发真跑（非 exit 3 桩）；help 含 ingest 真实旗标行。
- gate GREEN；`selftest --tier1` 无回归；涟漪：`bin/casey.mjs` 被改 → 经 casey 子进程的金牌复跑零行为差
  （flow-bridge / chiefcomplaint-smoke / wf-publish-states / wf-history-version，同 prd-flow-bridge s2 先例）。
