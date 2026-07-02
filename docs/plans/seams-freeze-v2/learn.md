# seams-freeze-v2 — learn（沉淀）

契约收口：grill/plan/accept/loop/review/learn 全绿。本契约把第 2 层借鉴接缝 v2 的四条数据接缝（`run-history`/`action-vocabulary`/`failure-ledger`/`channelDriver`）冻成 schema + 合成 fixture + golden 校验器。本文沉淀 loop + 异构评审（codex `gpt-5.5` 非同族、十二轮 R1–R12 至 PASS）暴露的教训。事实源：git f41e527/827cebc 及本轮收口提交、`loop/audit.jsonl` 的 seams-freeze-v2 记录、`docs/plans/seams-freeze-v2/proposed/GRILL.md`。

## 交付（live）

- 四条接缝 schema（`tests/_golden/schemas/`）：`run-history.schema.json`（回放历史/指标，绝不进裁判）、`action-vocabulary.schema.json`（7 动作治理投影）、`failure-ledger-entry.schema.json`（失败台账 + 指纹 + 人裁决回填）、`channel-driver.schema.json`（端口适配器能力声明）。
- 四份合成 fixture（`tests/_golden/fixtures/seams-v2/`），指纹为真算值（sha256 of canonicalJSON）。
- golden 校验器 `tests/_golden/seams-freeze-v2.golden.mjs`（13 组）：内置零依赖 draft-07 子集校验器 + 全量预扫 + 三个凭据扫描器（key/value/字段名）+ 四重跨文件 join + 聚合复算，各扫描器带自测金丝雀。
- 9 文件 checksum 冻入 `prd-seams-freeze-v2`，`CONTEXT.md` 登记 6 术语。

## 教训

1. **hard invariant 钉 schema 层，golden 抽查只是第二道。** 十二轮评审最反复的主题：不变量只活在 golden 时，真实 producer「只跑 schema」就绕过（坐标兜底、`NEEDS_HUMAN` 子类、证据背书全是这样被逐轮钉进 schema 的）。冻结接缝的第一落点是 schema 表达力内的机制化，golden 只兜 draft-07 表达不了的（跨字段相等、跨文件互链、聚合复算）。
2. **手写校验器自身必须 fail-closed，且「fail-closed」要全量兑现。** 声称 fail-closed 的 draft-07 子集校验器被连抓四轮：只扫 fixture 触达的分支（R5）、不查关键字值（R7）、把 null 子 schema 当 true（R8）、空组合数组真空放行（R9）。教训——校验器的懒惰路径就是冻结层的 fail-open 路径；与数据无关的全量预扫（结构 + 关键字值 + `$ref` 可解析）是底线。
3. **扫描器要给自己上锁（自测金丝雀）。** 凭据扫描器被逐轮放大射程（kv 起始形态→复合变体→冒号/引号形态→占位符携名→字段名字符串），每次扩完都补正负金丝雀——防的不是当下漏检，是将来被静默放宽。「扫描器被削弱」与「schema 被削弱」同级危险。
4. **证据语义必须镜像裁判背书语义，装饰性指针不是证据。** `SUT_DEFECT` 证据链四连环（R9→R11）：先钉「至少一个非 null 证据指针」，再钉「取证指针须归因本步 + 携失败信号」，再堵「断言证据打掩护、装饰性指针随行」的混合态，最后封空串空壳。冻结层的证据形状若弱于 `verdict.mjs` 的背书语义，台账就能记下裁判出不来的结论。
5. **修正采纳先于照单全收。** codex R9-F1 建议「`SUT_DEFECT` 必须带失败断言」违反 ADR-0002（可仅由 5xx/pageerror/crash 背书）——按领域规则改成「至少一个证据指针」采纳并在 audit 留案。异构评审的价值在指出洞，堵法必须过领域模型这一关。
6. **治理面表要锁唯一性与 join 全维度。** 重复登记（entries/driverId/actionSpace）被 Set/Map 静默塌掉、join 只查存在不查值（channel 一致、call 全等）——治理表冻结出自相矛盾的两处登记，下游按遍历序各信一边。draft-07 表达不了按 key 唯一，此类锁归 golden 并注明缘由。
7. **评审收敛形态：从接缝语义向工具边角收敛即近 PASS。** R5–R8 打接缝语义与校验器结构，R9–R11 集中在扫描器射程与证据语义细化，R12 无新实质缺口。发现的「语义重要度」单调下降是比条数更可靠的收敛信号。

## 挂账（route:human）

- 四接缝的 `lib`/`bin` 真产出与运行期 golden 随 P5/P6/P7 真机集成走（`casey run` 编排器是 `run-history` 天然生产者，见排期）。
- fingerprint 运行期 producer 复用 golden 同一 canonicalization（prd observability 已列）。
- fingerprint 聚类粒度与文案归一阈值（决策 3.3）、`channelDriver` 的 arbitrary/cef 真能力棘轮（决策 Q3）。
