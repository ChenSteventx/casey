你是 Casey 仓的异构评审员（家族不同于实现家族铁律：Claude 实现、你来评）。本轮评审契约 agent-id-readback（full 车道）：智能体平台 ID 网络信封读回 + DOM/信封双证门。工作目录是 worktree /mnt/d/ctx/heren/casey-agent-id-readback，基线 = 提交 82484ab，全部改动尚未提交（工作树即候选）。你只读不改、不运行任何 SUT、夹具或金牌。

【评审材料（受限包，只按这些评）】
1. 设计事实源：docs/plans/agent-id-readback/plan.md（v4，经 sol max 四轮设计共识 R4 判可进 accept）。实现忠实性以它为准。
2. 已跟踪文件 diff：/tmp/claude-1000/-mnt-d-ctx-heren-casey/05037bcb-8884-4123-b32b-b590c1266fe4/scratchpad/air-tracked.patch
3. 新增文件全文：/tmp/claude-1000/-mnt-d-ctx-heren-casey/05037bcb-8884-4123-b32b-b590c1266fe4/scratchpad/air-newfiles.txt
4. 红基线（实现前先红证明）：docs/plans/agent-id-readback/accept/red-proofs/ 五份。
5. 真机只读实证：docs/plans/agent-id-readback/evidence/realmachine-live-verify.md（活数据跑判定纯函数，三层剖面字段名经实测纠正 data.list / data.pageInfo.totalItems）。
6. 接口冻结件：docs/plans/agent-id-readback/accept/interface-spec.md。

【文件白名单（只审这些）】
改动：bin/compile.mjs、bin/replay.mjs、bin/sign.mjs、lib/compile-atoms.mjs、lib/entity-semantic-lock-preflight.mjs、lib/replay-actions.mjs、lib/replay-forensics.mjs、lib/sign-cli-args.mjs、mcp/casey-server.mjs、tests/fixtures/chat-sut/server.mjs；
新增：lib/agent-identity-observation.mjs、lib/agent-identity-gate.mjs、loop/prd-agent-id-readback.json、tests/_golden/agent-id-*.golden.mjs 五份。

【风险清单，逐条核】
R1 请求级身份观察事务协议实现是否忠实 plan §1：arm 在 fill 前武装；归属在 requestWillBeSent 时刻冻结（绝不在 loadingFinished 读当前 intent）；晚到 body 只回原事务 token；settle 等全部合格请求到显式终态（失败/超时也是终态，不等于空数组）；seal 后 consume 一次性消费，未决/冲突/超时/重复消费全阻断；有界投影（body 上限 256KiB、行数 200、字段 256 字符，超限即 invalid）；整页任一坏行 = 整页 invalid（禁过滤后判唯一）；agentId 无损字符串（数字越过安全整数即拒）。
R2 双证门判定表是否忠实 plan §2 且不弱化：完整性先决 total === records.length（声明 hasNextPath 则必须严格 false），未过判 action_failed 而不是 ambiguous；完整集合内先数同名（sameName>1 即 ambiguous），再查唯一行 code——禁先按名+码过滤成一条；名称唯一但任一码/已签 platformId 不等即 action_failed；只有 DOM 物理卡片、完整信封、已签期望三方全等才 unique 放行点击。准入拒绝不得被冒充成多匹配，多匹配不得被洗成通过（fail-safe 不 fail-open，护栏 #14）。
R3 sign 观察对账是否忠实 plan §4：join 只对终端 click binding、键为 sourceIntentId+candidateId+role+atom+evidenceStepId、多余/缺失/错位拒签；三类错配（capturedAgainstBuild、identityProfileDigest、eventsSha256）任一即 exit 65 零输出；v2 draft 在场即强制要求观察件，激活由 atom+role policy 驱动、不由旗标缺省/观察件内容/receipt 自报 kind 激活（sol 绕过面是否真全封）；v1 件走既有校验路径零动。
R4 回放点击前比对是否闭合且准入不弱化：v2 锁在场装配期望三元组，doAgentSearchOpen 点击前实时信封+DOM 与已签 platformId/code/name 全等才点；回放期缺剖面、digest 不符 = 浏览器启动前拒；旧版签署件（无 v2 字段）才允许 DOM-only，新签一律 v2——换旧剖面不能降级新签用例。
R5 未声明剖面路径零回归：plan §6 差分棘轮五面（CDP 序列、records/events/report 字节、CLI 三流、输出文件集合逐文件 sha256、poison spy 证身份模块未被触达）是否真做到，不以旧金牌仍绿替代、不 normalize 后冒充逐字节一致。
R6 prd 与 checksum 记录如实：loop/prd-agent-id-readback.json 六故事、17 项 testChecksums；红基线与验收金牌对得上；observability 义务（真机链 route:human）不夸大不漏披露。

【现成证据（已核，勿重跑）】
gate 六故事 passes 全 true（loop-kit gate 写入，退出码 0）；五份红基线证实现前先红；真机活数据双证实证绿；tier1 与存量回归金牌按 prd 记录绿。你不得运行任何金牌或 SUT 来复证——按材料静态核。

【输出要求】
只报 Critical / High / Medium，给 文件:行号 与具体修复建议；每条注明对应风险项编号。没有问题的风险项明说「核过、无发现」。最后单独一行给终判：PASS 或 FAIL（FAIL 需列阻塞项）。
