# sut-503-diagnosis · 真机差分证据账

日期：2026-07-27  
范围：只诊断，不修改 Casey 生产实现、冻结断言或被测系统。

## 结论先行

本轮未复现 503。新建且列表中唯一的 `atl_` 骨架智能体在创建后首次进入详情页时：

- `GET /ai-manager/agentPlus/queryPlus` → HTTP 200；
- `GET /ai-manager/agent/setup/getAgentDetail` → HTTP 200；
- 页面可见“操作失败!”计数为 0；
- 同次截图视觉复核未见失败提示，录屏文件已落盘。

因此不能把 7 月 23 日的双 503 精化成“所有标准表单新建骨架智能体必现”或“任一新实例必现”。
现有最窄边界是：7 月 23 日两个不同实例稳定出现双 503；7 月 24 日第三个不同实例的编译观察
为双 200；7 月 27 日本轮新实例首次打开也为双 200。候选解释收敛到短时服务事故、初始化时序
或未隔离的配置/构建差异，尚不能在客户端证出唯一根因。

本轮浏览器探针不是 Casey 裁判，不生成或改写四态。`SUT_DEFECT` 仍只引用 7 月 23 日同次真实
回放的 `verdict.json`、`axes.json`、录屏与视觉复核。

## 真机前置

| 前置 | 本次事实 | 结果 |
|---|---|---|
| `casey doctor` | Node、Playwright、Chromium、中文字体、`site.json` 与凭据形态均 ok | exit 0 |
| 凭据文件 | 只核 `.auth` 是目录、`site.json` 是普通文件；未读取、搜索或回显内容 | exit 0 |
| 账户身份 | 只引用 HANDOFF 中 Steven 已带外确认测试账户的历史事实；本轮没有虚构新的带外确认 | 历史前提 |
| 初始隧道 | doctor 如实报回环未监听；首次回环 `curl` 无法连接 | curl exit 7 |
| 隧道恢复 | 按 runbook 先 WSL 监听、后 Windows 代理；`lsof` 见 15519 恰一监听 | 满足 |
| WSL 回环真实 HTTP | 只向 `127.0.0.1:15519` 发请求，返回 HTTP 200、`text/html` | exit 0 |
| 同账户 UI | 全程只有本 agent 一条浏览器链 | 满足 |

取证结束后已主动停止本轮启动的 WSL/Windows 隧道进程；两条长运行命令均因人工 `Ctrl-C`
结束为 exit 1，属于有意收尾，不是 SUT 失败。

## r1 / r2 / r3 执行账

| 轮次 | 结果 | SUT 样本资格 | 退出码 |
|---|---|---|---:|
| r1 | 输出类型下拉文案定位 fail-closed；确认创建前中止；0 目标响应、0 打开尝试 | 不计样本 | 1 |
| r2 | 同一定位问题；确认创建前中止；0 目标响应、0 打开尝试 | 不计样本 | 1 |
| r3 | A 件创建并首次进入详情；两目标端点均 200、无失败提示；后置“卡副标题=编码”假设不成立而中止 | 有效 HTTP/视觉诊断样本；不是 verdict | 2 |
| 专用清理 | A 精确名称 1→0；B 从未创建，0→0 | 清理证明 | 0 |

r3 的 exit 2 来自探针后置证据门和原自动清理未能按错误编码面定位，不改写此前已收到的两条
HTTP 200 事实。发现残留后先停实验，再用本轮预检为零、提交后恰一的精确名称所有权链清理。

## 端点、状态与最小响应形态

| 端点 | 方法/参数形态 | 状态 | 响应头/体最小形态 |
|---|---|---:|---|
| `/ai-manager/agentPlus/queryPlus` | GET；无查询参数 | 200 | `application/json`；65–512 字节；顶层含 `status/msg/data`，`data` 为 1 项数组 |
| `/ai-manager/agent/setup/getAgentDetail` | GET；`promptTemplateId` 为 19 位纯数字形态 | 200 | `application/json`；513–4096 字节；顶层含 `status/msg/data`，详情数据为对象 |

两响应均只保留字段形态、长度桶与摘要，不落 Cookie、凭据、真实地址或原始响应文本。
响应摘要分别为 `4d0b9dc58dd9832c`、`bbc25b2764804a3e`（响应体 SHA-256 前 16 位）。

## 变量矩阵

