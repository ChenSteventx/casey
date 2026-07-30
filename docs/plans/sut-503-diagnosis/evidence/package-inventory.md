# sut-503-diagnosis · 上报包证据盘点

盘点范围：只读 `real-uat-attestation` 已有持久账与本地忽略运行产物；未访问、启动或连接任何真实/假 `SUT`，未运行 `doctor` 后的网络探测，未读取 `.auth/` 或 `site.json`。

本文件为上报包的本地证据索引，不代表可以把原始产物直接外发。对研发的最小正文见 [`../defect-report.md`](../defect-report.md)。

## 证据链结论

1. run-1 / replay1 是四态裁定权威：详情打开动作 `unique`、候选 1、身份读回成功；两个端点均为 503 且都归因 `atstep_3`；`envelopeOk=false`；确定性 verdict 为 `SUT_DEFECT`。
2. run-2 / run2-replay1 是跨实例复现与视觉权威：同样唯一打开且两个端点仍为 503，但两条记录的 `attributedStepId=null`；确定性 verdict 为 2/2 `PASS`；视觉复核为 `INCONSISTENT`，终帧两条“操作失败!”。
3. 两次裁定差异是取证归因作用域差异，不是 503 有无差异。run-2 `PASS` 不等于 503 消失。
4. replay2/run2-replay2 是同名多卡不点击的反证，不是详情页缺陷复现样本。
5. `SUT_DEFECT` 只由 run-1 verdict、axes 取证链及 Steven 人签引用；本盘点不自行裁定。
6. 2026-07-24 的不同候选实例与 2026-07-27 的全新唯一实例均为双 200；截至 7 月 27 日当前环境不可复现。近期成功观察不撤销历史缺陷取证。
7. 7 月 27 日 r1/r2 在创建前 fail-closed，0 目标响应、0 打开尝试，不计 `SUT` 样本；r3 exit 2 发生在双 200 与视觉证据采集之后，不改写 HTTP 事实。

## 关键证据清单

