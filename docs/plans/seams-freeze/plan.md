# seams-freeze — plan（第1层接缝冻结）

## 背景与边界

排期 v2 第1层「总钥匙」：把五条草拟接缝形式化成冻结 schema + 合成 fixture，解锁第2层 P4/P5/P6/P7 对 fixture 并行（机理同 P2 对合成三轴 fixture 跑 hermetic）。**只加 schema/fixture/golden + prd、不碰已冻内核 impl**（light 车道）。五条接缝已并行起草、扎根 design+regress+已冻 P2，并经用户冻前人审三决定定案（见 grill.md）。

## 冻结产物（canonical 路径）

- schema：`tests/_golden/schemas/{events,observed-reality,report-model,drift-patch,expected-frozen}.schema.json` + `loop/prd.schema.json`（升 v2、向后兼容）。
- fixture：`tests/_golden/fixtures/seams/{events,observed-reality,report-model,drift-patch,expected-frozen,prd-v2}.fixture.json`。
- golden 校验器：`tests/_golden/seams-freeze.golden.mjs`。

## 验收点

- [命令] `node tests/_golden/seams-freeze.golden.mjs` exit 0：每条 schema + fixture 解析为合法 JSON，且关键不变量全过——
  - events：交互动作禁纯坐标步（必带至少一个稳定定位字段）；
  - observed-reality：禁凭据/PII 字段（body/headers/cookie/token/authorization）；requestLog 条目与 verdict 的 network 同形；
  - drift-patch：`before.canonical===after.canonical`（纯漂移不变量）+ 人签字段齐；
  - expected-frozen：每条 frozenAssertion 带 signedAt/signedAgainstBuild/signerId；assertionKind 在词表内；expectedVerdict 终判 reason 必 null、NEEDS_HUMAN 必带子类；
  - prd-v2：fixture schemaVersion=2 带 caseId+expectedFrozenPath；现有 schemaVersion 1 的 prd（prd-p2-intent-compile.json）仍合法（向后兼容）。
- [命令] `node loop-kit/bin/gate.mjs --prd loop/prd-seams-freeze.json` = GREEN；testChecksums 冻结全部接缝文件。
- [命令] `node bin/casey.mjs selftest --tier1` 无回归。

## 红基线

golden 先写、canonical 接缝文件未落时跑 → 红（缺文件）；落齐 → 绿。如实 --red-verified。

## 完成判据

gate GREEN + 三新/改文件冻结 + selftest 无回归。下游第2层各轨对 `tests/_golden/fixtures/seams/*` 开发。