| 样本 | 实例/前提 | 执行面 | queryPlus | getAgentDetail | 视觉/裁定 |
|---|---|---|---:|---:|---|
| 2026-07-23 run-1 | 标准表单骨架实例 I1；19 位平台 ID | 正式 replay | 503 | 503 | 两请求归因 `atstep_3`；确定性 verdict：该步 `SUT_DEFECT` |
| 2026-07-23 run-2 | 不同实例 I2；与 I1 同测试名称/编码 | 正式 replay | 503 | 503 | 请求归因为空；verdict 机械 PASS；终帧两条失败提示，视觉复核 `INCONSISTENT` |
| 2026-07-24 候选反证 | 不同实例 I3；与 I1/I2 同测试名称/编码，平台 ID 再次不同 | compile observed | 200 | 200 | 只有编译观察，不是正式 replay、无新 verdict |
| 2026-07-27 r3 | 本轮预检为零后新建唯一 A 件；创建重定向后首次打开 | 浏览器诊断探针 | 200 | 200 | 失败提示 0；截图未见异常；不是 verdict |

前三个实例的平台 ID 均为 19 位纯数字且彼此不同；I1/I2/I3 同测试名称与编码。由此：

- 单一坏实例不能解释 7 月 23 日两个不同实例均 503；
- “相同测试名称/编码必触发”被 7 月 24 日同名同码第三实例双 200 反证；
- “任何刚创建骨架首次打开必触发”被本轮 r3 首次打开双 200 反证；
- run-1 `SUT_DEFECT` 与 run-2 PASS 的差异只由因果归因作用域解释，不能解释 HTTP 状态变化；
- 本轮未创建 B 件，故输出类型差分、刷新与列表重开均未隔离，不作结论。

## 清理证明

- A=`atl_503差分_0727_a`：提交前精确名称 0；创建后精确名称 1；专用清理后精确名称 0。
- B=`atl_503差分_0727_b`：未创建；清理核验前后均为 0。
- 删除目标只来自本轮预检为零、随后由本轮提交创建的精确 `atl_` 名称，没有触碰其他实体。
- 编码面未独立证明：r3 误把卡片副标题当创建编码，得到名称 1、所谓编码 0；该 DOM 假设已判无效。
  本轮只诚实背书名称面归零，不把错误的副标题查询冒充编码归零。

## 产物索引与摘要

本轮原始运行件均在 gitignored 的 `runs/sut-503-diagnosis/`：

- r1：`runs/sut-503-diagnosis/live-20260727-r1/`
- r2：`runs/sut-503-diagnosis/live-20260727-r2/`
- r3：`runs/sut-503-diagnosis/live-20260727-r3/`
- r3 脱敏账：`live-differential.json`  
  SHA-256 `ec248453f58699e4702c6d13157da39c048732facf6aab943fa8eadca54f595e`
- r3 首次打开截图：`A-first-open.png`  
  SHA-256 `228e59cd2a7af794d9483af788e2d612d29032a32b0b98a1f5fdb6a279b160f0`
- r3 录屏：`live-differential.webm`  
  SHA-256 `d0c847e2e553c29be78dfdce49b8fd42b99df1fbebb945317d0febdc533444ff`

历史正式证据：

- `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/replay1-{axes,verdict}.json`
- `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/`
- `runs/tc_agent_id_readback_real_uat_v1/run_c1_positive_live_20260724_r1/prep/observed-tc_agent_id_readback_real_uat_v1.json`

## 命令退出码与未决项

与行为结论有关的退出码：doctor 0；初始回环 curl 7；恢复后单监听+回环 HTTP 0；
脚本语法检查 0；r1 1；r2 1；r3 2；专用清理 0；历史脱敏解析 0；文件摘要 0。
首次在受限入口启动 Windows 代理只产生 WSL socket 错误且退出码未捕获，随后用批准入口成功启动；
不把未捕获值伪写成 0。`ffprobe` 不在环境中，格式探针 exit 127；`file` 已确认录屏为 WebM。

仍未决：

1. 7 月 23 日双 503 的服务端根因与精确持续窗口；
2. I1/I2 与 I3/r3 之间未冻结的配置、构建或初始化时序差异；
3. 首次打开、短等、刷新、列表重开的同实例时序矩阵；
4. 输出类型差分；
5. 本轮创建编码的独立归零面。

这些未决项不影响当前可行动结论：缺陷历史证据真实有效，但 2026-07-27 当前环境不可复现；
研发复现应同时携带 7 月 23 日双 503 正式回放证据与 7 月 24/27 双 200 反证，按短时事故或
初始化/配置差异方向查服务端日志，而不是把问题归咎于 Casey 的因果归因窗。
