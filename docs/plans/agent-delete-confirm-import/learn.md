# learn · agent-delete-confirm-import

## 事实链

- `lib/compile-atoms-agent.mjs:194` 用 `inspectWorkflowDeleteConfirm` 零导入——
  `agent.delete` 编译在确认步必抛 `ReferenceError`，异常直穿 `compileFlow`。
- 缺陷由删除域卡片契约的 executor 在邻接排查中发现、主循环 grep 实证、本契约按
  chief `01e965f` 的成熟配方修复（红金牌四钉 → 一行 import → 邻接五面全 0 → gate 2/2）。

## 教训（可迁移）

1. **同一缺陷类在同一次拆文件里通常不止一处**：`01e965f`（requestLogPath）与本例
   （inspectWorkflowDeleteConfirm）同根——compile-atoms 拆分时漏导入、hermetic 夹具
   没造出命中分支的形态。值得给 lib/+bin/ 补一道零依赖 undef 静态扫描进 tier1
   （chief learn.md 已提，两案并证优先级该提了）。
2. **修复配方可复用**：根因同类时照抄已评审收口的先例工序（plan 版式/金牌四钉结构/
   红证实抓法/PRD 形状），一次过审零 findings——比每次现设计省一轮往返。
3. **gate 复跑会回写 PRD evidence 时间戳弄脏已冻快照**：提交后复跑 gate 验绿是对的，
   但要 `git checkout -- loop/prd-<slug>.json` 还原时间戳字节；评审侧同理。
4. **子代理按不了 `--user-confirmed` 人闸是机制正确**：Steven 的确认发生在主会话，
   由主会话按闸、代理接续——「谁有权按」与「信不信转达」分开，这条界线该保持。

## 评审

- R1 聚焦审：`grok-4.5` high（全仓暴露，/tmp 变异复现红形态、cmp 字节一致），快照
  `12b70ac`。终局 APPROVE，零 Critical/High/Medium。`pi` 路上游三败挂账（Steven 亲裁
  单路过闸适用），恢复后补审。详见 `reviews/README.md`。

## 遗留

- `unique` 行为面（真弹层实采文案回写）真证走真机，须 Steven 明示授权（每跑一次
  真删一个实体）——建议并入删除域卡片契约的 B4 真机窗口一起做。
- `real-run-trust` 金牌 dev 基线旧红（静态钉与 `bin/replay.mjs` 现行参数解析失配，
  owner `prd-agent-id-readback`）——他家挂账，另立小契约清偿。
