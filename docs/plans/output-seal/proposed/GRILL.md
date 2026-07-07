# output-seal — grill 决策记录（全仓输出通道封缝，full）

> 授权链：caseid-echo-mask 契约挂账「全仓输出通道系统审计另立契约」（learn.md:15 +
> prd-caseid-echo-mask observability）；审计清单 = proposed/AUDIT.md（2026-07-07 只读扫描，
> 约 200 处全筛、A/B/C/D 四类分拣）；Steven 点选「High+Med 全封」（2026-07-07）。

## D1 封缝范围

- 分岔：High 5 vs High+Med 全封 vs 含 Low。
- 定夺：Steven 点选 High+Med 全封（A1–A13 + B1–B8 + C 类点名一处 + 特别复核第 3 项 inbox 面）；
  Low 类（A14–A19、B 类 Low 列）逐处判过不动——预扫垫底/值域受限/门后产物，动了是过度工程。

## D2 修法模板（二选一按类，均有先例）

- 回显类（A 族）：镜像 `bin/ingest.mjs:29` 遮值句式——报「什么不对」不报「值是什么」，可回显的只有
  已过 `^[A-Za-z0-9_-]+$` 闸的命令行侧值与固定文案；定位信息用 intentId/序号等结构化短标识。
- 异常透传类（B 族）：照 `lib/login-bootstrap.mjs:60-64` 消毒重抛——`JSON.parse` 失败只报
  「不是合法 JSON/不可读（内容不回显）」；`e.stack` 剥栈只留首行且截断；登录期只留 `e.name` + 固定文案。
- 落盘不过门类（inbox/candidates）：写入前过 `credentialGate`，命中拒写非零退出（与七落盘口同律）。
- report 链 caseId（A12）：`bin/report.mjs` 入口补 `^[A-Za-z0-9_-]+$` 字符集闸（exit 65 原值不回显）——
  这是穿越面（值进文件名/路径构造）不只是回显面，五 CLI 同款闸的缺席补齐。

## D3 不做 sign/draft 全文输入预扫

- 证据：`FORBIDDEN_KEYWORDS` 含 `token`/`cookie` 等英文词——断言值/夹具正文含这些词是正常语料
  （AUDIT 总账论证），全文预扫会把合法输入误伤成拒签。ingest/flow-bridge 预扫扫的是「候选原文」
  语义不同（那是外来文本首次进门）。
- 定夺：不加预扫；封缝走遮值/消毒（输出侧收口，不动输入侧语义）。

## D4 验收形态

- 新哨兵金牌 `tests/_golden/output-seal.golden.mjs`：逐封口喂含种子标记（如 `SEEDVAL_...`）的坏输入，
  断 stderr/stdout/落盘不含种子值 + 退出码不变 + 报错仍点名「什么不对」（可诊断性不降级）。
  红先行：现状种子值上 stderr 实锤。
- 涟漪：既有金牌只钉退出码与非回显哨兵不钉文案（AUDIT 实证 p2-sign:179 / draft-cli:88 /
  caseid-echo-mask / chiefcomplaint:230）——零重冻预期；若个别金牌钉了受改文案，按例翻纪律随改重签。

## D5 裁判内核触碰声明

- `bin/verdict.mjs:110`（B8）一行输入消毒：axes 读失败的 `e.message` 换固定文案——只动输入错误报文，
  零动裁定逻辑/四态语义/退出码。full 车道 + 金牌 verdict 面回归（verdict-purity-guard + p6 系）背书。

## D6 非目标

Low 类清单不动；term-guard 乙接线（卡密钥另案）；`loop-kit/bin/gate.mjs` 输出面（loop-kit 契约域）；
`verdict.json` 落盘过门改造（内容全为派生枚举，记档不动）；sign/draft 输入预扫（D3 否决）。
