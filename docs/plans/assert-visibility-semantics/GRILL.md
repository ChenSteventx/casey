# GRILL — assert-visibility-semantics（负向文本断言口径纠偏，v1）

> 触发：`tc_wf_publish_states` 末步四轮真机稳定红。真机探针实测：按 Esc 前
> 「创建时间」DOM 命中 1、可见命中 1；按 Esc 后 **DOM 命中仍 1、可见命中 0**
> ——浮层视觉关闭但节点不卸载，而现役 `textHidden` 数 DOM 命中数，故判红。
> **动作对、断言口径错。** codex sol max 出计划、opus xhigh 审出七条修订，
> 本版并入。

## D0 定性：这是实现纠偏，不是语义变更

作者层注册表 `lib/atoms-registry.snapshot.json:866` 把 `assert.textHidden`
定义为「`toBeHidden`，含未挂载」——**签字时的契约本来就是可见性**，现行
实现（数 DOM 命中）才是偏离。方向性证据：可见命中恒 ≤ DOM 命中，故本改动
只可能把 `textHidden` 从 false 翻 true，**不可能把任何现役绿判红**。

## D1 修法（路线 1，opus 审裁定采纳）

最小改 `lib/replay/intent-observation.mjs` 的 `readTextHits`：被 `textHidden`
请求的文本值改用可见过滤计数；`textHits` 仍是「文本 → 数字」平铺 map，
故 event-runner / replay-axes / heal 复验 / raw observation 全链形状不动
（**但查询失败时省略该键会改动键集，失败路径下 raw 产物字节会变——如实记，
不含糊说「零涟漪」**）。

弃用的两条路：新增断言种类（撞 `expected-frozen.schema.json` 枚举 +
`p4-drafter` 十五种精确计数，双重冻结代价最高）；采集侧同时报两数
（terminal/三轴/heal/raw 全链形状破，改面过大）。兜底备案：若关闭动画导致
偶发红且短期收不住，可切 `buttonState absent`（role 通道天然带可见性）
保阻断解除——但那不修根因，只作应急。

## D2 fail-open 双缝（护栏 #14，本契约必修）

1. `intent-observation.mjs:58` 的 `safeRead(..., 0)`：查询抛错回 0 →
   负向断言 `hits===0` 判过。**改为返回未知并省略该键**，绝不把异常回退成 0。
2. **孪生缝（opus 审补，计划漏点名）**：`readToasts` 兜底回 `[]` →
   `noErrorToast` 的 `bad.length===0` 判过，同一文件同类假过。
   本契约一并钉死。

## D3 toast 兜底：改滤不砍（opus 审驳回计划的「砍掉」）

`readToasts` 在 `readTextHits` 之前执行，兜底真正的价值是**时间**——抓短命
提示在两次读取之间消失的窗口。对负向断言，丢掉早一刻证据是 fail-open 方向的
损失，正好打在 chiefcomplaint 两条错误文案上。故：**给 `textHidden` 通道保留
toast 兜底，但换成带可见性过滤的读取**（复刻既有 `getClientRects().length>0 &&
visibility!=='hidden'` 谓词）；**不改 `readToasts` 本体**——它同时供
`noErrorToast`，改本体会顺带松动另一条负向契约。

## D4 冲突裁决规则（opus 审新增，必须显式）

同一 intent 内同一文本值被 `textVisible` 与 `textHidden` 同时请求时用哪种
计数——`textHits[value]` 只有一个数字，两种口径无法共存。现役全部签署件
不存在该冲突（已核），但规则必须写进代码注释并由金牌钉住，否则是随用例演进
随时引爆的静默口径切换。**定案：同值冲突时取可见计数（严者优先），并让
金牌钉住该规则**。

## D5 验收金牌必须端到端（opus 审驳回纯函数测法）

现有假环境夹具的关闭实现会清空内容（真卸载），**复现不了真机接缝**。故须
新增「只隐藏、不清空内容」的夹具情景——这是复现真机已观测事实，不是把夹具
裁到预定裁定——并让红先行基线走完整回放路径（事件运行器→三轴→裁定），
不许直接调 `readTextHits` 交差。

金牌矩阵：DOM=1 可见=1 → false；DOM=1 可见=0 → 修前 false 修后 true（锁真实
红签名）；DOM=0 可见=0 → true；采集抛错/不可用 → 未知，绝不回退 0；隐藏的
提示节点不得经 toast 兜底重计成可见；`assert.textHidden` 经草拟器映射为硬
断言不再落待补；D4 冲突规则钉；孪生缝 `noErrorToast` 采集失败必不判过。

## D6 范围与排期（opus 审裁定）

- **本契约只修 publish 阻断面**；`tc_wf_history_version` 的两处 Esc 零关闭
  效果断言属实，但**拆独立契约、排在本契约落地之后**——它现在是零错用例，
  给绿用例加新失败面还要重签，且真机行为未知（关闭后「暂无数据」是否仍可见
  没实测），会反过来卡住 publish 修复。**签前必须先真机探针**（承重断言先实测）。
- publish 侧**零重签**：`expected` 字节不变、checksum 不变，改的是采集口径。
  但语义变更须**留痕知会人签方**（尤其 chiefcomplaint 两条错误文案敏感度
  有实质变化），不许静默改判据。

## D7 挂账（route:human）

- `assert.textVisible` 同类背离只修了一半（注册表写「可见文字」、实现数 DOM）；
- `assert.textHidden` 声明的 `timeoutMs`（等待消失，缺省 8000）**根本没实现**
  ——现行是静默点上一次瞬时计数、无任何等待。关闭动画风险的根因就在这里；
  若后续要加等待，注意其后还串着按钮态与回复面的同刻采集，加等待会平移采样
  时刻，不能只在一处插一段了事；
- 真机 4 轮会留 4 条已发布残留（flow 无清理原子），残留处置延续既有口径。

## 验收

- A1 新金牌红→绿；A2 邻接零回归（**须含自愈复验金牌**——同一采集原语，
  口径改了它跟着改）；A3 零漂移+术语；
- A4（route:human）：publish 连跑 **4 轮**全步 PASS，`intent_5` 的
  `textHidden 创建时间` 均 `ok:true actual:0`；**首轮与末轮保留辅助探针证
  DOM=1、可见=0**——这不是可选项，是唯一能区分「修对了」与「把动作失败洗绿」
  的证据；
- A5（route:human）：新金牌冻结人签；语义变更留痕知会。
