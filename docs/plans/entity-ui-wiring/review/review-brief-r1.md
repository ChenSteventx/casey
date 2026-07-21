# entity-ui-wiring 异构评审包 R1（codex，非同族评审：Claude 实现 → codex 评）

## 基线与范围

- 基线：worktree `casey-entity-ui-wiring`，分支自 `dev@c5739749`，全部改动未提交（见 `working.diff` + `untracked-files.txt`）。
- 只评白名单文件，禁全仓漫游：
  - 新实现：`lib/agent-search-gate.mjs`（共享门）；
  - 改动实现：`lib/compile-atoms.mjs`（compileAgentSearchOpen 收紧+code、compileWorkflowBindAgent 新增、分派表 +1）、`lib/replay-actions.mjs`（doAgentSearchOpen/doBindAgent 分支）、`lib/atoms-registry.snapshot.json`（code 参数、bindAgent 词条）；
  - 夹具纯加法：`tests/fixtures/chat-sut/server.mjs`（twins）、`tests/fixtures/fake-sut/server.mjs`（bindagent 三场景）；
  - 验收金牌×4：`tests/_golden/entity-ui-wiring.*.golden.mjs`；
  - 例翻：`tests/_golden/flow-bridge.golden.mjs`、`regress-agent-tool-first-slice`、`regress-wf-node-script`（25→26）；
  - 契约与重签：`loop/prd-entity-ui-wiring.json` + 9 份 prd 的 `testChecksums` 重签（`resignLog` 有记）；
  - 词条：`CONTEXT.md`（容器归属闸、关系原子两行）。

## 规格（评审对照物）

`docs/plans/entity-ui-wiring/GRILL.md`（决策+继承边界）与 `plan.md`（W1/W2+验收点 A1–A10）。

## 风险清单（首轮只报 Critical/High/Medium）

1. **searchOpen 收紧**：`exact:true`+容器归属闸是否仍有 fail-open 缝（子串/同名/容器外/证不出四路是否都硬阻断）；编译与回放是否真同刻（同一共享门、无一侧私改语义）。
2. **bindAgent 双门**：多匹配绝不 first、缺席守卫、选中值【精确】回读是否可被绕（隐藏元素/浮层残留/触发器多开/回读子串）；触发器条件步不产 event 是否引入账面盲区。
3. **execute 权威铸造（安全红线）**：两份浏览器金牌内铸造 `entity-pre-execution-authority` 工件过预执行门——是否只是合法消费生产接缝（确定性签名+临时 prd checksum 发布+受众 test），有没有实际削弱准入门语义或留下可被生产路径滥用的旁门；临时 `loop/prd-tc_*.json` 的写入/清理是否有残留风险。
4. **前瞻红基线零触碰**：`teachin-semantic-lock-runtime-discrimination-successor` 金牌/夹具/prd 字节守恒（s4 守恒金牌 G1–G3）；本轮任何改动是否间接影响其语义。
5. **重签涟漪正当性**：9 份 prd `testChecksums` 重签是否全部对应纯加法/例翻、有没有夹带行为差（零行为差证据：`evidence/baseline-regression.txt`、`fakesut-regression.txt`）。
6. **冻结准入策略零改动**：`lib/entity-semantic-lock-preflight.mjs`、`entity-semantic-lock-v2.mjs` 未动（diff 应零）；金牌对 `SIDE_EFFECT_POLICY` 只当消费者。

## 现成证据（不必重跑，抽查即可）

- gate 权威：`loop/prd-entity-ui-wiring.json` 4/4 GREEN（gate 写 passes）；涟漪 9 prd gate：6 绿、3 红全为按设计恒非绿的隔离义务账金牌（exit 78，route:human），账面零变差（p5-replay 1/2→2/2、settle-mount 0/2→1/2 翻好）。
- tier1 selftest GREEN；term-lint --registry 通过。
- 红先行：`evidence/searchopen-red.txt`、`bindagent-lockchain-red.txt`、`bindagent-replay-red.txt`、`red-repin.txt`（修正版金牌无实现时重钉红）。
- 金牌修正记账：prd `checksumAmendments`（授权脚手架修正+陈旧反例修正，断言语义零弱化）。

## 评审要求

- 只读；发现按 Critical/High/Medium 分级，给 file:line 与可复现验证方式；不派生子代理、不无上限续跑。
- 证伪优先：每条 finding 先试图用白名单内代码/证据反驳自己。
