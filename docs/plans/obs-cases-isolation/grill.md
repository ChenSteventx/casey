# grill 记录——obs-cases-isolation（2026-07-18）

## 决策树与清空过程

### 根因（侦察 + 主树复现坐实）

三个 observation 金牌（`observation-cli-authority-wiring` / `observation-unsafe-golden-revocation` / `observation-active-suite-supersession`，末者间接经 SAFE_V2）都用同一个 caseId `tc_observation_driver_provenance` 走 `acquireCanonicalCaseLease`。该租约故意钉真实 `PROJECT_ROOT/cases` 根、且要求 case 目录不得预存（`CASE_LEASE_PREEXISTING` 守卫）。金牌**正常路径跑完不清租约**——于是顺序跑互相污染（前一金牌留残留、后一金牌撞守卫）、重跑自残留。主树复现：清残留后 cli-authority/unsafe-revocation 转绿但跑完又留残留、supersession 因 SAFE_V2 撞残留仍红。此前误诊为「扫真实 cases/ 数据」，实为「同名残留撞预存守卫」。

### 为何不能换 caseId 隔离

caseId 被 Ed25519 签名 fixture 冻结（`identity-readback-receipt.signed.json` 载荷绑定 `caseId:"tc_observation_driver_provenance"` + 精确 sha）。改 caseId 须 driver 私钥重签=route:human。故「每次随机 caseId」死路，只能走「回收自残留」。

### 为何不给 kernel lib 加可注入案根（否决）

权威内核 `teachin-observation-authority-root.mjs` 故意把根钉死 `FIXED_CASES_ROOT=PROJECT_ROOT/cases`，这是这些金牌**要证明的安全不变量**（authority 只在固定真实根铸造、off-root 一律拒，见金牌 off-root 拒绝探针 + `CASE_LEASE_ROOT_NOT_FIXED`）。给它加「可注入案根/AT_CASES_DIR 重定向」会自毁不变量。明确否决。租约已显式拒 AT_CASES_DIR 重定向，那条路死。

### 方案（Steven 2026-07-18 可点选项确认「full 契约 + 租约幂等自回收」）

租约助手 `tests/_golden/support/canonical-case-lease.mjs`（test-only，lib/bin/mcp 无一 import）的 `acquireCanonicalCaseLease` 改幂等自回收，安全边界严格：

- acquire 前若目标 case 目录存在：
  - 携带本 caseId 合法 `casey-golden-case-lease` 标记（`artifactKind` 正确 + `caseId` 匹配 + `directoryIdentity` 匹配当前树 dev:ino）→ 安全清收再取（这是自有残留）。
  - 无标记 / 标记 `artifactKind`·`caseId` 不符 / `directoryIdentity` 不匹配 / 目录含租约标记以外的真实数据 → fail-closed 拒删，保持原 `CASE_LEASE_PREEXISTING` 拒绝（绝不误删真实用户 case 或非自有目录）。
- release：正常完成路径 + 异常/崩溃 finally 路径都清租约目录（防产生残留）。
- 保留钉真实根 + off-root 拒绝 + 不得预存真实数据的全部原不变量。

### 范围

改：`canonical-case-lease.mjs`（自回收核心）+ 三金牌/SAFE_V2（补 release finally 清租约 + 红先行断言）。不触 kernel lib/bin。全部目标文件是 checksum 冻结的 trust-root 断言 → full 车道红先行 + codex 异构评审 + Steven 人签重冻。

### 造词检查

`casey-golden-case-lease` / `directoryIdentity` 是 fixture 现有词；「幂等自回收」是行为描述，无新造词须登记 CONTEXT.md。

## 2026-07-18 深化诊断修订（plan 阶段发现根因比初判复杂，Steven 确认「全做」扩范围）

正确退出码逐层复现推翻了初判「三金牌 cases 残留」的单一根因：

- 主树清残留后逐个跑：`observation-cli-authority-wiring` 8/8 绿、`observation-unsafe-golden-revocation` 3/3 绿、均 cleanup 生效零残留——二者健康，此前红纯粹被 supersession 崩溃留的残留连累。
- `observation-active-suite-supersession` 是唯一真故障：它 spawnSync 子进程跑 SAFE_V2（`teachin-observation-safe-case-lease-v2`），崩于 `spawnSync ETIMEDOUT`（timeout 30000ms，DrvFs 主树慢易超时）；且 SAFE_V2 主树实测「10 过/7 失败」而非期望「11 过/6 失败」——多的第 7 失败是 T2 的 `rename cases/tc_casey_safe_lease_probe → .owned-backup` 在 DrvFs（`/mnt/d`）报 `EACCES`（余 6 失败为设计内 superseded：`DRIVER_NOT_PUBLISHED` 真机项 + D7 旧 frozen checksum 变化=本方吊销 `teachin-observation-transaction-root` 墓碑化的连带）。

即真根因是多因环境敏感：DrvFs `rename` 目录不兼容（T2）+ `spawnSync` 30s timeout + 残留连累，非单一租约残留。

Steven 2026-07-18 可点选项确认「全做：三金牌一并收」，范围扩为：① 租约助手幂等自回收（解 cli-authority+unsafe 残留连累 + 防复发）；② SAFE_V2 的 T2 `rename`→DrvFs 兼容等价（`copy`+`unlink` 或更简，保安全语义）；③ supersession `spawnSync` timeout 放宽留 DrvFs 裕度；④ 三金牌+SAFE_V2 崩溃路径清租约。全部预期落 tests/ 与 support、不触 kernel lib（侦察确认中，若触则上报升车道）。安全边界（自回收判据）不变、仍严格 fail-closed。

## 结论

full 车道成立（改冻结 trust-root 断言、涉安全边界、须人签）。安全边界由 Steven 确认。上游诊断见 `docs/HANDOFF.md` 2026-07-18 傍晚节 + `loop/prd-cli-authority-wiring-fill.json` observability。
