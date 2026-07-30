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
