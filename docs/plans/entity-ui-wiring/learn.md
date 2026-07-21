# entity-ui-wiring · learn（阶段 5 沉淀）

## 交付结果

- `agent.searchOpen` 联合定位输入侧收口：共享门（精确锚+容器归属闸）编译/回放同刻、编码收敛参数、同名双条目 AMBIGUOUS 硬阻断。
- `workflow.bindAgent` 关系原子全线接通：编译知识（25→26）、注册表词条、回放专用门、双 receipt 锁链端到端；配方按 hermetic 先行裁定落地，真机四停站挂 prd observability。
- gate GREEN 4/4；codex 四轮异构评审 R4 PASS；涟漪 9 prd 重签零账变差；接线红基线三重守恒。
- route:human 交付物：`realmachine-spike-checklist.md`（平台 ID 三通道观察 + 容器类名采样 + bindAgent 真机配方复核）。

## 教训与沉淀

1. **execute 权威链的金牌法**：含 mutation 步的浏览器金牌过预执行门的既定路径 = flow 步携 `sourceIntentId + entityBindings`（闭合绑定集须覆盖**全部** mutation 口径步，缺一步整份拒绝）+ 金牌内铸造 `entity-pre-execution-authority`（确定性签名 + 临时 prd checksum 发布 + `--entity-authority`）。生产接缝只当消费者、准入门语义零改动。后续接线契约直接复用，别再撞 `PRE_EXECUTION_IDENTITY_BINDINGS_INVALID` 重新考古。
2. **身份门类实现一步到位按全协议写**：codex 四轮逼出的缝（隐藏值惰性回读、缺抽屉域锁、三时点缺触发器绑定、替身控件顶替）全部是 selectNodeDropdown 既有协议早已覆盖的面。新身份门第一版就该按「域锁钉扎 + 物理句柄 + 落笔前/落笔时/点击后/回读前全时点三闸重判 + 物理句柄内回读」写，简化版必被评审打回。
3. **emit 动作回调是定制身份门的正门**：`run.emit(spec, customAct)` 把落笔时刻重判放进 emit 生命周期（抛错走 action_failed 通道、acted 不谎报）——selectNodeDropdown 先例，绕开它自己管动作就会把账面弄出盲区（本轮触发器事件 acted=true 谎报被金牌逮住后改条件步）。
4. **冻结中修金牌的合法路径**：断言零弱化 + 无实现状态重钉红（git stash -u 含未跟踪新实现文件）+ prd `checksumAmendments` 记账。本契约三轮修正全按此走，评审可复核。
5. **多断言 check 的遮蔽陷阱**：`openToolPicker 不可编译`陈旧断言被前置 throw 遮蔽了整个红先行期，直到实现落地才暴露。写金牌时每条断言要单独对今日现实跑一遍，别信「反例断言不用验」。
6. **工具坑两则**：后台 `codex exec` 必须 `</dev/null`（否则等 stdin 假死）；`pkill -f` 模式含自身命令行子串会杀掉自己的壳（exit 144）。
7. **陈旧绿如实翻账**：涟漪重签暴露 flow-bridge s2 陈旧绿（隔离义务账金牌按设计恒 exit 78），由 gate 权威翻红如实记账；p5-replay、replay-settle-mount 两处反向翻好。账面只能更诚实，不能更好看。

## 挂账（route:human，见 prd observability）

- 真机只读 spike（ID 三通道 + 容器类名 + bindAgent 配方复核）→ 回填后另立契约接平台 ID 读回与联合定位读回侧。
- 名称+ID 双定位真机 UAT、同名智能体敌意真机用例。
- 接线红基线填绿唯一路径 = 真机运行时权威（Steven 2026-07-18 已裁，本契约零触碰、s4 守恒金牌钉死）。

## 合并注意（给 dev 合并会话）

- 本分支 `entity-ui-wiring` 含 lib/bin/registry/夹具/金牌/9 prd 重签/CONTEXT 词条/audit 账；合并时按「文档先于 dev 提交」纪律同步刷新主树 `docs/HANDOFF.md`（本契约段）与 `docs/REQUIREMENTS-STATUS.md` 中 searchOpen/bindAgent 两行的完成度（hermetic 面已落、真机面仍 ❌）。
- 主树若并行动过 `loop/audit.jsonl`/prd，合并冲突按「双方都保留」处置（追加型账本）。
