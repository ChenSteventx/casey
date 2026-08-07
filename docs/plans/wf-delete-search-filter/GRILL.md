# GRILL · wf-delete-search-filter（证据定案）

十一跑删除链截断的根因侦察把最初假设（「缺回列表导航」）修正掉了——逐条证据：

1. **导航不缺**：`compileWorkflowDelete` 开头就 emit nav 回 `listRoute`
   （`compile-atoms-workflow-crud.mjs:290`），且带 15s 搜索框就绪锚（`:294-298`，
   post-nav-anchor-wait 先例已应用）。十一跑里搜索框真找到了、fill/press 都 acted
   （0 步非 unique 佐证）。
2. **真根因是搜索姿势**：搜索隔离走 fill+`Enter`（`:311-312`）。seam-1 真机已证
   当前被测方 `Enter` **不过滤、放大镜才过滤**（wf-open-search-first 七跑实证 + 清偿工具
   实战注释 + 读回门契约三处同源）。Enter 是旧版被测方时代采的知识残留。
3. **计数门 unknown 的语义坐实**：`auditDeleteCount` 的布局判定基于**含目标名**的
   表格行/卡片计数（`compile-atoms-support.mjs:289-295`）——`布局=unknown、容器=null`
   = 目标名在任何行/卡里都找不到。未过滤列表首屏 5 卡不含目标（open 往返详情页后的
   列表态），Enter 又不隔离 → 门**正确 fail-closed**。门无缺陷，别动门。
4. **岔口裁定语境**：Steven 已裁 atom 级（契约+双审、不动已签件、不回人签）；本修法
   仍在该封套内且爆炸半径更小——只改删除原子的搜索触发姿势 + 补过滤后有界就绪锚，
   frozen 面零接触（events 每次编译重产，不在 testChecksums）。
5. **修法**：`:312` 的 press Enter 换成放大镜 click（纯 fallbackCss
   `.hr-input__suffix .search-icon`，照 chat.sendAndWait 送出图标先例 + wf-open-search-first
   `:106` 同款 emit 形状）；过滤后对「目标文本落在记录容器内」有界轮询（15s，预算耗尽
   不改判——审计照跑、既有 fail-closed 路径零行为差）。
6. **为何十一跑才暴露**：删除链此前从未在「open 真通后往返详情页」的列表态下执行过
   （运行 1-4 停更早层、5-10 停 open）——「从未走通过」家族第四例，与前三例同构。
