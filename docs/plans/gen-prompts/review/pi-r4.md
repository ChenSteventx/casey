# gen-prompts 修复层评审（r4）——pi

调用式：`pi -p --no-session --no-tools --thinking high --model deepseek-v4-pro @docs/plans/gen-prompts/review/material-r4.md <指令>`（pi v0.80.3，provider=deepseek，thinking=high，正常一次性完成，未再遇到 round-3 首次调用时的工具调用中断问题）。评审对象：round-3 双路复核结果，与 codex 本轮同料。实现方 Claude，评审方 pi/deepseek-v4-pro（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

## 逐条核实结论

### 1. codex-r3 第 1 条（A7 未关闭，漏 `fork()` + N1c 允许 repoint）

`fork()` 遗漏：`SPAWN_CALL_RE` 已补 `fork`，调用点基线仍与当前闭包事实一致，修复成立。repoint 绕过：N1e（正向允许清单）直接校验 `bin/promptset.mjs` 中所有 `bin('X.mjs')` 字面目标必须恰好为四个既有目标——把任一目标改为 authoring bin 会触发"未登记名字"判红；删除任一既有目标会触发"目标收窄"判红。这是从计数检测跳转到集合核对，从原理上堵死了 repoint 路径。材料记载的合成 mutation 测试判红，验证了该逻辑有效。是否仍有其他进程创建方式遗漏：正则已覆盖 `child_process` 常见子进程 API；`Worker`/动态 `import()` 不属于"子进程"范畴，遗漏不构成本轮评审阻断条件。

**结论：第 1 条兑现。**

### 2. codex-r3 第 2 条（两三段简写假阴性）

修复者的取舍理由在工程上成立。新增 F4c1b 用金牌断言冻结三个典型简写样例为 `hit:false`，将设计边界从隐含假设变为显式可测契约。门禁通过。该问题得到妥善关闭。

**结论：第 2 条兑现。**

### 3. codex-r3 第 3 条（F4c1 新形态/假阳性未进金牌）

diff 显示 F4c1 扩容：新增三个 round-2 形态，干净语料从 4 条增至 10 条，全部冻结为 `hit:false` 断言。门禁 76 过 0 败，证实这批语料已被测试覆盖且当前通过。

**结论：第 3 条兑现。**

### 4. codex-r3 第 4 条（评审材料陈旧/表述不清）

当前评审料已按处置表说明完成订正，并澄清了文件过滤策略。修复已使材料内部一致，无残留歧义。

**结论：第 4 条兑现。**

### 5. round-3 修复是否引入新缺陷

库代码仅修改了注释，无逻辑变更；测试代码新增断言均为纯断言冻结现有行为，未发现任何其他逻辑漏洞或回归。

### 6. 铁不变量验证

裁判零 LLM / authoring 不进闭包 / 零 API key·网络·凭据接线 / 无内网真实地址泄露——四项均判通过。

---

## 最终结论：**PASS**

round-3 的 4 条问题已全部妥善兑现；round-3 修复未引入新缺陷；三条铁不变量继续成立。N1e 对动态目标名的残余局限与两三段简写不检测的取舍均已显式记账并冻结在 golden 中，工程判断合理，不构成本轮阻断。

**附观察项（非阻断）**：`Worker`（`worker_threads`）和 `child_process.execFile` 的回调式重载理论上不在 `SPAWN_CALL_RE` 的作用域内（后者仅检查函数调用形态，但 `execFile` 函数名本身已在正则中，与是否回调无关；`Worker` 则根本不在该正则内）。这些不属于 spawn 家族，当前阶段不宜视为必须覆盖的防线，建议在后续迭代中评估是否需扩展检测面。

---

## 驱动员核对（sonnet5，修复者本人）

pi 本轮 PASS 与 codex 同轮 NEEDS CHANGES（关于两三段简写"裸文本理由不应推广到有协议头场景"）方向不同——pi 认可修复者 round-3 的处置理由本身，codex 则指出该理由的适用范围过宽。已核实 codex 的具体建议（URI authority 单独检测）技术上可行且不引入假阳性，采纳并实现（新增 `URI_AUTHORITY_RE` + 金牌 F4c1c），见 `docs/plans/gen-prompts/review/dispositions-r4.md`。pi 独立指出的 `Worker`/`execFile` 观察项已核实：`execFile` 已在正则中不受影响，`Worker` 判定为不属于本契约当前范围、不需处理。
