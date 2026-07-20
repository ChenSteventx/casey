# implementation evidence — hermetic-golden-zero-sut-lifecycle

## 结果快照（2026-07-20）

- SUT 启动闭集：27 个历史 golden；扫描器正负控 `5/5`。
- 原子义务：349 条；`survive-unit=99`、`retain-isolated=239`、`superseded=11`、`retire=0`。
- 存活后继：99 条 target，逐 `(unitGoldenPath, unitCheckId)` 校验血缘与真实 stdout 身份；按文件去重后执行，聚合 `2/2`。
- 生命周期闭合：真实账 GREEN；12/12 敌意突变必红。
- PRD 反向闭包：118 个 PRD、325 条剩余 acceptance；27 个隔离 live executable 的 168 条旧引用已从 63 个 story 清除。
- 纯隔离 story：4 个历史 true story 由 gate 安全翻回 false；另 2 个原 false 保持 false。统一静态隔离闸验证 239 条义务/27 文件后 exit 78、route:human。
- 墓碑/UAT：无完整 UAT 后继，故 `retire=0`、零墓碑，避免把 partial/uncertain 冒充 full。
- output-seal B5：合法只读导航信封命中登录预备动作前置闸；凭据种子不回显，启动哨兵不存在；同步 stderr 修复后连续复验稳定。
- CASE_DEFECT：合成 compile `affordanceAbsent:true` 稳定裁为 `NEEDS_HUMAN/CASE_DEFECT`。

## 允许执行的验证

以下均未运行旧行为 golden、夹具 SUT 或浏览器：

```text
hermetic-golden-sut-census.zero-sut.golden.mjs          5/5
hermetic-golden-lifecycle-closure.zero-sut.golden.mjs  mutation 12/12 + real GREEN
hermetic-golden-surviving-units.zero-sut.golden.mjs    2/2
hermetic-golden-retirement-meta.zero-sut.golden.mjs    2/2
hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs GREEN
p2-verdict-case-defect.zero-sut.golden.mjs              GREEN
output-seal-b5-prelaunch.zero-sut.golden.mjs             GREEN
hermetic-golden-isolation-pending.zero-sut.golden.mjs   exit 78（预期）
```

## 人工闸

ADR-0004 冻结面尚待 Steven 人签：改过的 surviving-unit acceptance、新 scanner/账本/unit/静态隔离闸，以及 `output-seal.golden.mjs` 的新 checksum。实现评审可先进行；任何 checksum 更新不得由实现者自签。
