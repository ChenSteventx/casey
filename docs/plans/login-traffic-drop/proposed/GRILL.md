# GRILL — login-traffic-drop（direct，真泄露向量修复）

授权：Steven 在场（停站④真机 `casey run` 被凭据门拦出本缝）。实证链：axes 补门后首个真机回放被拦（关键词 `password`）→ 只读探针定位真机登录接口为 `GET /ai-manager/doLogin?userName=…&password=…`——**凭据走 query 串**，登录期取证记录经孤儿并入进 axes 即携真值。门两连击全是真阳性（先 token 路由名、后凭据 query）。

机械决策两条：

- **G1 登录期流量整体不进 axes**：CONTEXT「登录预备动作」词条字面承诺「不产 event、不进 axes、凭据只进内存」——此前只做到归因 null（`attributedStepId=null`），记录本体仍经孤儿并入落盘。修法：登录预备动作完成时刻记取证记录数（`loginMark`），投影只取其后（`records().slice(loginMark)`）；登录期请求对测试用例零取证价值（pre-test 流量），整体不进而非打码（query 值无法按关键词打码）。无登录旗标 `loginMark=0` 零行为差。
- **G3 axes 剥 host（同轮真机实证追加）**：登录期切断后门再拦「敏感字面量」——site.json 目标基址整串在 axes 全量 URL 里（observed 先例早已只投路径段）。「目标地址只活在 site.json、绝不进任何输出」硬规字面兑现：axes 网络投影一律 `pathname+search`（query 保留、仍受门拦）。hermetic 假 SUT 端口随机才没撞，属侥幸非设计。
- **G2 历史落盘泄露与平台侧缺陷另行处置**：catalog 时代 axes 无门，本地 `runs/`/`cases/` 六件已含 doLogin 带值 query（git 历史清白、从未入库）；洗盘方案与「凭据进 URL/服务端日志」平台侧安全缺陷上报，均交 Steven 拍板（本契约不动历史件）。
