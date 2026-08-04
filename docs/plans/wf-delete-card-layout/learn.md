# learn · wf-delete-card-layout

## 事实链

- 起点是 2026-08-04 真机形状实采逮到的缺口：列表已改卡片布局、删除入口藏悬停
  「更多操作」菜单，旧删除域探不到（B4 重编译与清理链会败）。
- 四轮实现-评审迭代（408883f→0a1c267→ced9fcf→7b9e40a），R4 终审 grok+pi 对同一
  不可变候选双双 PLAN/IMPLEMENTATION APPROVE，金牌 25 钉、13 项零 SUT 验收全 0。

## 教训（可迁移）

1. **物理句柄缺席不等于闭合**：SUT 可在同一事件拍里移除旧节点并重渲染同形可见
   替身（pi R3 反例）。凡「按句柄验缺席」的闭合判据都要再问一句：同形残留呢？
   收紧方向 = 句柄缺席 且 形状域无可见目标残留；证不出一律保守失败。
2. **静态钉三次栽在钉不住行为**（源形态 indexOf 命中定义非调用点、导出契约放过
   死导出、句柄缺席放过重渲染）——能用夹具驱动真执行断言行为的，不用源形态钉。
3. **评审并集纪律有效**：四轮里 grok/pi/Sol 各逮到对方漏的（grok 逮金牌钉力、
   Sol 逮 schemaVersion 与所有权、pi 逮洗绿反例）。任一 CHANGES_REQUIRED 即修，
   不辩解不折衷。
4. **评审运行错误如实分列**（grok 超时无终局不冒充、Luna HARNESS_ERROR 非
   「供应方不可用」、pi 上游三败挂账后恢复补审）——收据里模型/输入提交/结论/
   运行错误四列分开，事后可审计。
5. **保守失败要给边界语义**：形状兜底会把合法保留的基线菜单判 failed——这是
   设计代价，写进 plan 并用 R25 钉住，比留给读者猜强。

## 评审

R4 终审双 APPROVE（零 Critical/High/Medium；grok 一条 Low 残差挂账）。
完整轮次总账与运行错误分列见 `reviews/README.md`。

## 遗留

- 真机门未关：卡片路径实跑、B4 重编译链、`atl_shape0804a` 残留清偿——route:human。
- 不 merge 不 push，等 Steven 授权；P9 整体不宣称 PASS。
- grok Low 残差（root 自身不进文本扫）；menuCleanup 上回放历史属独立决策。
- 三枚历史基线红他家挂账（p3-compile / real-run-trust / hermetic-golden-isolation-pending）。
