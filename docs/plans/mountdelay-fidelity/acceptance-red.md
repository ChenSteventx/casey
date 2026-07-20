# mountdelay-fidelity 红基线

2026-07-20 在实现改动前运行：

`node tests/_golden/mountdelay-fidelity.zero-sut.golden.mjs`

结果：exit 1，0/4 passed。四个失败签名分别为：占位存活期只观察 2 拍即早放；无配置
静止窗只观察 2 拍；占位探测证不出时仍返回 `settled:true`；回放调用未传 `profile`。

本验收只使用桩 page，未启动被测系统、浏览器或 listener；旧隔离金牌未运行。

## Grok R1 加严

实现评审发现两条有效 fail-safe 缺口后，新增独立回归锁
`mountdelay-fidelity-review-r1.zero-sut.golden.mjs`，在修复前真实运行得到 exit 1、0/2
passed：配置态 number-only 结果被误当占位已消失；selector 从未命中时只观察两拍，弱于
无配置三拍静止窗。原冻结验收文件未改动。
