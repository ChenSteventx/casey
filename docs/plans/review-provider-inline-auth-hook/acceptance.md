# 验收冻结记录

## 首次红基线

- 原测试 sha256：`d75f3ae47f2c18a9fe881aca9e329041cf2e29028c9ad2ba3b7c1cc30f114add`
- 实跑：0/6，exit 1；hook、接线、AGENTS 均尚不存在。

## harness 修订与重冻

实现后发现当前 Node 24/WSL 下嵌套 `spawnSync + stdin pipe` 最小探针稳定死锁；改异步 spawn 后，完整 golden
进程的嵌套 stdout 管道捕获仍不稳定，而同代码最小探针可读。没有放宽超时或删除语义断言，最终改为：

1. hook 零输入依赖，导出纯渲染函数；
2. golden 对三类合法提示、空输入和坏 JSON 均真实启动生产 CLI 主入口；
3. 子进程 stdout/stderr 落到每次运行独占的临时文件后断言，规避当前环境的嵌套 pipe 捕获缺陷；
4. 每次均断言 exit 0、无 signal、stderr 为空、stdout 为唯一合法 hook JSON，三类提示与空/坏输入输出恒定；
5. 静态棘轮补禁 `process.stdin`、readline、裸模块导入、动态 import、子进程与网络能力；
6. CLI 主入口显式等待 stdout write callback；
7. `CASEY_REVIEW_PROVIDER_HOOK=bin/does-not-exist-provider-hook.mjs` 红控实跑 2/6、exit 1；
8. 默认路径实跑 6/6 GREEN。

- Grok R1 指出纯函数验收未覆盖生产进程入口；上述 2–5 项为对应修复。
- 最终重冻测试 sha256：`6c156d7c287de6cf2d7dd19a9da1704beb40f9bc437e0bff8131388d0fc2eb22`
- Steven 于 2026-07-21 在本会话中针对上一条消息所列唯一完整 SHA256 明确回复「批准」；精确人签已落 `HUMAN-SIGN.md`，契约可以进入最终收口。
