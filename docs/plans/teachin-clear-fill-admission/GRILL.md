# GRILL — teachin-clear-fill-admission（清空输入框 fill 事件误拒）

> 契约：`teachin-clear-fill-admission`（lane=full）。
> 触发：2026-07-29 上午手录首链实证（`docs/HANDOFF.md` 最新覆盖层）——`tc_chiefcomplaint_smoke`
> 录制成功落 24 事件，闭环被 `FILL_VALUE_UNAVAILABLE` 拒。
> 本纪要在 Steven 不在场时按已落硬规则推演定案；凡由护栏/ADR 直接推出的不设开放项，
> 真正需要人签的点列在末节挂账。

## 一、证据链（三层，全部实测）

录制语料 `runs/teachin-uat/tc_chiefcomplaint_smoke_20260729_091925/`（只读证据，不得篡改）：
24 事件中 9 个 fill；seq 11（清空输入框那步）持久化后只有
`seq,action,path,selector,tagName,fieldLabel` 六键，`value` 键整个缺席。

1. **注入侧没丢值**：`bin/record.mjs:167` 对 input 事件恒落
   `value: String(t.value || '').slice(0, 1000)`——清空时是空串，键始终在。
2. **投影层丢键（第一接缝）**：`lib/record-capture.mjs` `sanitizeRecordEvent` 对字符串字段
   统一 `if (v) out[k] = v`（第 90 行）——空串按假值被整键丢弃。对 `text`/`fieldLabel`
   这类装饰字段合理，对 fill 的 `value` 是语义损毁：「清空」被抹成「没值」。
3. **准入层拒空串（第二接缝）**：`lib/teachin/raw-capture.mjs:126-129` `checkReplayableFields`
   判据 `typeof event.value !== 'string' || !event.value`——后半句把空串也判成
   `FILL_VALUE_UNAVAILABLE`。即便第一接缝保住键，这里仍拦。

下游全部实证不用动：`lib/teachin/raw-action.mjs:52` 只拒非 string（空串已放行）；
`lib/teachin/raw-playwright-driver.mjs:106` 的 `handle.fill('')` 本身就是合法清空动作；
`lib/record-intake.mjs` 复核闸对 `value` 只做「有则须 string」的类型校验、允许缺席；
`raw-replay-runner.mjs` 拒付码清单无语义变化；蒸馏侧 fill 属受支持动作、无额外值闸。

## 二、决策树（逐条定案）

**D1 空串是不是合法回放目标值？** 是。清空输入框是真实用户动作，回放语义就是
`fill('')`；驱动层已天然支持。拒它等于「合法动作类白名单缺一员」，不是安全收紧。
依据：设计上动作轴以可确定性重放为准；实测驱动行为。

**D2 缺键还拒不拒？** 拒，维持 `FILL_VALUE_UNAVAILABLE`。键缺席无法区分「清空」与
「采集丢值」，证不出即不放行（护栏 #14 fail-safe 不 fail-open）。本修不是放宽准入，
是把「空串」从「缺失」里剥出来：缺键仍拒、非 string 仍拒、空串放行。

**D3 修在哪一层？** 两接缝都修，且只修这两处：
- `sanitizeRecordEvent`：对 `action === 'fill'` 的 `value`，除既有非空保留外，仅当
  **原始值恰为空串**（`raw.value === ''`，真清空）时保留空串键（判据细节从 D4 定案）；
  纯空白等洗空形态与其余字段维持「空即丢键」不动（`selector` 空本就该拒、`key` 空
  亦然，装饰字段丢了无害）。
- `checkReplayableFields`：判据收敛为 `typeof event.value !== 'string'`。
不动注入侧（本来就对）、不动 `raw-action.mjs`（已对）、不改 `ALLOWED_EVENT_KEYS`
键集与 capture `schemaVersion`（键集无增删，只是空串值不再被投影抹掉）。

**D4 纯空白值仍拒付（codex 计划评审 r1 High 采纳，推翻本节初版）**：初版把
「纯空白值坍缩成清空」当明示残留放行——那会把原本**拒付**的形态（`cleanString`
洗成空串→丢键→准入拒）洗成静默清空，是语义损毁 fail-open。定案收紧：投影只在
**原始值恰为空串**（`raw.value === ''`，真清空）时保键；纯空白与其他洗空形态
继续丢键、由准入拒付 `FILL_VALUE_UNAVAILABLE` 转人。若将来要支持空白填充保真，
另立契约。旁注：绕过录制投影、手造 capture 字节里显式 `value:'   '` 的，准入按
「string 即可回放」放行且回放忠实填空白——那是保真不是坍缩，无矛盾。

**D5 旧语料包追认不追认？** 不追认。已存包的 seq 11 在录制时已被投影丢键，
包内无法证明它是清空；篡改语料包补键是伪造证据（记忆纪律：夹具不许倒着裁，
冻结接缝要复现不另造）。结论：修的是「今后录制」；`tc_chiefcomplaint_smoke`
手录首链须 Steven 下次到机重录，旧包保留作蒸馏语料与本契约的形状参照。

**D6 金牌策略（按 codex r1 两条 Medium 扩充）**：新红金牌覆盖五面——①投影层：
fill 原始空串保键、纯空白仍丢键（含 `buildTeachInCapture` 端到端形状与拒付钉）；
②准入层：空串放行 / 缺键仍拒 / 非 string 仍拒三分岔；③传导层：空串经
`projectRawReplayAction` 投影不丢键；④runner 穿透：`admitRawReplayCapture →
runRawReplay` 全链，动作替身收到的请求精确含 `value:''`；⑤物理句柄：
`canonicalRawPlaywrightDriver` resolve→perform，页面替身的 `handle.fill` 实参
严格全等空串。夹具形状取自真语料 seq 11 的邻接结构（脱敏重表达，不搬真值）。
既有金牌零枚断言「空串拒」、「缺键拒」断言与修后行为一致，预期零
`checksumAmendment`——此判断按记忆纪律（承重断言先实测）以修后全量复跑退出码
为准，不预签；复跑矩阵含 `record-capture.golden.mjs` 与全部 `buildTeachInCapture`
消费金牌（codex r1 Medium 补）。

## 三、挂账（route:human）

- 新金牌冻结人签（ADR-0004）：accept 阶段 `testChecksums` 落 prd 后按决策超时阶梯
  （15 分钟未答发邮件、再 15 分钟代签须如实标注）处理。
- 手录首链重录：需 Steven 人在机器前（远程桌面键盘进不了 WSLg 窗口）。
- 修后真机复验：hermetic 绿只是必要条件（ADR-0009），首链闭环真通要真机重录实证。
