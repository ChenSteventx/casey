# learn — hermetic-golden-zero-sut-lifecycle

## 结论

阶段二没有把历史行为金牌粗暴改写成 zero-SUT，也没有在无可信真机后继时制造墓碑。最终按 349 条原子义务重裁：99 条 `survive-unit`、239 条 `retain-isolated`、11 条 `superseded`、0 条 `retire`。27 个 live executable 保留但禁止 agent 执行，等待 `route:human`；覆盖缩水不得冒充完整移交。

## 可复用教训

1. **文件不是覆盖原子。** 混合金牌同时承载纯函数与浏览器接线；整文件墓碑会删掉仍有效的 zero-SUT 覆盖。先列 source obligation，再定生命周期。
2. **后继要闭合带载荷的边。** 集合相等、目标 ID 相等都挡不住同分区换线或固定 ID 换载荷；闭包必须校验来源、目标与语义投影。
3. **部分更强仍不等于等价。** 桩页/纯谓词可以增强判据分支，却通常丢失 DOM 因果、接线、导航与时序；原义务仍应隔离。
4. **扫描器必须由独立正负控逼真。** `--sut` 只是值污点，不是启动事实；sentinel 安全预检与 `record --from-events` 是负控，fixture/listener/browser launch/多形态 child argv 是正控。外部评审抓出的 1 High + 3 Medium 证明“当前闭集恰好正确”不能替代检测方式完整。
5. **PRD 反向引用属于生命周期闭包。** 混合 story 只删隔离 executable，保留存活 acceptance；纯隔离 story 必须诚实转 false，不能用旧绿证继续背书。
6. **真机迁移机制不能做半套。** 无可信 signer、证据存证与 append-only ledger 时，本契约只登记 `route:human`，不伪造 false→true 自动迁移。
7. **大模型评审入口也要 fail-closed。** Pi 对大包使用原生 `@file`，不能把内容展开进 argv；Grok 大包须防 prompt offload 耗尽 turns。没有明确 `ACCEPT/REVISE` 的 exit 0 也不算评审完成。

## 收口证据

- Grok r1 `REVISE`（1 High + 3 Medium）→ scanner 加固 → Grok r2 `ACCEPT`。
- Pi/DeepSeek V4 Pro r1、r2 均 `ACCEPT`。
- census `5/5`，闭集 27；lifecycle 突变 `12/12`；surviving units `2/2`；PRD reverse `118/325`。
- ADR-0004 人签后：本契约 `55/55` checksum、output-seal `1/1` checksum 全部匹配。
- 隔离门按设计 exit 78：239 条义务 / 27 个 live executable。
