# learn — replay-login-bootstrap（light，2026-07-02）

六阶段全走完（grill 单分岔人签 → plan → accept 红先行 → loop gate GREEN → codex 两轮 R2 PASS → learn）。沉淀六条：

1. **报错通道也是泄漏面**：V8 的 `JSON.parse` 报错自带内容片段（实测形如 `…"pass":p_fake_log"…`）——凡解析敏感文件（凭据、`site.json`）的口子，异常必须消毒重抛、绝不引用文件内容。护栏 #7 不只管产物落盘，stderr/日志同罪。
2. **泄漏断言要按片段抓**：V8 片段会截断长口令，拿全串 `includes(FAKE_PASS)` 断言泄漏是假绿（C2b 第一版就这么漏过了）。钉泄漏方向用短前缀片段（`p_fake`），任何字节外漏都算。
3. **「坏文件」与「缺文件」是两个语义**：可选配置缺席回默认是设计；文件在场但坏是必须 fail-closed 的另一态。`strict` 选项模式两全——既有调用方语义不动，fail-closed 消费者显式开（codex R1-F2 的修法）。
4. **hermetic 凭据源隔离靠 env 换路径**：`AT_CREDS_FILE`（与 `AT_SITE_JSON` 同范式）是测试不误碰真 `.auth/` 的前提；没有它，「缺凭据」「假凭据」两个方向都会把真凭据填进假 SUT——夹具红线，先于功能实现就要有。
5. **假 SUT 登录会话要服务端化**：cookie 会话（POST 置 `sid=1`、GET 按 cookie 分岔）才能扛住 `location.reload()` 与回放期的再导航；登录标记只落布尔文件、服务端绝不持久化请求体——夹具自身也过护栏 #7。
6. **异构评审拒绝也要带行号证据**：codex R1 三发现两真一伪；证伪（F3 尾斜杠）靠 `bin/replay.mjs:56` 既有剥斜杠行号回击，R2 一次采信。逐条核实、真伪分明、拒绝有据——比全盘照单全收更快收敛。

配套：opt-in 旗标的「零行为差」方向用「无旗标 + 无任何凭据源」组合钉（C1），证明旗标纯加法；p5/p3 冻结 golden 原样复跑作回归锁。
