# flow-bridge — 相1 LLM flow 草拟桥（full）

## 背景

补 compile「LLM 一次编译」链条唯一没落地的机制口：规范 TestCase（嵌套 steps）→ compile 吃的 flow。
这是「文本用例 → 可回放 spec」端到端里 ingest 与 compile 之间断的那一节。桥是 L0 确定性复核器，
LLM 在 CLI 外产 mapping、桥校验后产 compile 的 --flow。决策全表见 `proposed/GRILL.md`。

## 改动

1. `lib/flow-bridge.mjs`（新建，纯函数、零 LLM 零真机）：
   - `buildFlow(testcase, mapping)` → flow（`{id,name,category,steps:[{atom,params}]}`）：id 从 caseId 确定性
     派生（`^[a-z0-9_]+$`）；steps 顺序 = mapping 顺序。
   - `validateBridge(testcase, mapping, { knownAtoms })` → `{ok, problems}`：投影忠实闸（每 TestCase.intentId
     被覆盖 + 无凭空 intentId）+ 编译知识允许集闸（atom ∈ knownAtoms）+ 显式 route:human 跳过通道校验。
2. `bin/flow-bridge.mjs`（新建，薄 CLI，镜像 `bin/draft.mjs`）：`casey flow-bridge <caseId> --testcase <f>
   --mapping <f> --out-dir <d>`——读 testcase/mapping → caseId 一致校验 + 路径安全 → buildFlow → validateBridge
   → cred-gate → 落 `flow-draft-<caseId>.json`（或直接 `flow-<caseId>.json` 供 compile）。任一闸拒 exit 65 零落盘。
3. `lib/compile-atoms.mjs`（加法）：export `COMPILE_KNOWN_ATOMS`（11 原子集），`:259` throw 改读该 set
   （行为一字不变、消双源漂移，允许集单一事实源）。
4. `bin/casey.mjs`：dispatch 加 `flow-bridge` 子命令（转发 `bin/flow-bridge.mjs`，同 compile/draft 先例）+ help 一行。
5. `tests/_golden/flow-bridge.golden.mjs`（新建，红先行）：内联嵌套 TestCase + mock mapping 夹具。

## 非目标

不碰真机；不建 ingest/sign；进程内不烧 LLM；不扩原子、不改 atoms-registry 快照；不改 compile 执行/核验段、
不动 compile-gate 本体、不动 verdict/gate 冻结内核。

## 验收（红金牌 C1–C10）

- C1 桥件在册（buildFlow/validateBridge 导出）；C2 happy 产 flow 形状（结构不变量，不硬冻一份预定 flow）；
- C3【载荷核心 round-trip】桥产 flow → `casey compile --flow` gate 段 exit 0 落 flow-<caseId>.json；
- C4 未知原子（不在注册表）fail-closed；C5【真缝】册内无编译知识原子（如 nav.workflowManagement）fail-closed
  且点名「无编译知识」；C6 破坏性前缀 + `{{uniqueName}}` 模板保留；C7【桥独有】投影忠实闸双向（漏覆盖 intent
  → 拒 / 凭空 intentId → 拒）；C8 凭据兜底门；C9 caseId 一致 + id 派生 `^[a-z0-9_]+$`；C10 半份安全（任一闸拒零落盘）。
- gate GREEN；`selftest --tier1` 无回归；涟漪 `p3-compile` 等经 compile-atoms 的金牌复跑零行为差。
