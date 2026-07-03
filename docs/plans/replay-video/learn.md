# learn — replay-video（full，2026-07-03，收口态）

六阶段走完：grill 四分岔 Steven 拍板（双 page 舞步 / 装配器直产 / `<video>` 可播 / run 缺省开启）→ plan → accept 红先行 7/10 红 → loop 单轮 gate GREEN 2/2 → codex 五轮 R5 PASS（9 采信 + 1 修正采纳 + 1 流程位说明，golden 10→13 检查、checksum 三签）→ learn。真机可播与登录不入镜目检挂 observability route:human，随真机停站合并行程。

1. **schema 预留位是最省的接线**：`attachments.video/videoAt` 与缺陷单 `videoAt` 三个契约前就冻在 schema 里，本契约零解冻直填——比 report-diagnostics 的路 B 旁件少一层呈现防线搭建。取舍口径可复用：schema 有位走直产，无位才绕旁件。
2. **二进制产物的凭据卫生 = 结构保证 + 清扫纪律**：文本凭据门管不住视频字节。四件套沉淀——登录跑独立 page 且其镜头必删（结构不入镜）；「扫前 → 限时关 → 关后补扫」铺满全部退出路径（unlink 不依赖浏览器配合，Linux 下写入中文件同样即刻离目录）；目录复用陈迹起录必清（缺席容忍才真缺席）；清扫豁免只随成功 `exit 0` 自然到期（任何 fail-closed 退出不留已收敛录像）。
3. **路径安全门要白名单不要黑名单**：`://` → 加拒冒号反斜杠 → percent-decode 后逐段白名单，三轮才收窄到位——substring 黑名单永远挡不住下一个编码变体（`//host`、`foo\bar`、`%2e%2e`），一步到位应写 decode 后白名单。生产者侧（装配器）比呈现层更严（纯文件名），两层同口径不同宽度。
4. **测试缝的边界一次划清**：`REPLAY_WATCHDOG_MS` env 缝（缺省 120s 零变）换来 V7 看门狗零残件机制锁，值得；monkeypatch Playwright 内部去强制 `context.close` 失败/`delete` 穷尽，不值得——hermetic 锁得住的锁死，锁不住的显式记残余走 route:human，绝不静默。
5. **凭据卫生维度是异构评审的主产区**：五轮 11 条发现里 8 条落在清扫时序、路径走私、陈迹归属——都是「gate 全绿但形态漏」的方向，实现者自测视角天然盲。full lane 最长评审轮次实证：lane 不豁免评审深度，评审深度也不吃 lane 档位。
6. **Playwright 1.60 recordVideo 机制事实**（复用备查）：context 级选项、每 page 各产一文件、`context.close()` 后才保证落盘、`Video.delete()/path()` 页关后可用、rename 保 inode（迟到写落在改名后文件内）。

配套：`loop/prd-replay-video.json`（checksum 终值 `f257ff05…`，passes 由 gate 写）；`tests/_golden/replay-video.golden.mjs` 13 检查；决策档 `docs/plans/replay-video/proposed/GRILL.md`（D1–D4 + M1–M8 + 冻结涟漪盘点，实测 p7-report 等十四条回归锁零涟漪全绿）；评审台账 `loop/audit.jsonl`（2026-07-03 replay-video 行）。挂账：mp4 转码（`ffmpeg-static`）随真机 webm 可播性结论决定去留；相5 自愈仍未吃过真 `HARNESS_ERROR`。
