# 评审收据 R1 —— pi.dev（deepseek-v4-pro high）

- 被审快照：commit `630958d`（分支 `replay-confirm-menu-dismiss`，基线 `aeb500c`）
- 评审树：`~/casey-review-menu-dismiss/casey`（浅克隆，同哈希，评审方自跑金牌与探针）
- 日志：`~/casey-recovery-20260807/review-pi-menudismiss.log`，进程退出码 0
- 总判：**APPROVE** —— Critical 0 / High 0 / Medium 2

## 评审方独立核验到的事实

- 金牌 `wf-delete-card-layout` 28/28 exit 0
- 突变复现：摘掉 `waitForMenuDismissed` 后 R26 `confirmed.resolution` 由 `unique` 变 `action_failed`、
  R27 `menuDismiss.dismissed` 由 `false` 变 `true`，exit 1
- 关联金牌回归全绿：`checksum-drift-closure` 6/6、`agent-delete-confirm-import` 4/4、
  `regress-agent-tool-actions` 5/5、`delete-spec-magnifier` 6/6、
  `workflow-delete-causal-binding` 12/12、`workflow-delete-spec-preflight` PASS
- `menuDismiss` 全仓 grep：生产件唯一命中是加法点本身，删除域外零消费者（R16 断言同向）

## 六问逐条结论

1. 缝的定性对——`dispose(menu)` 只释放 Playwright 句柄不动 DOM；`performWorkflowDeleteConfirm`
   只持 dialog 句柄、绝不扫浮层。让确认步自己重扫浮层会引入选择器误抓与越权感知因果归属两类新
   不确定性，在触发步返回边界等是最小侵入位置。APPROVE
2. 判据选可见性对——与同文件 `actionStillLocked` 同款三合一判据口径一致；`display:none` 下
   `getBoundingClientRect()` 全 0，覆盖真机浮层的三种关闭写法。附 Medium 注记（见下）
3. 加法字段零侵入成立。APPROVE
4. 夹具遮挡语义在本命题范围内忠实、非缺省开启，不算 rig fixture。附 Medium 注记（见下）
5. 红先行与突变闭环成立，R26/R27/R28 各自钉不同断言、无互相掩盖。评审方另指出 R28 在无修法时
   也红（`trigger.menuDismiss` 为 `undefined`，`eq(undefined?.dismissed, true)` 失败），
   覆盖率不比另两条小。APPROVE
6. 回归面充足、无遗漏——卡片布局删除链调用图封闭，表格布局分支与确认链均不经过改动点。APPROVE

## 两条 Medium（评审方判不阻塞合入）

- M1：`menuStillShown` 的 `evaluate` 抛错按「已离场」处理（`lib/workflow-delete-domain.mjs` 该
  `catch` 支）。最常见抛错来由确实是节点已卸载，但页面崩溃、JS 上下文销毁也抛错，此时少等了该等
  的时间。评审方评实际风险极低并**建议不加区分**：区分需要额外健康探针、引入新复杂度，且确认步
  自身 fail-safe 会兜底（点不动 → `action_failed` → `NEEDS_HUMAN`，不假绿）。接受当前设计。
- M2：夹具遮挡模型是 all-or-nothing（菜单在场即拦一切菜单外点击），粗于真机 Playwright 的
  `elementFromPoint` 中心采样。本刀复现的场景里菜单确实覆盖确认钮，夹具忠实；但菜单与目标空间
  不重叠时夹具会比真机更严。评审方建议在夹具注释里写明这个模型边界，不建议推广到不重叠场景。

## 评审方报的既有陈旧红（与本刀无关，另账）

- `real-run-trust`：金装检查 `o.uniqueName = argv[++i]` 在 `bin/replay.mjs` 的存在性，该文件已
  重构为直接引用 `uniqueName`，金装未同步更新
- `selftest --tier1` 的弃用别名方向——**此条经本方复核为克隆树环境假象，不是既有红**，
  取证见 `../evidence/tier1-clone-degrade-artifact.md`
