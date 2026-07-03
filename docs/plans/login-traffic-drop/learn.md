# learn — login-traffic-drop（direct，2026-07-03，真机停站④驱动）

四条沉淀：

1. **门的每次拦截都要当线索追到底**：停站④两连拦（`password` 关键词 → 敏感字面量）各自揪出一条真泄露向量——登录接口 `GET doLogin` 凭据走 query、目标基址整串在 axes 全量 URL。若当误伤绕过（豁免/跳过），两条真向量就落盘了。fail-closed 的价值在真机首日就兑现两次。
2. **「归因 null」不等于「不进产物」**：CONTEXT「登录预备动作…不进 axes」此前只兑现了归因侧（`attributedStepId=null`），记录本体仍经孤儿并入落盘。词条承诺要逐字对照产物核，「进没进」是字节层面的事实不是语义层面的姿态。
3. **URL 是走私 host 的多面手**：全量 URL、`blob:` 的 pathname 内嵌 origin、代理型路径自嵌 `://`、`//host/x` 协议相对引用——一轮评审三连缝。投影卫生要白名单式（仅放行单斜杠纯路径 + 已知 scheme 的 pathname+search），黑名单堵不完。
4. **异构评审对安全面的边际价值最高**：本契约三轮全部发现来自 codex（blob 穿透是我实现后自查没想到的）；凭据/泄露面的评审包值得单独喂、多轮喂。

配套：真机 `casey run` 端到端过门落盘七件（`run_1783054730282`），verdict 出 Casey 首个真机 `SUT_DEFECT` 真发现（智能体回复「会话异常」，textHidden 命中 + 坏信封取证背书）。挂账两笔待 Steven：历史落盘泄露洗盘（catalog 时代 6 件，git 清白本地 only）、平台侧缺陷上报（doLogin GET 凭据进 URL + 会话异常）。
