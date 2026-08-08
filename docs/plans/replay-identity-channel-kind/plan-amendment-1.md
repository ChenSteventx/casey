# plan 修正案 1 · 剖面形状律执法时机分层（全仓扫描实证驱动）

plan.md §1b 原设计「按 `ENTITY_KIND_COMPILE_CHANNELS` 逐段声明即施形状律（镜像 compile）」
被全仓串行扫描证伪一角：两件 p9 权威 CLI 金牌
（`p9-created-workflow-continuity-v3.authority-cli` A6、`p9-replay-authority-split.cli-session`
R14-R18）由绿转红——v3 created-workflow 剖面的 `workflows` 段只声明
`listApi + mutationAdapter`（连续性适配器素材，`listApiScope` 取 `listApi.pathname`），
**不是也不必是**良构身份通道（无 `itemContainer`/`cardFields` 物理卡片面），
解析期执法把它误伤（`AGENT_IDENTITY_DOM_NAME_INVALID` 浏览器前拒）。

## 修正（已落码）

执法时机按 kind 分层（`bin/replay.mjs` 通道解析块）：

- `agents` 段：保持今日既有「声明即执法」字节行为（形状非法/listApi 非法 → 浏览器前
  exit 65）——零回归约束，不动。
- 非 agent 段（现即 `workflows`）：**延迟执法**——解析失败只记录
  （`identityChannelParseFailures`：kind→拒因），不在解析期退出；v2 门内锁行推导的
  kind 点名该段时才具名拒：
  `v2 冻结锁携 <kind> 身份观察但通道剖面 <profileKey> 非良构身份通道（<解析拒因>）`。
  v3 专用最小剖面（无锁点名）零行为差。

plan §1b「新增 fail-closed 边：profile.workflows 声明但畸形今日不看、此后 exit 65」
相应收窄为「仅当 v2 锁点名 workflow 通道时」。plan.md 已入 checksum 冻结，本修正案
以增量文件披露、不改冻结字节；评审提示词 R6 已同步。

## 证据

- 修正前：上述两金牌红（扫描件 `~/casey-recovery-20260807/sweep-rik.txt`，对基线
  `sweep-dsm.txt` 差异恰四行：本契约新金牌绿 + 两件 p9 红 + `loop-kit-extract` 124）。
- 修正后：两金牌 exit 0、本契约冻结金牌 exit 0、`loop-kit-extract` 单跑 exit 0
  （124 属负载性超时）；最终字节全仓扫描另出收据。

## 已知缺口（评审披露）

「段声明但非良构 ∧ 锁点名该 kind」的具名拒路径无 hermetic 冻结钉（契约金牌已冻、
不得追加场景；补钉须走 checksumAmendment + 人签，挂账待裁）。
