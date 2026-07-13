# loop-kit-extract 实现审记录（r2 第一次跑，`pi`）

## 评审元数据

- 评审对象：同 `codex-impl-r2.md`——`loop-kit-extract` 契约 round-1 实现审修复落地后的 round-2
  复核，评审料 `docs/plans/loop-kit-extract/review/material-impl-r2.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `pi`（`deepseek/deepseek-v4-pro`，
  评审家族≠实现家族）。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek/deepseek-v4-pro
  @docs/plans/loop-kit-extract/review/material-impl-r2.md "<评审指令，指向料文件『0. 评审指令』一节>"`，
  `pi` 版本 `0.80.3`。
- 前置 smoke 验真：先以最小 prompt（"回复『pong』两个字"）确认模型可正常应答，再跑正式评审。
- 护栏 #9：同一份评审料，只含 spec、round-1 发现原文、处置表、红先行证据、diff、门禁证据，不含
  凭据、不含实现者内心推理。`--no-tools` 保证 `pi` 只基于料文件内容判断。
- 运行备注：进程正常退出，产出完整结构化中文评审。

## 结论（原文）

**总体结论：PASS。** 逐条复核 A1–A7 修复落地、新增代码与证据，未发现新的 `HIGH`/`MED`/`LOW` 问题。

## 逐条复核（`pi` 原文摘录）

- A1：认领槽已改 `globalThis[Symbol.for(...)]`；C7 全部改独立子进程；C3 新增「同进程跨树（真异包
  目录）」用例直接驱动了「不同模块实例、同一 globalThis 槽」此前防线不可达的路径；并发导入用例验证
  原子认领不变性。**结论：A1 修复真实闭合缺口，无裸退。**
- A2：`boot.runCli` 新增测试专用 `spawnImpl`（生产 shim 绝不传参，零跳过口），据此把 `r.error`、
  `status===null` 从源码字符串断言升级为行为级验证；信号终止测试改经外层包装进程真调用
  `boot.runCli`；新增目标模块 import 抛错/认领 API 抛错（哨兵文件证明求值前认领）/并发导入三个此前
  未覆盖场景。**结论：A2 四条缺口均被真实代码路径驱动闭合，无弱化断言。**
- A3：`testChecksums` 新增 `boot.mjs` 条目，gate 全部 story GREEN 过、sha256 一致。**结论：闭合。**
- A4：C2/C4 故障注入改在隔离树内操作；`git status` 显示真实信任根文件无额外改动。**无新增非原子写
  风险。**
- A5：字段级白名单仅替换 stdout/stderr 的 `treeRoot` 与 `.breaker-state.json` 的 `startedAt`；两条
  新增反向扰动用例（白名单外时间戳保留且判红、跨文件同名字段不误替换）；22 份既有 raw 案例规范化
  结果字节不变。**结论：完全闭合。**
- A6：`loadLib` 两处 URL 构造已改 `pathToFileURL(join(...)).href`，可正确处理含 `#`/`%`/空格路径。
  **无新增缺陷。**
- A7：`signalNumber` 查 `os.constants.signals`，兜底码 `128+n`；桩替换 `process.kill` 驱动该分支、
  验证 SIGTERM 下返回 143。**结论：修复正确，测试驱动了该分支。**

## 专项核验（`pi` 原文）

1. `spawnImpl` 生产零跳过口：十个 shim 展开结果中不出现该参数，无泄漏风险。
2. `globalThis[Symbol.for(...)]` 误读误写：键名含具体用途字符串，无关代码触碰概率极低；C7 用例均为
   独立子进程，不存在同进程粘连污染。
3. `buildIsolatedTree` 隔离：真实工作树文件始终只读，无回写。
4. `boot.mjs` 冻结面：gate GREEN 直接证明 `testChecksums` 哈希与文件一致。
5. observability 措辞：准确反映当前已闭合的覆盖范围，未夸大。
6. 术语/凭据：无违反简体中文、无弃用别名、无 `.auth`/`site.json`/DeepSeek key 泄漏。

**「所有 round-1 采信发现均被真正闭合，修复未引入新问题。」**（`pi` 原文结论句）

## 驱动员核验备注（非评审判断，供归档交叉参考）

本轮 `pi` 判 `PASS`，与同一评审料下 `codex` 判 `CHANGES REQUIRED`（2 `HIGH`/1 `MED`/1 `LOW`，见
`codex-impl-r2.md`）不一致——两路未同时通过。`pi` 未能复现 codex 指出的 `worker_threads`
跨 Worker 独立 `globalThis`、槽内容预置不校验、`SPAWN_ERROR`/`NO_STATUS` 断言退化风险、A6 缺失回归
测试、C4 孤儿锁文件五项具体缺口——`pi` 的评审料与 codex 相同，但复核深度未触达这些点（`pi` 未执行
只读沙箱内的独立代码探针，`codex` 执行了）。按契约流程，`codex` 的 `HIGH` 未清零即不满足双路
同时 `PASS` 的收口条件，即使 `pi` 已判 `PASS` 也需先处置 `codex` 发现、再走下一轮双路复核。
