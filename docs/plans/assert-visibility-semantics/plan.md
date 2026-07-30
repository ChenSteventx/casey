# plan — assert-visibility-semantics（v1）

> 前置：`GRILL.md` v1（codex sol max 计划 + opus xhigh 审七条修订并入）。
> lane=full。目标：负向文本断言口径纠偏 + 双 fail-open 缝钉死，解 publish
> 阻断，真机四轮全 PASS。

## 1. 生产件改动（最小面）

1. `lib/replay/intent-observation.mjs`：
   - `readTextHits` 按文本值归并断言请求；被 `textHidden` 请求的值改用
     可见过滤计数（Playwright 可见过滤），同值冲突取可见计数（GRILL D4）；
   - 该通道的 toast 兜底换成**带可见性过滤**的读取（复刻既有可见谓词），
     `readToasts` 本体不动（它同供 `noErrorToast`）；
   - 查询失败**返回未知并省略该键**，废 `safeRead(..., 0)` 的 0 回退；
   - `readToasts` 失败回 `[]` 的孪生缝：改为可判别的未知，`noErrorToast`
     在采集失败时**不得判过**（GRILL D2 第 2 条）；
   - `textVisible` 独有值保持现行口径（其命名与实现不一致另行挂账，
     GRILL D7），不把本次修复扩成全部正向提示的时序迁移。
2. `lib/assertion-draft.mjs`：补 `assert.textHidden` 的映射（参数名 `text`、
   `op: 'absent'`，与注册表和词表一致），使其不再落待补；已在已实现种类表内，
   不会多出软断言。
3. 假环境夹具：新增「只隐藏、不清空内容」的关闭情景（复现真机接缝，
   GRILL D5），既有真卸载情景保留。
4. 明确不改：`textHits` 形状、event-runner / replay-axes / heal / raw 各
   消费面、`expected` 签署件字节、`check.mjs` 词表、断言规范枚举、
   `verdict.mjs`、`readToasts` 本体。

## 2. 金牌（红先行，端到端）

新 `tests/_golden/assert-visibility-semantics.zero-sut.golden.mjs`：GRILL D5
七组，**走完整回放路径**（事件运行器→三轴→裁定），不许直调采集函数交差。

## 3. prd 与验收

`loop/prd-assert-visibility-semantics.json`：s1 新金牌红→绿；s2 邻接
（chiefcomplaint-smoke / kinds-harden / wf-history-version /
replay-settle-mount / p5-replay / **自愈复验金牌** / teachin raw 两枚 /
p4-drafter / 前序契约新金牌）；s3 漂移扫+术语。
验收 A1-A5 见 GRILL。

## 4. 评审与风险

计划 codex delta 一轮确认七条修订；实现 opus 5 medium（可回抛 sol max
咨询）；实现后 codex+grok 联审。
- R1 关闭动画致偶发红（可见判据认透明度为可见）→ 四轮真机暴露；**禁用固定
  延时糊**，真出问题走 D7 的 timeoutMs 未实现根因另立契约；
- R2 敏感度净损失（可见过滤放宽 + toast 处置）→ 按 D3 改滤不砍，只掉一档；
- R3 假绿自证陷阱（本修复效果就是把红变绿）→ A4 首末轮探针为唯一区分证据，
  实现不得省；
- R4 自愈路径同步生效 → 复验金牌进 s2 复跑清单。

## 5. 主会话裁决（红先行落地后，2026-07-30）

红金牌落地时抛上来四条矛盾，逐条裁定如下，裁定即本计划的修订。

**M1 · D5「新增夹具情景」不走 `publish-sut`，改走 hermetic 固定语料。** 原文
写「假环境夹具新增只隐藏不清空的关闭情景」，但 `tests/fixtures/publish-sut/server.mjs`
被 `prd-wf-publish-states` 与 `prd-wf-history-version` 同时冻结（同一 sha），
加情景要双 prd 重签；且它是真 HTTP 假 SUT + 浏览器，与本金牌的零 SUT 命名与
纪律直接冲突。**裁定：接缝的确定性复现放 hermetic 固定语料
（`tests/_golden/fixtures/assert-visibility-semantics/dom-page.mjs`，两种关闭
语义各一——`CLOSE_UNMOUNT` 逐条复刻现役 `publish-sut/server.mjs:93` 的清空行为，
`CLOSE_HIDE` 复刻真机隐藏不卸载），浏览器层的真实证据由 A4 四轮真机承担。**
这不是降级：A4 本来就是唯一能区分「修对了」与「洗绿」的证据，浏览器层再加一层
假环境情景是重复取证换双 prd 重签，不划算。`publish-sut` 一字不动。

**M2 · `hermetic-golden-sut-census` 闭集陈旧红，挂账不在本契约修。** 该件硬编码
「起 SUT/浏览器的金牌闭集恰为 27」，干净基线实跑 4/5、exit 1，实际闭集是 30
（多 `agent-id-readback.chat-sut`、`entity-ui-wiring.bindagent-replay`、
`entity-ui-wiring.searchopen`）。属 `prd-hermetic-golden-zero-sut-lifecycle`
的验收面，非本契约引入、也不在本契约 s2 清单内。本契约新金牌不进该闭集
（census 扫描零命中，已实测）。**挂账另立契约。**

**M3 · `hermetic-golden-prd-reverse-closure` 同为既有红，同样挂账。**
（隔离 live executable 仍被 acceptance 引用：`p3-compile.golden.mjs`、
`report-diagnostics.golden.mjs`。）与本契约无关，输出零处提到本契约新件。

**M4 · D4 冲突规则补齐采集失败口径。** 原 D4 只定了「同值冲突取可见计数」，
没定采集失败时的冲突口径——而 `textVisible` 与 `textHidden` 共用同一
`textHits` 键空间，省键会连带把正向断言也变成证不出。**裁定：可见计数与
DOM 计数任一采不到，就省该键，正反两向断言一律落未知（`ok:false actual:null`
→ `NEEDS_HUMAN`）。** 理由是 `fail-safe` 方向唯一自洽：证不出就别判，宁可要人看，
不可两向各判各的。该规则须写进代码注释并在实现期补一枚金牌钉。

