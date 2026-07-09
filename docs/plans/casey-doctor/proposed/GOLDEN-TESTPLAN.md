# casey-doctor — 红先行金牌测试计划

> 起草态：本文只给断言清单与形态意图，**不写完整测试代码**（实现者据此写红金牌、验红、再实现）。
> 载体：新建 `tests/_golden/doctor.golden.mjs`。主体是**纯函数层注入测试**（构造假 `env` 逐项翻红绿——full 车道 hermetic 可验的支点），外加一段**采集壳 hermetic 冒烟**（真跑 `casey doctor` 验结构与零泄漏，不苛求绿）。红先行：先把断言写全 → 跑一遍确认红（`lib/doctor.mjs` 未建，`import` 即失败）→ 再实现纯层、采集壳、门面。
> 不 rig：纯层测试注入的是**探针已解析的布尔/平台/端口结果**，不倒着裁定；零泄漏测试复现 `AT_SITE_JSON`/`AT_CREDS_FILE` 既有接缝喂含哨兵密文的真临时夹具，验采集壳真不漏，不手写假输出蒙混。

## 现状红基线（实现前跑，应红在这些点）

- `import { runDoctor } from '../../lib/doctor.mjs'` 解析失败（文件未建）——全红。
- `casey doctor` 命令未接（`main()` 无 `case 'doctor'`）→ exit 64「未知命令」，采集壳冒烟红。

## 断言清单

### A1 全就绪 → exit 0 逐项 `ok`

- 构造 `env` 全就绪：`nodeVersion:'22.12.0'` / `requiredRange:'>=22.12'` / playwright `present:true`+`importable:true` / chromium `execResolved:true`+`execExists:true` / 字体 `cjkProbeNonEmpty:true` / `site.json` `present:true`+`shapeOk:true` / 凭据 `present:true`+`shapeOk:true` / 隧道 `portListening:true`。
- 断言 `runDoctor(env).exitCode === 0`；`items` 每条 `status` ∈ `{ok, route-human}`（隧道恒 `route-human`），无 `fail`/`warn`。

### A2 缺 `@playwright/test` → 报红带建议非崩

- `env` 就绪级把 playwright `present:false`（其余全就绪）。
- 断言：该项 `status==='fail'`、`hint` 非空且含 `npm install` 意图字样；`runDoctor` 不 `throw`；`runDoctor(env).exitCode===1`。

### A3 缺 chromium → 报红带建议

- `chromium.execExists:false`（`import` 成功但浏览器二进制不在位）。
- 断言：该项 `fail`、`hint` 含 `playwright install chromium` 意图；`exitCode===1`。
- 附：`importable:false`（装了但加载失败）单独一例 → 第 3 项 `fail`、`hint` 指重装依赖（区别于第 2 项「文件不在位」）。

### A4 node 版本过低 → 报红指 engines

- `nodeVersion:'20.10.0'` + `requiredRange:'>=22.12'`。
- 断言：node 项 `fail`、`hint` 报当前版本与要求范围（版本号非敏感，可回显）；`exitCode===1`。
- 边界例：`'22.12.0'` 恰等于下界 → `ok`；`'22.11.9'` → `fail`（验纯层 semver 手写比较正确、无 off-by-one）。

### A5 中文字体缺 → `warn`，不翻 exit

- `env` 就绪级全 ok，仅字体 `cjkProbeNonEmpty:false`。
- 断言：字体项 `status==='warn'`（非 `fail`）；`runDoctor(env).exitCode===0`（就绪级全 ok，`warn` 不翻）；字体项 `hint` 非空。
- 语义注释：字体缺只令截图/录屏空白、DOM/断言不受影响（HANDOFF 实锤），故 `warn` 不 `fail`。

### A6 凭据/`site.json` 缺失 → 清晰指引，不翻 exit

- `env` 就绪级全 ok，`site.json` `present:false` 与凭据 `present:false`。
- 断言：两项各 `status==='warn'`、`hint` 指 `README.md` 凭据节（不含任何真值）；`exitCode===0`（缺真机件绝不惩罚 hermetic 装机）。
- 形态不符例：`present:true` 但 `shapeOk:false` → `warn`、`detail` 只报「顶层缺 `xxx` 键」这类结构信息，断言 `detail`/`hint` 全文零字段值。

### A7 输出零敏感值零真目标地址（采集壳，复现真接缝）

> 复现 `AT_SITE_JSON`/`AT_CREDS_FILE` 冻结接缝，不 rig：喂真临时夹具、验采集壳真不漏。

