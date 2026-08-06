# learn · wf-open-readback-requery

## 这轮学到什么

1. **「镜像」要镜像到序，不能只镜像到件**。workflow.open 的读回门注释自称镜像
   `compileAgentSearchOpen`，件都在（武装/信封/双证/卡锚），唯独把「武装→搜索→settle→
   双证→过门才点」的**序**翻译成了「点→导航→才武装」——在详情页语境里每个件都无法
   成立。评审断言相似度时要对齐时序图，不是对齐零件清单。
2. **「从未走通过」缺陷族的第三例**（前两例：save 断层、语义名模板）。共同形态：编译
   知识在采集时的语境（固定既有名/列表页/旧页面语义）与带模板/真实流程语境不同，首次
   真机执行才暴露。防御是把「该配置真机走通过吗」当成独立问题问，而不是从 hermetic 绿
   推断。
3. **双证的网络轴证据可以有两种合法来源**：CDP 捕获的 UI 发起流量（信封路线，取证纯度
   高、依赖 UI 行为假设）与页面语境直取 API（扫描路线，零 UI 假设、真机已通）。裁定必须
   同门（`resolveDualIdentity` 判定表），来源可按风险取舍——本例赌真机成功率选扫描，
   UI 流量纯度诉求留给取证轴（`attributedStepId`）。
4. **金牌断言要钉消费面不是中间面**：首版 S1e 钉 `pendingIdentityObservation`（中间态，
   flow 层归档后即清空）而红；v2 改钉 `identityObservations` 归档行（sign 对账真消费面）
   反而更强——多出 provenance join 三字段的覆盖。断言选面时先问「谁消费这个值」。
5. **扫描器自身要过与已知事实的对撞检验**：全仓扫描首轮全绿与两个已知既存红矛盾，逮出
   `echo "$(basename $f) $?"` 的命令替换重置 `$?` 坑（已入记忆 verify-goldens-by-exit-code）。
   扫描结果异常干净时，先疑扫描器。
6. **金牌自产残件是环境毒**：`bindagent-replay` 族金牌落 `loop/prd-tc_*.json` 残件，
   下轮同金牌 EEXIST 红、且是主树 `PUBLICATION_TMP_WITHOUT_JOURNAL` 陈旧红的同源。
   跑金牌扫描后清残件应成为固定动作（挂账：金牌应自清或落 scratch 目录）。

## 数字

- 契约全程（起树→双 APPROVE）单会话完成；验收金牌 20 断言、红证 11 红实抓；
  全仓 295 金牌双态对比零回归（6 异码全数消解归因）。
- grok 4.5 high 实工 14m31s、110K 上下文；pi deepseek-v4-pro high 非交互一发收口。
