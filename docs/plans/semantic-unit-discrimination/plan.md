# semantic-unit-discrimination · plan（light）

## 目标

给 `lib/entity-semantic-lock-v2.mjs` 既有判别纯函数加一层只读冻结命名空间导出，
让单元级攻击金牌在纯函数层 hermetic 证明判别逻辑正确——兑现 Steven 双轨裁决的
hermetic 轨（甲），真机轨（乙）由前瞻红基线保持红继续承担。

## 落地设计

### 1. 导出面（lib 侧，纯加法）

在 `lib/entity-semantic-lock-v2.mjs` 判别函数簇后追加：

```
export const ENTITY_DISCRIMINATION_UNIT_FACE = Object.freeze({
  parseCandidate, compareCandidate, identityKey, parseReceipt, parsePolicy,
});
```

- 只加这一个导出 const（+ 说明注释），不改任何既有函数体、不新增可铸权威入口。
- 引用的五个函数全部是既有的 `function` 声明（会 hoist），零逻辑改动。
- lib diff 应只有这几行导出与注释。

### 2. 单元金牌（tests/_golden/teachin-semantic-lock-unit-discrimination.zero-sut.golden.mjs）

纯 node、zero-SUT：无浏览器、无网络、无 fake/fixture SUT。直接从真实 lib import
`ENTITY_DISCRIMINATION_UNIT_FACE`，不做温拷贝、不建 handle、不碰运行时权威。

绿断言（纯函数层攻击，语义对齐前瞻基线）：

- parseCandidate：合法候选 → 冻结返回；畸形 `{physicalId:'broken'}` → null；名前导空格
  → null（无静默 trim）；缺 platformId（policy required）→ null；缺 revisionId（policy
  exact）→ null；name 取值 getter（accessor）→ null 且不触发 getter、不泄漏内文；多余键
  → null；非纯对象（数组）→ null。
- identityKey：同 physicalId 异 code → 键不等（冲突基元）；字节同 dup → 键相等（重复
  身份相等基元）；异 physicalId 同身份字段 → 键相等（identityKey 不含 physicalId）。
- compareCandidate：全等 → SAME/allowAction:true/candidateCount:1；kind/scope/parent/
  name/code 各错配 → 对应 CHANGED reason；platformId 错配 → PLATFORM_ID_MISMATCH；
  revision 错配 → ENTITY_REVISION_DRIFT（platformId/revisionId 值必比）。
- parseReceipt：合法收据（金牌内以既有 canonical 形状自算正确 hash）→ 冻结返回；
  篡改 name 保留旧 hash → null；篡改 hash 保留 body → null（外部锚：自行重算即拒）。

静态反滥用断言：

- (a) grep `bin/` 与 `mcp/` 下全部 `.mjs` 源码，零文件含字符串
  `ENTITY_DISCRIMINATION_UNIT_FACE`。
- (b) 前瞻红基线 `teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs`
  字节 sha256 恒等于写死值
  `4c707ff196472be21d166450d2252962ceb9b77efe83d10579090a29f6baf29a`（本契约零触碰证明）。

缺口台账（金牌内打印、非失败断言）：如实列出 AMBIGUOUS 原始计数分派 / MISSING 空候选
分派 / SCAN_INCOMPLETE 分派 / successor 有状态判别 —— 内联于
evaluate/successor，非纯函数、归前瞻红基线（真机轨）所有，本单元面不冒充覆盖。

### 3. prd 与冻结（loop/prd-semantic-unit-discrimination.json）

- testChecksums 初签冻结三项：新金牌当前红字节 + lib 当前字节（4b370340…）+ 前瞻基线
  字节（4c707ff1…）。
- story s1 = 单元判别攻击金牌 acceptance = `node …unit-discrimination.zero-sut.golden.mjs`。
- story s2 = 邻接回归 acceptance = v2 金牌 + v1 金牌 + nonvacuous-readiness 金牌。
- notes 记录纪律②：loop 期实现后原地重签 lib 与新金牌为绿态字节。

### 4. 红先行与实现

- 先写金牌验红（import ENTITY_DISCRIMINATION_UNIT_FACE 失败即红，exit 1），红输出存
  `docs/plans/semantic-unit-discrimination/red/`。
- accept --red-verified 之后才动 lib 加导出。
- 实现后金牌迭代到 exit 0。

### 5. 跨契约共享冻结处置

`loop/prd-semantic-lock-cert-closure.json` 冻结了 lib sha（4b370340…）。本契约加导出后
lib 字节变、其 gate 该项必 MISMATCH。此属跨契约共享冻结：把新 sha 报回主会话，由主
会话裁重签；本契约不改 cert-closure。

## 验收

1. 单元金牌 `node tests/_golden/teachin-semantic-lock-unit-discrimination.zero-sut.golden.mjs`
   exit 0，所有纯函数判别绿断言通过，静态反滥用 (a)(b) 通过。
2. lib diff 只含导出行与注释；`evaluateEntityAction` / `createRunSuccessorProof` /
   运行时铸造入口 函数体零改动。
3. 邻接绿零回归：v2 / v1 / nonvacuous-readiness / admission / presign / public / flow /
   package 金牌全 exit 0。
4. 前瞻红基线仍 exit 1 且 0/26（真机轨保持红）。
5. 纪律②原地重签本 prd 的 lib 与金牌 checksum 后，
   `node loop-kit/bin/gate.mjs --prd loop/prd-semantic-unit-discrimination.json` GREEN。
6. `node bin/casey.mjs selftest --tier1` GREEN。
7. cert-closure gate 因 lib 变而 MISMATCH 的新 sha 已如实报回主会话（不自行重签）。
