# P0 真实 SUT 最终复验（2026-07-16）

## 环境与纪律

- WSL Linux Playwright/Chromium 通过 `casey doctor`；Windows→真站与 WSL 回环隧道均返回真实 HTTP 200。
- 三条业务链串行执行，避免共享登录态并发干扰。
- 未启动、连接或回放 fake-SUT / fixture。
- 每个测试用例独立 HTML、独立录像、独立视觉复核与附件清单。

## 最终结果

| 用例 | 真实 run | 确定性裁定 | cleanup | 录像 |
| --- | --- | --- | --- | --- |
| 发布状态 | `formal-publish-r4` | 4/4 PASS | 7/7 unique + identity readback；目标化计数归零 | 565,310 bytes |
| 历史版本 | `formal-history-r5` | 8/8 PASS | 7/7 unique + identity readback；目标化计数归零 | 886,226 bytes |
| CRUD | `formal-crud-r4` | 4/4 PASS | 7/7 unique + identity readback；目标化计数归零 | 593,108 bytes |

报告相对路径：

- `runs/p0-real-sut-20260716/formal-publish-r4/tc_wf_publish_states.report.html`
- `runs/p0-real-sut-20260716/formal-history-r5/tc_wf_history_version.report.html`
- `runs/p0-real-sut-20260716/formal-crud-r4/tc_catalog_wf_crud.report.html`

每份模型均有自然语言用例、18–29 条原子操作、可播放录像、10 项附件、`CONSISTENT` 视觉复核；HTML 六个必需区块齐全。

## 失败诚实账

`formal-publish-r3` 首次复验为 3 PASS + 1 NEEDS_HUMAN，进程 exit 1。根因是过宽 `[class*="message-box"]` 把同一确认框 6 个内部 BEM 节点误作 6 个新弹层；删除确认被 fail-safe 阻断，目标化断言正确报 `0→1`，没有假绿。

修复为 class token 边界后，失败实体由 `cleanup-p0pubr3` 单独真实回放清理：7/7 cleanup 原子均 unique、身份回读成功、确定性 verdict PASS，并有 159,539-byte 录像。

## 独立残留复核

`runs/p0-real-sut-20260716/residue-probe-r2/final-residue-probe.json` 由独立只读真实浏览器逐个精确搜索失败实体与三条最终实体，4 个 count 均为 0；同目录保存 4 张空结果截图。视觉人工复核与 JSON 一致。

## 独立代码复审

WSL 原生 Claude Code 2.1.211（Linux ELF x86-64）、Fable (`claude-fable-5`) xhigh 完成三轮只读审查：首轮 `CHANGES_REQUIRED` 发现实体锚假 PASS 风险；修复后二审 `ACCEPT`；真机发现选择器过宽并修正后，最终小 diff 三审再次 `ACCEPT`。记录见 `docs/plans/real-run-trust-fix/review/fable-wsl-xhigh-r2.md`。
