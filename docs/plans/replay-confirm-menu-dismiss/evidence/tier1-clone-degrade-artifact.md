# 取证：评审克隆树 `selftest --tier1` 红是包定位降级假象

两个评审方（pi、grok）都独立报了「`gate`/`selftest --tier1` 有红」，而实现工作树实测全绿。
同哈希不同结果必有环境依赖项，逐项查清如下。日期 2026-08-10。

## 现象

同为 commit `630958d`：

| 树 | `node bin/casey.mjs selftest --tier1` | 那条检查 |
|---|---|---|
| 实现工作树 `/mnt/d/ctx/heren/casey-replay-confirm-menu-dismiss` | exit 0，五项全 ok | ok |
| 评审克隆树 `~/casey-review-menu-dismiss/casey` | exit 1 | `弃用别名被 term-lint 拦红（黑名单方向）` RED |

## 根因

检查体（`bin/casey.mjs`，第 2 项）写一个含弃用别名「出口闸」的临时件，跑
`kit('term-lint.mjs') --file`，**要求 exit 1** 才算机制有牙；跑完 `fs.rmSync` 清掉临时目录
（所以事后在工作树里找不到那个文件，不是没写）。

`kit()` = `PROJECT_ROOT/loop-kit/bin/<name>`，两树该 shim 经 `diff -rq` 逐字节相同。差别在**包
定位**：shim 顶部有降级矩阵

```
const __DEGRADE = { cli: 64, guard: 2, lint: 0 };
```

lint 类被定为「监督层不阻塞」，包引导失败时返 **0**。克隆树原先把包接成软链兄弟目录
（`~/casey-review-menu-dismiss/loop-kit -> /mnt/d/ctx/heren/loop-kit`），包定位不接受软链 →
lint 降级返 0 → 黑名单方向那条看到 exit 0 → 判红。

同一根因也解释了 grok 的 `Shell is blocked by missing loop-kit identity lock`：guard 类降级值是
2（fail-closed），所以它的 shell 被 `hook-loop-guard` 拦住。

## 决定性验证（两条独立路径都复绿）

1. 克隆树加显式 `LOOP_KIT_PKG=/mnt/d/ctx/heren/loop-kit` 跑 tier1 → exit 0，五项全 ok
2. 把软链换成真目录副本（`cp -a`）后不带环境变量跑 tier1 → exit 0，五项全 ok；
   grok 的 shell 同时解封（开始正常跑突变探针）

另核：换链动作全程未在共享包内留下任何软链（`ls -la /mnt/d/ctx/heren/loop-kit/ | grep '^l'`
零命中），没有重演本日早先把自指软链建进共享包的事故。

## 顺带发现（正面）

降级态下 tier1 第 1 项「统一语言注册表完整（`term-lint --registry` exit 0）」是**假绿**——它期望
exit 0，而降级值恰好也是 0。真正逮住降级的是第 2 项黑名单方向（期望 exit 1）。双向检查在这里挣到
了它的位置：正向检查与降级值同号会被降级蒙蔽，反向检查不会。tier1 保留双向是对的。

## 结论

克隆树那条红与本刀改动零相关，也**不是**既有陈旧红，是评审环境接包姿势造成的假象，已修复。
实现工作树与主树的 `gate GREEN 1/1`（含 tier1）成立。

`real-run-trust` 那条陈旧红是真的，与本刀无关，另账。
