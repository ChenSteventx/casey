# record-capture — grill 决策记录（示教兜底第一契约，full）

背景：Steven 已定示教兜底三决策：命名「示教」；录制物是语料不是签署；不开录制物直通回放通道。本契约只落第一段 `record-capture`，给人工操作一个安全采集入口，后续 `record-intake` / `record-distill` 再消费。

## D1 范围：只采集，不蒸馏，不回放

- 定夺：`casey record` 只产示教录制包，供后续蒸馏。它不生成 `events.json`，不生成 `expected.frozen.json`，不写 `loop/prd-*.json`，也不触发 `casey replay`。
- 理由：录制物没有过相1 编译闸、相2 草拟闸、人签门和 L0 复核；把它直通回放会绕过 Casey 的七相纪律。

## D2 车道：full

- 定夺：full。新增用户可见 CLI，碰 `bin/`，并且涉及真机、登录态和输出卫生。
- 验收：先写金牌红基线，再实现，再 gate。真浏览器人工录制为 route:human，命令化层只钉包形状与安全不变量。

## D3 CLI 形态

- 定夺：`casey record <caseId> --sut <baseUrl> --out-dir <dir> (--login-bootstrap|--no-login) [--from-events <file>] [--headless] [--max-ms <ms>]`。
- `--sut` 只允许回环隧道基址或 hermetic 夹具地址；真实目标地址只活在 `site.json`。
- `--login-bootstrap` 用既有登录预备动作；`--no-login` 仅用于已登录态或 hermetic。两者都不传则 exit 64，防用户手输账号密码被录进包。
- `--from-events` 是验收/应急入口：把已有原始事件投影成同款安全包，不开浏览器。

## D4 输出包

- 定夺：只落一个 JSON 包：`<outDir>/<caseId>/record-capture/teach-in-capture.json`。
- 包内硬写三字段：`signed:false`、`replayReady:false`、`distillRequired:true`。
- URL 只保留 pathname + search，任何 `://` 都不得落盘；输出前过 `credentialGate`，命中则整包拒写。

## D5 录制事件最小集

- 定夺：第一版只采 click / dblclick / fill / press / nav 五类通用动作，字段包括 action、path、selector、text、tagName、fieldLabel、value、key、坐标元数据。
- fill 值若来自敏感字段或命中凭据门则拒写或遮值；凭据卫生优先于可用性。
- 画布拖拽、节点字段上下文等 autotester 高级补采不在本契约内，后续由 `record-distill` 或专门契约补齐。

## D6 非目标

- 不接 `record-intake`，不写失败记录台账。
- 不接 `record-distill`，不产 flow mapping。
- 不改 `replay` / `verdict` / `report` 冻结内核。
- 不代替人签，不绕过相2。

## D7 易用性关联

本契约完成后，易用性线必须给出三条真实可跑用例路径：输入文件、命令、退出码、产物目录、报告位置。示教录制包可以成为其中一条的前置材料，但不能被描述成可直接回放的正式用例。
