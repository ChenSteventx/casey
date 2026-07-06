# handover-pack — grill 决策记录（light）

> 授权链：Steven 三问之一「是否准备好把 mcp/skill/cli 移交给同事」+ 点单排序②。
> 缺口清单全部来自 2026-07-07 四路审计 D 组（逐项带锚点），本 GRILL 只做机械收敛、零新决策。

## D1 README.md（新建，人类新同事入口）

八节：① 一句话定位与三面（CLI/skill/MCP）；② 安装（node>=22.12 / npm install /
`npx playwright install chromium` / WSL 中文字体 Noto Sans CJK）；③ 三级环境验收
（tier1 机制自检 → e2e-chain 金牌 = hermetic 回放就绪 → 真机探针 = 隧道连通）；④ 凭据面
**格式文档不含任何真值**（.auth/credentials.json 字段 {user,pass} + env 覆盖三件 + site.json
字段全集 target.startUrl/devProxyUrl 与 login/select 覆盖段——真值带外交付，护栏 #7）；
⑤ 真机链路（隧道三脚本 + 启动顺序坑 + 真机命令一律 WSL 侧 G6 硬约束）；⑥ MCP 挂载
（WSL 路径写法）与 skill（clone 即得）；⑦ Claude Code hooks 行为预告（loop 纪律拦截是特性
不是故障，指路 CLAUDE.md/GUARDRAILS）；⑧ 分发现状（本仓无远端；建远端/bundle 归维护者）。

## D2 过时文案修（零行为差）

- `bin/casey.mjs` help：run 行改真 runPipeline 签名（相3-4-6 编排 + 前段自跑说明）；compile 行
  补三段式真旗标去 [P3]；sign 行补真必填旗标去 [P4]；页脚进度改现状（七相全建 + heal 唯一桩 +
  真机端到端 route:human）。
- `mcp/casey-server.mjs` 头注释挂载命令 D:\\ → WSL 路径写法（`node /mnt/d/...` 或仓相对）。
- `.claude/skills/casey/SKILL.md` 两处 `D:\\ctx\\heren\\casey` 硬编码 → 仓相对表述（换机即失真）。

## D3 漂移锁金牌

`handover-pack.golden.mjs`：README 在场且八节锚标题齐；`casey help` 输出不含过时形态
（`run <file>`、`[--signer <id> --build <id>]`、`P0 引导 + P1`）且含真形态锚（`--events`、
`--against-build`）；mcp 头注释与 SKILL.md 不含 `D:\\ctx`。实现前红（README 不存在、help 旧文案在）。

## D4 非目标

不建远端/不做分发动作（route:human 归 Steven）；不写凭据真值（格式文档只写字段名与形状）；
不动任何行为代码（纯文案/注释/新文档）；NEXT-SESSION 刷新归 /session-handoff 不在本契约；
selftest --tier2 不实现（P9 route:human）。
