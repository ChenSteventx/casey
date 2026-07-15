# workflow.deleteByName 复盘

1. 破坏性原子必须把目标名一路带到每个 click，不能在回放时从页面残值猜目标。
2. 记录域、确认弹层域和物理身份连续性必须由编译与回放共享同一算法；否则编译绿不能证明回放点的是同一实体。
3. intent 裁定必须折叠全部事件动作；只看末事件会把中间 `ambiguous`/`none` 洗成假 `PASS`。
4. `countChange equals 0` 的 selector 必须锚真实 replay 实体。compile 唯一名与 replay 默认唯一名可能不同，视觉复核能发现这种跨阶段错锚。
5. 宽泛搜索不保证列表只剩一个卡片；后置计数必须精确匹配目标卡，域锁也必须独立证明目标卡与删除按钮唯一。
6. 完成证据必须来自同一次真实 run：确定性 verdict、录像、视觉复核、独立 HTML 与附件。旧 fake fixture 只作源码历史。
