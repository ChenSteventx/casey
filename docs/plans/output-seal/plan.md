# output-seal — 全仓输出通道封缝（full）

## 背景

caseid-echo-mask 挂账兑现：凭据门只扫落盘产物、stderr/CLI 回显在扫描面外——审计（proposed/AUDIT.md）
全筛约 200 处，分拣出 High 5 + Med 13 真裸口。修法两模板（ingest 遮值 / login-bootstrap 消毒重抛），
决策见 proposed/GRILL.md D1–D6（Steven 点选 High+Med 全封）。

## 改动（按文件聚簇）

1. `bin/sign.mjs`：A1/A2（:116/:117 冻结期 lint 遮值，报命中类型 + intentId 不报值）；A4/A5（:102/:125
   caseId 遮值镜像句式）；A11（:139-141 verdict-baseline 键名 `SAFE_ID` 白名单，非法只报序号）；
   B1（:37 readJson 消毒重抛）；A17 顺手（:161-162 越界键名遮值）。
2. `bin/draft.mjs`：A6/A7（:48/:49 caseId 遮值）；B2（:30 readJson 消毒）。
3. `lib/assertion-draft.mjs`：A3（:126-127 两条 problems 去 `：${a.value}` 尾巴，报类型 + intentId）。
4. `bin/compile.mjs`：A8/A9（:60/:102 caseId 遮值）；B3（:46 消毒）；B7（:168 剥栈留首行、:295 剥栈 + 截断）。
5. `lib/compile-gate.mjs`：A13（:108 实体名值遮值「未带前缀（原值不回显）」）。
6. `bin/replay.mjs`：A10（:175 caseId 遮值）；B5（:199,274,307,329 登录期只留 `e.name` + 固定文案）；
   B6（:709 剥栈留首行 + 截断）。
7. `bin/report.mjs`：A12（入口 `model.caseId` 补 `^[A-Za-z0-9_-]+$` 闸 exit 65 原值不回显——穿越面）。
8. `bin/report-model.mjs`：B4（:99 大 catch 消毒：`JSON.parse` 面固定文案 + fs 面 `e.code`）。
9. `bin/verdict.mjs`：B8（:110 一行消毒，GRILL D5 声明）。
10. `bin/term-judge.mjs`：inbox 写入（:68）前过 `credentialGate`；`bin/term-guard.mjs`：:215
    `--emit-candidates` 落盘同律过门。
11. `bin/ingest.mjs:36` / `bin/flow-bridge.mjs:38`：`credentialGate` 产物名键改固定标签（「输入候选」/
    「输入 testcase」「输入 mapping」），命中报文不再携原始路径。

## 非目标

见 GRILL D6（Low 类不动 / 不加输入预扫 / gate.mjs loop-kit 域 / verdict.json 落盘门改造记档不动）。

## 验收（红金牌 tests/_golden/output-seal.golden.mjs + loop/prd-output-seal.json）

- 逐封口哨兵：喂含种子标记的坏输入 → stderr/stdout 不含种子值 + 退出码与修前语义一致 + 报错仍含
  可诊断定位（类型/intentId/序号——遮值不降诊断）。红先行：现状种子上通道实锤。
- A12 穿越面：坏 caseId（含 `../` 与非法字符）→ exit 65、不落任何 `runs/` 侧文件、原值不回显。
- inbox/candidates 过门：种子凭据值命中 → 拒写非零退出、文件不含种子。
- 回归：tier1 + e2e-chain + p2-sign + draft-cli + p3-compile + p5-replay + p7-report + run-history +
  caseid-echo-mask + chiefcomplaint-smoke + verdict 面（verdict-purity-guard）零行为差；
  涟漪预期零重冻（既有金牌不钉受改文案，AUDIT 实证），若有钉中随改重签。
