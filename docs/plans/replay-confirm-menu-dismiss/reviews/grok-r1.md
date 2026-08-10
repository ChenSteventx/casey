<!-- 来源说明：grok 在评审末尾发起过一次 write 调用要落这份文件，但该写入未落地（其 TUI
     随后卡在只收可打印字符的状态、Enter 递不进去）。本文件正文是从 grok 会话转录
     ~/.grok/sessions/.../chat_history.jsonl 的该 write 调用参数里逐字提取的，未经改写；
     提取脚本见本轮记录。pane 回滚只剩 50 行，故不以 pane 为源。 -->

# Grok 异构评审 r1 —— replay-confirm-menu-dismiss

| 项 | 值 |
|----|-----|
| 被审提交 | `630958d2b044baff19a38dada27288e618c52258`（`630958d fix: 回放确认步等操作菜单离场——修真机时序竞态 + 修一处夹具假绿`） |
| 工作树 | `/home/test/casey-review-menu-dismiss/casey` |
| 被审范围 | `lib/workflow-delete-domain.mjs`、`tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs`、`docs/plans/replay-confirm-menu-dismiss/*`、`loop/prd-replay-confirm-menu-dismiss.json` |
| 评审方 | Grok（异构）；独立跑命令，不采信作者叙述 |
| 本文件 | `/home/test/casey-review-menu-dismiss/grok-review-r1.md`（**仓外**，不进克隆树 git） |
| 纪律 | 判绿只信退出码；证不出写 NEEDS_HUMAN；凭据与真目标地址不进本文 |

---

## 1. 亲自跑过的命令与退出码

### 1.1 环境

| 命令 / 观测 | 退出码 / 结果 |
|-------------|---------------|
| `test -L ../loop-kit` | **NOT_SYMLINK** |
| `file ../loop-kit` | `directory` |
| `echo '出口闸' > /tmp/deny-alias-probe.md && node loop-kit/bin/term-lint.mjs --file /tmp/deny-alias-probe.md` | **1**（ERROR 弃用别名；黑名单方向真拦） |

### 1.2 基线绿

| # | 命令 | 退出码 | 摘要 |
|---|------|--------|------|
| 1 | `git rev-parse HEAD` | 0 | `630958d2b044baff19a38dada27288e618c52258` |
| 2 | `node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` | **0** | **28/28 checks passed**；含 `PASS R16` `PASS R26` `PASS R27` `PASS R28` |
| 3 | `node bin/casey.mjs selftest --tier1` | **0** | 五条全 ok；`全链路 GREEN` |
| 4 | `node loop-kit/bin/gate.mjs --prd loop/prd-replay-confirm-menu-dismiss.json` | **0** | `gate: GREEN —— story 1/1 过`（ratchet + term + golden + selftest） |
| 5 | `grep -rn 'menuDismiss' lib/ bin/ --include='*.mjs'` | 0 | 仅 `lib/workflow-delete-domain.mjs:638` |

selftest 五条明细（exit 0）：

```
ok  统一语言注册表完整（term-lint --registry exit 0）
ok  弃用别名被 term-lint 拦红（黑名单方向）
ok  熔断器可清零（breaker --reset exit 0）
ok  质量门禁消费 1-story 契约并翻绿（gate exit 0 + passes 翻 true）
ok  裁判零 LLM：verdict.mjs 闭包无 LLM/网络客户端（verdict-purity-guard exit 0）
```

说明：更早一轮若见 selftest 红，根因是兄弟 `loop-kit` 软链导致 term-lint CLI 未进 main、lint 降级返 0——**环境假象，与被审改动无关**。现真目录副本下五绿。

### 1.3 突变闭环

备份：`cp lib/workflow-delete-domain.mjs /tmp/wdd.bak`  
基准 sha256：`8d25168af2d415701e7fb1e2f10efd3a990910c2030724f0895d8a577671367f`  
每次后 `cp /tmp/wdd.bak lib/workflow-delete-domain.mjs` 还原；最终哈希一致 + 金牌再绿。

| 探针 | 做法 | 退出码 | 失败行 |
|------|------|--------|--------|
| **A** | 摘 wait：`return { ...picked };`（去掉 `menuDismiss: await waitForMenuDismissed(menu)`） | **1** | R26/R27/R28：`menuDismiss` 期望 true/false，实得 **undefined**；25/28 |
| **B** | `menuStillShown` 内 `return !(await menu.evaluate(...))` | **1** | R26：确认 `unique→action_failed`；R27：`dismissed` false→true；R28：true→false；25/28 |
| **A2** | 假字段：`menuDismiss: { dismissed: true, waitedMs: 0 }`（真不等） | **1** | R26：确认 **`action_failed`**；R27：`dismissed` false→true；**R28 绿**；26/28 |
| **C** | 还原后 `node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` | **0** | 28/28；`HASH_MATCH` |

作者 accept 写「判据反转 → 2 红」；本轮 B 为 **3 红**（以本轮为准）。

### 1.4 静态读证（文件:行）

| 点 | 位置 |
|----|------|
| `dispose` 只 `handle.dispose()` | `lib/workflow-delete-domain.mjs:54-57` |
| 成功路径 wait + finally dispose（不 Escape） | `:636-642` |
| `menuStillShown` / `waitForMenuDismissed` | `:652-677` |
| 常量 3000/50 | `:38-39` |
| `performWorkflowDeleteConfirm` 无菜单句柄 | `:826-843`（只用 `pending.dialog`） |
| 夹具遮挡 `click` | `tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs:176-187` |
| R12（不关菜单、无遮挡、确认 unique） | 同文件 `:548-554` |
| R26 / R27 / R28 | 同文件 `:565-597` |
| R16 零消费者 | 同文件 `:758-775` |
| accept 红基线 | `docs/plans/replay-confirm-menu-dismiss/accept/red-baseline.txt`（三红均为字段 undefined） |
| 真机抽帧 | `docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/replay-cleanup-failure-20260810.md:111-122` |