- 备料：`mkdtemp` → 写临时 `site.json`（`{ "target": { "startUrl": "https://SENTINEL-TARGET.invalid/x", "devProxyUrl": "http://127.0.0.1:15519" } }`）+ 临时 `credentials.json`（`{ "user":"SENTINEL-USER", "pass":"SENTINEL-PASS-9x9" }`）。
- 跑：`spawnSync(node, ['bin/casey.mjs','doctor'], { env: { ...process.env, AT_SITE_JSON:<临时>, AT_CREDS_FILE:<临时> } })`。
- 断言 `stdout+stderr` 合并文本：
  - 零 `SENTINEL-TARGET` / `SENTINEL-USER` / `SENTINEL-PASS-9x9` 任一字面量。
  - 零裸 `://`（无 URL 形态目标地址泄漏；回环 `127.0.0.1:<port>` 若出现须是纯端口表述、不带 `://` 前缀的真 host——实现用只报端口号规避）。
  - 零 `FORBIDDEN_KEYWORDS`（可直接调 `lib/cred-gate.mjs` 的 `credentialGate({doctorOutput:text})` 断言 `ok:true`，或调 `collectSecretLiterals` 逐一 `!includes`）。
  - 零用户绝对路径回显（无 `<临时目录绝对路径>` 出现——output-seal）。
- 语义：证采集壳查 `site.json`/凭据在位与隧道端口时，真的一个值都没漏。

### A8 隧道项标 `route:human`，不阻塞主判

- 纯层：`checkTunnel({portListening:true})` 与 `{portListening:false}` 两例，断言 `status==='route-human'` 两者皆是（在听/不在听都不翻退出码、都不进就绪级）；`detail` 只述「端口在听/不在听 + 耗时」、零 `target` 地址。
- 聚合：把隧道设 `portListening:false`、其余就绪级全 ok → `runDoctor(env).exitCode===0`（隧道从不驱动退出码）。

### A9 OS 分支建议正确

- 三注入：`{platform:'linux',isWSL:false}` / `{platform:'linux',isWSL:true}` / `{platform:'darwin'}` / `{platform:'win32'}`，字体均 `cjkProbeNonEmpty:false`（触发 `hint`）。
- 断言各 `checkFonts` 的 `hint`：linux/`WSL` → 含 `fc-list` 与 Noto Sans CJK 意图；`darwin` → 含 PingFang/苹方意图；`win32` → 含微软雅黑/`Fonts` 目录意图。
- 路径分隔符断言：win 分支文案用 `\`、其余用 `/`（若 `hint` 含路径示例）。
- `isWSL:true` 与 `isWSL:false`（纯 linux）字体 `hint` 可同（都查 `fc-list`），但隧道/上手语境文案可分——本项只钉字体 `hint` 家族正确。

### A10 采集壳 hermetic 冒烟（结构与不崩，不苛求绿）

- 真跑 `spawnSync(node, ['bin/casey.mjs','doctor'])`（不带 `AT_*` 覆盖，用本机真环境）。
- 断言：
  - `status ∈ {0,1}`（就绪与否都不崩、不 exit 2/3/64）。
  - `stdout` 含全部八项 `id` 的行（逐项都渲染了，无静默漏项）。
  - 不 `throw`、无未捕获异常栈。
  - 仍过 A7 的零泄漏口径（本机若有真 `site.json` 也不漏）。
- 说明：本机 chromium 可能未装 → 该例可能 exit 1，断言的是**结构与安全**而非退出码为 0（红先行不把「本机装齐」当前提）。

## 涟漪回归（金牌外，gate acceptance 覆盖）

- `node bin/casey.mjs selftest --tier1` 无回归（未碰其链路）。
- `README.md` 写入过 `term-lint`（PostToolUse hook 扫）。
- 若触发跨契约涟漪（`mcp-parity` 的 `CLI`⊆`MCP` 覆盖断言已落地）：`doctor` 进 `EXCLUDED` 后 `node tests/_golden/cli-mcp-face.golden.mjs` 全绿（不因新 `case 'doctor':` 误报「`casey_doctor` 工具缺失」），并重签 `loop/prd-cli-mcp-face.json` 后 gate 复跑仍绿。

## 不做（本金牌不覆盖，留 route:human）

- 隧道 green 端到端（经真隧道到真站通）——非 hermetic，route:human（审计 R1/R3 家族）。
- 真 macos/原生 win/纯 linux 上字体探测与建议实机核验——route:human（审计 F14 尾巴）。
- 不 mock playwright 的真 `import`/`chromium.executablePath()`——纯层测试注入布尔即可；采集壳对 playwright 的真探测由 A10 本机冒烟顺带覆盖，不额外造假浏览器夹具。
