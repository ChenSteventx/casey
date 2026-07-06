# plan-debt-sweep — 计划欠账小清洗四件（full）

## 背景

审计对照排期/设计逐锚点复核出的四件真欠账（其一 Steven 早有决议未接线）。决策见 `proposed/GRILL.md`。

## 改动

1. `bin/compile.mjs` 执行段：投影前从 `document.scripts` 提取 `?v=` 填 `capturedAgainstBuild`
   （取不到/异常照旧 null）；`tests/fixtures/fake-sut/server.mjs` 加法场景 `versioned`（prd-p5-replay
   夹具 checksum 重签 + gate 复验）。
2. `bin/sign.mjs`：schema 严校后全断言字符串值过易变字面量两正则（镜像 validateDraft），命中 65 零落盘。
3. `CONTEXT.md` 三词条修（verdict.json 最小五字段 / trace 未建挂账 / recorder-as-library 已被取代）。
4. 两设计文档头部加「与实现的已知偏离（对账表）」节。
5. `tests/_golden/plan-debt-sweep.golden.mjs`（红先行）+ `loop/prd-plan-debt-sweep.json`。

## 非目标

见 GRILL D5。

## 验收（红金牌）

- C1 提取双向：compile --execute 打 fake-sut `versioned` → observed.capturedAgainstBuild==='9.9.9-test'；
  打 happy → null（fail-safe 不变）。
- C2 冻结期 lint：draft 含未模板化 `atl_` 字面量 → sign exit 65 零落盘；含 9+ 位数字长串 → 65；
  干净草稿照签（含 `atl_{{uniqueName}}` 模板形态合法）。
- C3 CONTEXT 词条：`term-lint --registry` exit 0；`verdict.json` 词条零「passes」字样、含「report-model」
  指针；`trace` 词条含「未建」；recorder 词条含「取代」。
- C4 勘误表：两设计文档含「已知偏离」节锚。
- 涟漪：p5-replay 双金牌 + p3-compile + p2-sign + tier1 复跑零行为差；prd-p5-replay 夹具重签 gate 复验。