---

## 2. 六问结论

### Q1 — 缝的定性对吗？

**对。**

- `dispose(menu)` 只释放 Playwright 句柄，不关页面菜单（`:54-57` + finally `:641-642`）。
- 成功路径不经 `settle`/Escape；Escape 仅失败收拾。
- 确认步无菜单句柄（`:826-843` 只有 dialog）。
- 真机：publish 菜单未关 → 确认 1ms `actionError`；catalog 菜单已关 → 758ms 成功。
- 落点在 `performCardMenuDeleteTrigger` 删除项成功后、返回前（`:636-638`）合理；确认步重扫浮层更差。

### Q2 — 判据选可见性对吗？

**主判据成立。**

- 三合一（display / visibility / rect）与 `actionStillLocked` 同构；预算 3000/50 同构。
- 取可见性不取纯 detach 合理；`isConnected===false` 亦离场。
- 可见但不拦（不重叠）→ 最多白等 3s，超时不阻断 → 无假绿。
- `evaluate` 抛错 → `false`（`:662`）：少等后确认仍 fail-safe → 不致假绿。

### Q3 — `menuDismiss` 是否零侵入？

**是。**

- 金牌 exit 0 + `PASS R16`。
- R16 扫 `lib/`+`bin/` 除 owner 外零消费者。
- grep 仅 `:638`。
- 加法字段，不改既有 `resolution`。

### Q4 — 夹具遮挡忠实还是 rig？

**非 rig；偏严近似。**

- 缺省 `menuBlocksOutsideClick=false` / `menuDismissDelayMs=0` → 旧行为不变。
- 开遮挡：任意 blocking 菜单拦一切菜单外点击（无点位重叠）→ 严于几何 hit-target；「遮罩」叙事可部分相容。
- R27 最敏感；R26 等离场后点不依赖偏严。无硬编码 resolution 洗绿。

### Q5 — 红先行与突变闭环？

**成立。**

| 探针 | exit | 解读 |
|------|------|------|
| A | 1 | 3 红（字段 undefined），与 accept 红基线同形 |
| B | 1 | 3 红；可见性极性 + R26 确认被拦 |
| A2 | 1 | **R26 功能钉**（假证据绿不了确认）；R27 留痕；R28 热路径仍绿 |
| C | 0 | 28/28 + 哈希一致 |

无「不修也能过」：三条都要 `menuDismiss`；R26 功能靠 A2。accept 红基线偏字段、弱于「确认被拦」（见 findings）。

### Q6 — 回归面？

| 声称 | 本轮 | exit |
|------|------|------|
| 本 prd 金牌 | 已跑 | **0**（28/28） |
| `selftest --tier1` | 已跑 | **0** |
| `gate GREEN 1/1` | 已跑 | **0** |
| 32 金牌 / 7 陈旧红 | **未复跑**；plan/accept **无** 7 份路径清单 | **NEEDS_HUMAN** |

**NEEDS_HUMAN（原样）**：32 金牌 / 7 陈旧红 未复跑、plan 无清单。commit body 有声称，`docs/plans/replay-confirm-menu-dismiss/` 未落 7 路径表，异构评审无法独立核对「非本刀引入」。

---

## 3. Findings 表

| 级别 | 标题 | 文件:行 | 复现命令 / 观测 | 说明 |
|------|------|---------|-----------------|------|
| **Medium** | R12 仍断言「菜单不关 → 确认 unique」 | `tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs:548-554` | `node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs`（exit 0 时 R12 仍绿）；对照 R27 `:577-585` | 假绿靠 R26/R27+遮挡覆盖，未改正 R12 自身 |
| **Medium** | 夹具遮挡严于几何 hit-target | 同文件 `:176-187`；`docs/plans/replay-confirm-menu-dismiss/GRILL.md` D3 乙 | 读 `click()`：`__blocksOutsideClick` 无点位重叠检查 | R27 非重叠可比真机更严；生产等离场主路径不致命 |
| **Medium** | 红基线偏字段缺失 | `docs/plans/replay-confirm-menu-dismiss/accept/red-baseline.txt:5-7` | 突变 A：`return { ...picked }` 后跑 golden → **exit 1**，三红 undefined；突变 A2：假 `dismissed:true` → R26 确认 `action_failed` | accept 红签名弱于功能竞态 |
| **Medium** / **NEEDS_HUMAN** | 32 金牌 / 7 陈旧红 未复跑、plan 无清单 | commit `630958d` body；`docs/plans/replay-confirm-menu-dismiss/` 无清单文件 | 本轮未串行 32 份；`grep` plan/accept 无 7 路径表 | 无法独立证实「非本刀引入」 |

无 **Critical** / **High**。

---

## 4. 末行总判

生产修法（卡片菜单删除成功后有界等菜单可见离场 + 加法 `menuDismiss` + 超时不改 `resolution`）与代码结构、真机缝、金牌 28/28、突变闭环一致；selftest 与本 prd gate 在真目录 loop-kit 下均为 exit 0。Medium / NEEDS_HUMAN 不构成阻断合并的 Critical/High 生产逻辑错误。

REVIEW-DONE APPROVE
