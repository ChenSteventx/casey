# entity-ui-wiring 实现与验证证据账（阶段 3，2026-07-22）

全部结论以退出码与 gate 权威账为准（命令均在 worktree `casey-entity-ui-wiring` 执行）。

## 实现面（与 plan W1/W2 一一对应）

- 新 `lib/agent-search-gate.mjs`：共享门 `resolveAgentSearchTarget`（exact:true 精确锚 + 容器归属闸；unique/ambiguous/absent/container-out 结构化裁定，证不出按不可点，绝不 first）。
- `lib/compile-atoms.mjs`：`compileAgentSearchOpen` 消费共享门 + `code` 编码收敛（有编码填编码、点击仍按 openName 精确锚）；新 `compileWorkflowBindAgent`（触发器条件步不产 event、选中事件带 `nodeName` 域锁通道、多匹配/缺席点名 blocker 硬阻断、选中值精确回读双证注记）；分派表 25→26。
- `lib/replay-actions.mjs`：`doAgentSearchOpen`（同一共享门）、`doBindAgent`（`pinNodeDrawer` 抽屉钉扎域锁 + 触发器恰一 + 条件展开 + 选项精确身份门 + 精确回读，句柄 finally 释放）。
- `lib/atoms-registry.snapshot.json`：`agent.searchOpen` 补 `code` 可选参数；新 `workflow.bindAgent` 词条（60→61）。
- `CONTEXT.md`：补登「容器归属闸」（wf-open-smoke 首立、本轮补账）与「关系原子」（bindAgent 首例）。

## 验收结果（gate 唯一写 passes）

- `prd-entity-ui-wiring`：**GREEN 4/4**（s1 searchopen 11/11、s2 锁链 8/8、s3 bindagent 回放 4/4、s4 守恒 3/3 + term-lint registry）。
- tier1 selftest GREEN；term-lint --registry 0 提示。

## 金牌修正记账（冻结中修，断言语义零弱化，均已重钉红）

1. 授权脚手架修正：闭合绑定集须覆盖全部 mutation 口径步（s1 补 `nav.agentManagement` subject 绑定；s3 删无法合法绑定的纯断言步 `assert.onPage`）+ execute 权威工件铸造（`entity-pre-execution-authority` 确定性签名 + 临时 prd checksum 发布 + `--entity-authority`，生产接缝只当消费者、准入门语义零改动）。
2. 陈旧反例修正：`openToolPicker 不可编译`断言系被前置断言遮蔽的陈旧断言（agent-tool 维度落地后已可编译），换真反例 `agent.removeToolByName`。
3. 红重钉证据：`red-repin.txt`（git stash -u 移除实现后，修正版 s1 1过/10红、s3 六处「未知原子」——红因与初版同族）。

## 涟漪收口（9 prd 重签，`resignLog` 各有记）

- 例翻 25→26 三金牌：flow-bridge C14、regress-agent-tool-first-slice、regress-wf-node-script。
- gate 复跑：regress-agent-tool-first-slice GREEN 1/1、regress-wf-node-script GREEN 1/1、integrate-regress-agent-tool-slice GREEN 1/1、chiefcomplaint-smoke GREEN 2/2、drawer-lock-hardening GREEN 2/2、p5-replay GREEN 2/2（1/2→2/2 翻好）、flow-bridge 1/2（s1 涟漪面绿；s2 为隔离义务账金牌 exit 78 按设计恒非绿，其陈旧绿被 gate 如实翻红）、replay-nth-visible-hardening 1/2（红=同一隔离义务账）、replay-settle-mount 1/2（0/2→1/2 翻好；红=同一隔离义务账）。
- 账面零变差；夹具零行为差证据：`baseline-regression.txt`（chat-sut 15 组逐字节比对 0 差）、`fakesut-regression.txt`（原始夹具对照跑红因逐字同）。

## 边界守恒

- 接线红基线（`teachin-semantic-lock-runtime-discrimination-successor`）字节/诚实红/gate 账三重守恒由 s4 金牌钉死（G1–G3 绿）。
- `entity-semantic-lock-preflight.mjs` / `entity-semantic-lock-v2.mjs` / 生产 publications 零触碰（diff 零行）。

## 环境备注

- worktree 无 node_modules，以符号链接指向主树依赖（gitignored）。
- drvfs 上浏览器金牌单跑 1–3 分钟属正常。
