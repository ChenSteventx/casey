# 债务登记表：semantic-lock 准入门陈旧绿全套件

> 依 Steven 2026-07-19 选项三（收窄本契约 + 全债记账）产出。enforcement `9ee2731`→`dfee72c`（2026-07-17）落地未迁移测试套件，把整个 hermetic 浏览器回放金牌套件打成陈旧绿。本表钉死全貌，供后续 sweep 契约系统清偿。数据由 `loop/prd-*.json` 静态扫描 + 波 0/抽验实证得出（`scratchpad/debt-classify.json`）。

## A. 本契约（replay-admission-hermetic-migration）负责迁到真绿的 17 金牌闭包

5 核心 prd（p5-replay / wf-publish-states / replay-settle-mount / drawer-lock-hardening / replay-nth-visible-hardening）的 s2 回归闭包，迁完即本契约验收面达成：

```
wf-publish-states  p5-replay  replay-nth-visible-hardening  kinds-harden  run-history
chiefcomplaint-smoke  layer3-wiring  wf-open-smoke  wf-open-node  wf-add-node
wf-connect-nodes  wf-set-node-field  wf-select-node-dropdown  flow-bridge  p3-compile
e2e-chain  drawer-lock-hardening
```
- 已迁完：`replay-settle-mount`（波 1，16/16 绿）。
- 结构性阻塞（不可迁、走墓碑）：`p5-replay` 的 drift/vanished 两案——见 `DRIFT-VANISHED-DECISION.md`（正向漂移在现役内核不可达，待 Steven 人签墓碑吊销）。

## B. 复签即真绿集（18 prd）——本契约连带清偿

冻结某个 A 组金牌、且不跑 A 组之外的准入门红金牌。迁完 17 金牌 + 复签这 17 的 checksum 后，其 gate 真绿：

| prd | 冻结的 core17 金牌 | 当前 passes | 迁后预期 |
|---|---|---|---|
| chief-bringup | chiefcomplaint-smoke | [T] | 真绿 |
| chiefcomplaint-smoke | chiefcomplaint-smoke | [T,T] | 真绿（现陈旧绿）|
| drawer-lock-hardening | drawer-lock-hardening | [F,F] | 真绿（波0已翻红）|
| e2e-chain | e2e-chain | [T] | 真绿（现陈旧绿）|
| integrate-regress-agent-tool-slice | flow-bridge | [T] | 真绿（现陈旧绿）|
| kinds-harden | kinds-harden | [T,T] | 真绿（现陈旧绿）|
| layer3-wiring | layer3-wiring | [T,T] | 真绿（现陈旧绿）|
| p3-compile | p3-compile | [T,T] | 真绿（现陈旧绿）|
| p5-replay | p5-replay | [F,T] | 真绿（波0已翻红 s1；drift/vanished 阻塞见 A）|
| replay-nth-visible-hardening | replay-nth-visible-hardening | [F,F] | 真绿（波0已翻红）|
| run-history | run-history | [T,T] | 真绿（现陈旧绿）|
| wf-add-node | wf-add-node | [T,T,T] | 真绿（现陈旧绿）|
| wf-connect-nodes | wf-connect-nodes | [T,T] | 真绿（现陈旧绿）|
| wf-open-node | wf-open-node | [T,T] | 真绿（现陈旧绿）|
| wf-open-smoke | wf-open-smoke | [T,T] | 真绿（现陈旧绿）|
| wf-publish-states | wf-publish-states | [F,F] | 真绿（波0已翻红）|
| wf-select-node-dropdown | wf-select-node-dropdown | [T,T] | 真绿（现陈旧绿）|
| wf-set-node-field | wf-set-node-field | [T,T] | 真绿（现陈旧绿）|

注：标「现陈旧绿」的 14 个当前 passes:true 但 gate 实为准入门红。迁移把它们从陈旧绿转真绿；本契约收口前对每个复跑 gate 使 passes 与真状态一致。

## C. 翻红集（12 prd）——本契约翻红记账、留 sweep 契约清偿

自身跑 A 组之外的准入门红金牌（7 个额外红金牌：`btn-enable-ops` `p2-sign` `replay-login-bootstrap` `replay-video` `video-login-carry` `wf-history-version` `output-seal`）。改 17 金牌破其 checksum → 复签这 17 条目（文件确实改）；但其 gate 仍因额外红金牌 RED → **翻红 passes 记账，不靠复签当绿**：

| prd | 跑的额外红金牌 | 当前 passes | 处置 |
|---|---|---|---|
| btn-enable-ops | btn-enable-ops, wf-history-version | [T,T] | 翻红 → 登记 |
| caseid-echo-mask | p2-sign | [T,T] | 翻红 → 登记 |
| flow-bridge | wf-history-version | [T,T] | 翻红 → 登记 |
| ingest | wf-history-version | [T,T] | 翻红 → 登记 |
| login-traffic-drop | replay-login-bootstrap | [T] | 翻红 → 登记 |
| output-seal | output-seal, p2-sign | [T] | 翻红 → 登记 |
| plan-debt-sweep | p2-sign | [T,T] | 翻红 → 登记 |
| replay-login-bootstrap | replay-login-bootstrap | [T,T] | 翻红 → 登记 |
| replay-video | replay-login-bootstrap, replay-video, wf-history-version | [T,T] | 翻红 → 登记 |
| sign | p2-sign, replay-video, wf-history-version | [T,T] | 翻红 → 登记 |
| video-login-carry | replay-login-bootstrap, replay-video, video-login-carry | [T,T] | 翻红 → 登记 |
| wf-history-version | wf-history-version | [T,T] | 翻红 → 登记 |

## D. sweep 契约范围（后续）

7 个额外准入门红金牌待迁：`btn-enable-ops` `p2-sign` `replay-login-bootstrap` `replay-video` `video-login-carry` `wf-history-version` `output-seal`。迁完 + C 组 12 prd 复跑翻绿即全套件清偿。同 A 组配方（committed events 夹具 + mint lock + caseId prd 注册 + `--entity-locks`/`--entity-authority` 接线），注意逐个核是否另有结构性阻塞（如 `replay-video`/`video-login-carry` 可能带真凭据/登录引导路径，须确认 hermetic 边界）。

## 说明：为何区分复签与翻红（护栏 #19 + fidelity-audit 翻真纪律）

- **复签 checksum**：金牌字节确实改了（加 `--entity-locks` 接线 + 改读夹具 events），其 sha256 变了，所有冻结它的 prd 须更新为新值——这是如实记录文件新状态，确定性、只碰改动金牌的条目。
- **翻红 passes**：C 组 prd 的 gate 仍因 17 之外的红金牌失败，其 `passes:true` 是陈旧绿。**绝不靠复签让 ratchet 匹配就当绿**（那会掩盖债务、撞 fidelity-audit）——必须跑 gate 让裁判把 passes 覆写为真红，债务显式可见。
