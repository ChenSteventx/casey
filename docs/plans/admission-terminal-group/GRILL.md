# GRILL · admission-terminal-group（Steven 裁甲定案）

裁定：sign 二跑 `OBSERVATION_ROLE_COUNT_MISMATCH` 实证摆裁后，Steven 2026-08-08 当轮
点选**甲——准入验证器终端语义对齐基数门先例**（乙脚手架豁免否）。

1. **缝的本体**：`validateObservationAdmission` 段 1 把已登记原子的**每个 click** 推为
   独立终端（`terminals.push` 逐 click），段 3/5/6 据此索要信封与角色行——create 的
   新增/分类脚手架 click 各要一行 subject，真产物只有确认 click 一行。同缝在基数门
   `checkIdentityObservationCardinality` 早经 codex round-3 High 裁定进化：
   「组内末 click 才是终端（顺序遍历、最后写入即终端，键 JSON([intentId,atom])）+
   观察必锚终端、锚脚手架步具名拒」（`:361-365`、`:382-384`）。准入验证器从未接过
   多 click 真产物（sign 侧「从未走通过」），缝一直潜伏。
2. **修形（与基数门逐字同构）**：段 1 改为组内末 click 终端——每个已登记 click 仍
   全量过字段 fail-closed 校验与重复三元组拒，终端集取各 (intentId,atom) 组最后一个
   click（其 `yieldedToPlatformId` 随之投影）；段 3/5/6 与让位谓词自动继承新终端集。
   **附带收紧**：观察行锚脚手架（非末）click 时不再有终端可配 → 既有「行必须锚终端」
   路径具名拒（镜像基数门 ANCHORS_NON_TERMINAL 语义，fail-closed 更紧非更松）。
3. **加法与遗留**：单 click 原子（agent.searchOpen、workflow.open）组内末=唯一，行为
   逐字节同码；多 click 组仅 create 家族，其真产物形恰因此过门。
4. **非目标**：不动基数门；不动让位豁免判据（四条件原样，随终端集自动生效）；
   不碰 schema；不改 sign.mjs。
5. **修通预期（预登记）**：重跑同一 sign 命令（Steven 已签五断言呈件 + 17 行确认件
   不变）→ 签署落盘新冻结件；随后 replay 链续（权威铸新 + grant），门拒即停如实报。
