# learn — teachin-raw-actionability-closure

> 六阶段收口沉淀。证据源：GRILL/plan（v3 瘦身直修）、plan-codex-r1..r5 与
> code-codex-r1、prd（gate GREEN 3/3）、真机边车
> `runs/teachin-uat/tc_wf_list_smoke_cycle_20260730_1930/`。

## 一、修了什么

闭环 click/dblclick 恒败：`page-topology/controller.mjs` 的 `performClick`
丢弃回调返回值、成功返回体无 `value` 键，而 `raw-playwright-driver.mjs` 以
`performed.value === true` 判成败 → **物理点击已落地却恒判失败**
（`fill`/`press` 走 `evaluateActive` 有 `value` 故好）。正式面
`replay-action.mjs` 早有闭包捕获先例，raw 面未沿用。修法只动
`performRawCandidate` 一处：闭包接住动作返回值、拓扑结果只判成功与否、
双条件合取 fail-closed。真机实证两击 `performOk` 由假转真。

## 二、教训

1. **夹具不保真会让真 bug 隐身数月**：两枚冻结金牌的拓扑替身返回了真控制器
   从不返回的键，于是「正控」一直绿着而生产链一直坏着。凡替身，**返回形制
   必须与真件逐键对账**，并配「替身回填多余键即红」的防再漂钉。
2. **全仓缺一枚「真件×真件」接合金牌 = 结构性盲区**：所有金牌都用替身时，
   两个真件之间的契约错配无人可查。跨模块接缝至少要有一枚真接合正控。
3. **「改对了」不等于「钉住了」**：代码审把生产判据变异成只看闭包值，金牌
   仍全绿——门禁挡不住去掉另一半条件的假绿实现。**双条件合取必须双向变异
   验证**（各去一半都要红），只测「修好后绿」是不够的。
4. **诊断链上的兜底码会吃掉真因**：`record` 最外层把任何未识别错误归成
   执行目标类稳定码，害得一次真机失败查了半小时才知道是登录资源加载问题。
   与本契约修的那类是同族缺陷——**兜底码要保留可判别的内层归因**。
5. **调试残留会绊冻结钉，而且是好事**：临时调试副本 `bin/zz-record-debug.mjs`
   因删除命令跑在错误工作目录而静默残留，撞红了取证边车的「输出件全仓导入
   站点」钉。钉子干得对；教训是**清理命令要与创建命令同工作目录**，别用
   复合命令里 `cd` 之后的相对路径删。

## 三、挂账

- A4 真机闭环绿未达成：链路推进到 `source-resolved-completion` 被外层统一码
  吞掉内层归因，后继契约 `cycle-evidence-inner-reason` 已出计划（codex 四轮
  PLAN_APPROVE、opus xhigh 审、Steven 点乙路）；
- 金牌补洞换签待 Steven 签；
- **诚实预期**：到闭环真绿之间大概率还有两三个契约——下一个盲区是语义证据
  投影失败路（完全无通报，其十四个码全不在边车白名单，扩白名单才是真正
  牵动四层闸的改动）。