| 证据 | SHA-256 | 角色 | 外发处理 |
|---|---|---|---|
| `docs/plans/real-uat-attestation/evidence/uat-run.md` | `b5954a6195e441152b515368e9ea09015d97bd7869c5905ae54bf602661c6262` | 两实例执行史、503 缺陷账、归因边界权威 | 已按项目纪律脱敏，可随仓引用 |
| `docs/plans/real-uat-attestation/evidence/uat-signoff.md` | `29a3a0294f65b4d0346695a16d6ddb34b3e9ca01dae16b3637ac77838579a91c` | Steven 采认 `SUT_DEFECT` | 已按项目纪律脱敏，可随仓引用 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/replay1-axes.json` | `795cc3d2638e2bc6712acb4b74fe96eee2f0a64180211ad1c3b4266a20999044` | run-1 本步双 503 原始 axes | 本地原件；只外发另制的脱敏摘录 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/replay1-verdict.json` | `bb9fdd396a0b96e82c204c5d13135879599eee07ce424df2aa2f242debc4635a` | run-1 确定性 `SUT_DEFECT` | 核查字段后随脱敏包附 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/report1/tc_agent_id_readback_real_uat_v1.report.json` | `e38fdde9b74e01720d7368604610ae76c6b6f0ef87c00246e108532d0499dee1` | run-1 历史报告模型 | 旧包附件不完整；仅作溯源 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/axes.json` | `e4ac5201553ab2dcc5305cd8b909e09882301e587293ffe9856857d0a5168786` | run-2 双 503、空归因原始 axes | 本地原件；只外发另制的脱敏摘录 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/verdict.json` | `29b63e5c1f36006bf4eca6a84d4ca095fee7b4aec7504031e0354d706b9b6074` | run-2 机械 `PASS` | 可用于解释作用域，不得写成无缺陷 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/visual-review.json` | `c47a4bf626133ffbcab63b003a67c7338534b09f0a45444583063fe3a9d13b11` | run-2 视觉 `INCONSISTENT` | 正文可摘录结论；原件先核元数据 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/frames/atstep_2.png` | `027e310d28078bc0695c2485679cc3d5757ff0fdaf970fcd4bba0613243b77ca` | 详情已开、尚无失败提示的中间帧 | 含界面元数据；遮盖后再外发 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/frames/end.png` | `a39c57963de42f1e25654be52b9748480d184e6d477c9750d055b82ad6f77b35` | 两条“操作失败!”终帧 | 含界面元数据；遮盖后再外发 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/video.webm` | `5d93e93d31a07b72b06bd22dbe053926060ba954dfe4f176e868640d76f15e1b` | run-2 同次完整录屏 | 含界面元数据；遮盖后再外发 |
| `runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/tc_agent_id_readback_real_uat_v1.report.json` | `b086240f6311cb1e3d713740d791f820419d33532a591c35f1d451bb1ada2f2c` | run-2 完整报告模型 | 本地原件；只外发最小脱敏包 |
| `docs/plans/sut-503-diagnosis/evidence/live-differential.md` | `fa383c9d68d96bb27aa7ac80bdfced5666c3bc8a2815f6ae0307f3a92eab5bf9` | 7 月 27 日差分、样本资格与清理权威 | 已脱敏，可随仓引用 |
| `runs/tc_agent_id_readback_real_uat_v1/run_c1_positive_live_20260724_r1/prep/observed-tc_agent_id_readback_real_uat_v1.json` | `ec40e880d17af99912fd040d1e0441901e9d0e9da5e402f06929235247585aca` | 7 月 24 日不同实例双 200 编译观察 | 本地原件；只外发脱敏结论 |
| `runs/sut-503-diagnosis/live-20260727-r1/live-differential.json` | `797ad8c5805802c0cb812c39c579a2bd2b7d05bab4030c62501af423a1e0876b` | r1 创建前中止、非样本 | 本地原件；不作为 HTTP 附件 |
| `runs/sut-503-diagnosis/live-20260727-r1/live-differential.webm` | `cdd5aa0650077b39d723c458c5a7b7a2b243c1e6f6a5a165412c2fe7f756009f` | r1 诊断录屏、非缺陷样本 | 含界面元数据；不外发 |
| `runs/sut-503-diagnosis/live-20260727-r2/live-differential.json` | `4db7f4af5fcc68d0260da5be4c60a97cc301a3756b06bfc8c9514df3b04b99ff` | r2 创建前中止、非样本 | 本地原件；不作为 HTTP 附件 |
| `runs/sut-503-diagnosis/live-20260727-r2/live-differential.webm` | `32f49030303f0aed5fc0d562c9f37d1be371e15d5fb7ce7b1a7861ee6539bee3` | r2 诊断录屏、非缺陷样本 | 含界面元数据；不外发 |
| `runs/sut-503-diagnosis/live-20260727-r3/live-differential.json` | `ec248453f58699e4702c6d13157da39c048732facf6aab943fa8eadca54f595e` | r3 双 200 与最小响应形态 | 已做结构脱敏；外发前再核元数据 |
| `runs/sut-503-diagnosis/live-20260727-r3/A-first-open.png` | `228e59cd2a7af794d9483af788e2d612d29032a32b0b98a1f5fdb6a279b160f0` | r3 首次打开无失败提示 | 含账户、实体与页面标识；遮盖后再外发 |
| `runs/sut-503-diagnosis/live-20260727-r3/live-differential.webm` | `d0c847e2e553c29be78dfdce49b8fd42b99df1fbebb945317d0febdc533444ff` | r3 同次录屏 | 含界面元数据；遮盖后再外发 |

## run-1 与 run-2 证据覆盖差异

| 维度 | run-1 / replay1 | run-2 / run2-replay1 |
|---|---|---|
| 新实例 | 实例 A | 实例 B |
| 动作正确性 | `unique`、候选 1、读回成功、详情路由成功 | `unique`、候选 1、读回成功、详情路由成功 |
| 双端点状态 | 两条均 503 | 两条均 503 |
| 归因 | 两条均 `atstep_3` | 两条均 `null` |
| 信封断言 | `envelopeOk=false` | 详情打开步 `envelopeOk=true` |
| verdict | `SUT_DEFECT` | 2/2 `PASS` |
| 视觉 | 旧包无同次完整录屏 | `INCONSISTENT`；中间帧无提示、终帧两条失败提示 |
| 报告附件 | 历史包，缺同次完整录屏/附件闭环 | 三形态报告、axes、verdict、历史、指标、录像清单、录像、视觉复核与帧齐全 |
| 适合承担的事实 | 四态裁定与本步 503 取证 | 跨实例复现、晚到异常与完整视觉交付 |

## 已完成的脱敏摘要

下列字段足以支撑当前报告，不复制原始敏感值：

| 运行 | 端点路径 | HTTP 状态 | `attributedStepId` | 信封期望/实际 |
|---|---|---:|---|---|
| run-1 | `/ai-manager/agentPlus/queryPlus` | 503 | `atstep_3` | 200 / 503 |
| run-1 | `/ai-manager/agent/setup/getAgentDetail` | 503 | `atstep_3` | 200 / 503 |
| run-2 | `/ai-manager/agentPlus/queryPlus` | 503 | `null` | 200 / 503 |
| run-2 | `/ai-manager/agent/setup/getAgentDetail` | 503 | `null` | 200 / 503 |
| 2026-07-24 候选观察 | `/ai-manager/agentPlus/queryPlus` | 200 | 编译观察 | 200 / 200 |
| 2026-07-24 候选观察 | `/ai-manager/agent/setup/getAgentDetail` | 200 | 编译观察 | 200 / 200 |
| 2026-07-27 r3 | `/ai-manager/agentPlus/queryPlus` | 200 | 浏览器诊断探针 | 200 / 200 |
| 2026-07-27 r3 | `/ai-manager/agent/setup/getAgentDetail` | 200 | 浏览器诊断探针 | 200 / 200 |

所有路径已去除协议、主机、查询串和实体标识。7 月 27 日两个成功请求均为 `GET`：`queryPlus` 无查询参数，`getAgentDetail` 只保留“详情标识为 19 位纯数字形态”。成功响应均为 `application/json`，顶层含 `status/msg/data`；前者 `data` 为 1 项数组，后者详情数据为对象。该形态不能倒推出 7 月 23 日 503 响应体。

## 2026-07-27 样本与清理边界

- r1/r2：都因输出类型下拉文案定位失败，在确认创建前中止；0 目标响应、0 详情打开，不计样本。
- r3：新建唯一实例首次打开，双端点 200、失败提示 0；有效 HTTP/视觉诊断样本，但不是 verdict。
- r3 exit 2：来自后置证据门和原自动清理依赖的错误“卡副标题=创建编码”假设，不改写双 200。
- 专用清理：本轮实例精确名称计数 1→0；另一候选从未创建，保持 0。
- 编码面未决：错误 DOM 假设不能证明编码归零，只背书名称面归零。

## 当前未决

- 7 月 23 日双 503 的服务端根因和精确持续窗口；
- 7 月 23 日失败实例与 7 月 24/27 成功实例之间未冻结的配置、构建或初始化时序差异；
- 刷新、列表重开、输出类型差分和两端点独立/连带失败；
- 本轮创建编码的独立归零面。
