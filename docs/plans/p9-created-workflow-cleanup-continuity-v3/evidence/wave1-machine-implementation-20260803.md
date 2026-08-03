# P9 v3 Wave 1 机器实现证据（2026-08-03）

## 执行环境与基线

- 主执行环境：Windows 11，PowerShell，Node.js v22.12.0，Windows 原生 Playwright Chromium。
- 补充交叉环境：WSL Ubuntu，Node.js v24.18.0；只用于零 SUT 邻接测试，不代替 Windows 真浏览器证据。
- 起始分支与提交：`dev`，`d77dfb5fc489c26bd15d18ab2470d3fbffa645f2`。
- 独立工作树：`D:\ctx\heren\casey-p9-waves`，分支 `codex/p9-waves`。
- 原 `dev` 工作树在开始时有未提交改动；本工作树从真实 HEAD 建立，未覆盖、删除或重置原改动。

绑定摘要：

- plan：`cc2fff73fb15fb9c983e31cf79d4b0b1f87925903282427de5f13ac3d4dc955c`
- PRD：`ab806b98056b8aec248a919d68af9cf215f6329f6c6b4611b2035d230d21d674`
- package lock：`44897ee7221db64f53fa7315b6eb59cfeb70f441832f60cfa86c816f5da19afe`
- 本地只读探针使用的通道剖面：`65720124cb3815b20dfc87dbe1400da3cdc01d4253d862de20835e61d1485b8b`

## 冻结红基线

实现移入本工作树前真实执行，四条均 exit 1：

- `node tests/_golden/p9-created-workflow-continuity-v3.role-compile-sign.zero-sut.golden.mjs`：5 过 / 4 红。
- `node tests/_golden/p9-created-workflow-continuity-v3.created-in-run.zero-sut.golden.mjs`：0 过 / 8 红。
- `node tests/_golden/p9-created-workflow-continuity-v3.stable-absence.zero-sut.golden.mjs`：0 过 / 8 红。
- `node tests/_golden/p9-created-workflow-continuity-v3.tier2-cleanup.zero-sut.golden.mjs`：0 过 / 6 红。

四枚冻结测试字节未修改；`gate --dry` 的 ratchet 检查全部通过。

## 机器绿证

Windows PowerShell 实跑：

- 四枚冻结测试分别 9/9、8/8、8/8、6/6，均 exit 0。
- `p9-created-workflow-continuity-v3.authority-cli`：6/6，exit 0。
- `p9-created-workflow-continuity-v3.replay-evidence`：4/4，exit 0。
- `p9-created-workflow-continuity-v3.tier2-production`：5/5，exit 0。
- `p9-created-workflow-continuity-v3.legacy-fixed-id-supersession`：4/4，exit 0。
- `node --check`：27 个本轮 `.mjs` 文件全部 exit 0。
- `node loop-kit/bin/term-lint.mjs --registry`：exit 0。
- `node bin/casey.mjs selftest --tier1`：五项全绿，exit 0。
- `node loop-kit/bin/gate.mjs --prd loop/prd-p9-created-workflow-cleanup-continuity-v3.json --dry`：ratchet、术语与命令清单检查 exit 0；未写 `passes`。

WSL 对 Windows 裸盘符动态 import 不兼容的三枚 C2 邻接测试作补充交叉执行：admission 15/15、cardinality 18/18、wiring 18/18，均 exit 0。`workflow.bindAgent` 端到端双锁邻接为 8/8，exit 0。

## 真实 Playwright 只读证据

命令在 Windows 原生 Chromium 中执行；`AT_SITE_JSON` 与 `AT_CREDS_FILE` 只通过本地环境传入，具体值不落本文：

`node scripts/p9-workflow-adapter-probe.mjs <local-profile>`

结果 exit 0，来自真实 SUT：

- 登录和真实列表请求成功，响应为 2xx；
- 列表记录路径为 `data.list`；
- 生产 `fetchCreatedWorkflowListScan` 返回 `complete:true`、精确命中 1 条、ID 类型为 string；
- 页面真实记录容器为 `article.agent-card`，标题类为 `.agent-card__title`；
- `mutationSent:false`；当前没有可用的 delete-capable 记录，因此探针明确返回 `NO_DELETE_CAPABLE_RECORD_AVAILABLE`。

这证明真实只读列表、DOM 容器和字符串 ID 读回接缝可用，不证明 mutation adapter 请求体，也不构成 P9 真机通过。

## 当前未闭合项

- `destructive-continuity-ref-rebuild.red-acceptance` 是旧固定 ID v3 形状的历史红件；动态 ID successor 已证明旧件不能冒充新 v3，但旧件本身仍非零，因此完整 PRD gate 尚未绿。
- `p9-tier2-selftest` 仍因签署版 `cases/tier2-suite.manifest.json` 缺席而红；该文件需要人签，机器不代签。
- fresh worktree 的全仓 drift scan 报 14 个缺文件，均是 gitignored 的本地 case/真实 UAT 签署产物缺席；没有报告已在场冻结件的 checksum 漂移。
- 删除 adapter 的真实 method/path/body 形状尚未由可删除对象上的拦截探针确认；未经精确 mutation 授权，不发送删除请求。
- 三次 fresh compile、三条 mutation replay、稳定缺席证据、五成员同批 Tier2、录像、报告、残留扫描与最终签认均未执行。

因此当前状态只能写为 `P9 v3 machine implementation ready`；`REAL_SUT_PASSED=false`，`HUMAN_SIGNED=false`，P9 保持 open。
