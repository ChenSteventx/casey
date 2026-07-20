# acceptance-red — hermetic-golden-zero-sut-lifecycle

日期：2026-07-20。只运行本契约新增的静态/zero-SUT 验收；未运行任何既有行为金牌、夹具 SUT 或浏览器。

## 计划纠偏

隔壁 D9 workflow 的机读结果是 `completed:0`，44 路均因额度中断；本 session 重新静态复核 44 条：16 full / 26 partial / 2 uncertain，且当前仓已有完整后继仅 6 条。GRILL 已补 D8/D9，plan 升 v9：复合 check 先原子化；只有完整等价且后继已落盘才退役；部分/不确定覆盖隔离保留。

## 验收点去向

| 验收点 | 去向 |
|---|---|
| 27 个启动面、效果路径与 detector 正负控 | `s1-sut-startup-census` |
| 原子义务、四轴归因、四生命周期、血缘/换线/换载荷突变 | `s2-atomized-lifecycle-closure` |
| 存活 unit 后继静态安全与真实执行 | `s3-surviving-zero-sut-units` |
| full-only 墓碑、归档摘要、exit 78、全 PRD 反向闭包 | `s4-retirement-and-prd-closure` |
| CASE_DEFECT 缺口保护 | `s5-case-defect-regression`（存量行为回归保护，冻结时即绿） |
| output-seal B5 原因级前置闸 | `s6-output-seal-b5-prelaunch` |
| 全量 obligation 人工复核、隔离项手工复现、真机 UAT、ADR-0004 人签 | PRD `observability` route:human 四项 |

## 红/绿基线

- SUT census：exit 1，`0 passed / 5 failed`；缺 `support/sut-startup-closure.mjs`，其余检查因 detector API 缺席拒绝真空通过。
- lifecycle closure：exit 1；合成突变 `12/12` 全部检红，真实六份冻结合同尚未落盘。
- surviving units：exit 1，`0 passed / 2 failed`；manifest 缺席且执行面拒绝空集合真空通过。
- retirement meta：exit 1，规范墓碑突变判据先通过，退役 fixtures 缺席。
- PRD reverse closure：exit 1；缺 isolation 与 surviving-unit 两份 manifest。
- CASE_DEFECT：exit 0；合成 compile 入口缺席 axes 确定性裁为 `NEEDS_HUMAN/CASE_DEFECT`，作为绿色回归保护冻结。
- output-seal B5：exit 1；动态前置闸探针已安全命中登录预备失败且未到启动哨兵，红只来自旧 B5 仍用 `workflow.create`、缺固定 nav 信封与哨兵断言。

`node loop-kit/bin/gate.mjs --prd loop/prd-hermetic-golden-zero-sut-lifecycle.json --dry` 已 exit 0：18 个 testChecksums 全部一致、术语检查通过、六个 story 命令形状可消费。

## 冻结清单

精确 sha256 见 `loop/prd-hermetic-golden-zero-sut-lifecycle.json.testChecksums`：7 个验收 golden + census 的 11 个独立正负控 fixture，共 18 项。自此实现者只读；任何修改须重走 acceptance-gate 与人签。
