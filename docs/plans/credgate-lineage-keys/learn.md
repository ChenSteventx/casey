# learn · credgate-lineage-keys

1. **安全门的关键词包含匹配对「域内合法词汇」是定时炸弹**：token 一词在本域是
   世系/票据的正当术语（batchToken/uniqueNameToken/getTempTokenForApi 路由），
   包含匹配已三次误伤（路由打码、本契约字段名、还有 R1-F5 的键值池）。新增落盘
   产物字段名时先对 `FORBIDDEN_KEYWORDS` 表过一遍子串检查，能免则免；免不了走
   键感知+值形状豁免同族配方（三例先例已成型）。

2. **正则交替里的字面量分支必须带终止断言**：`(null|"...")` 的 null 无边界被
   grok 当场逮（nullable 吃前缀）——写豁免/放行类正则时，每个交替分支都问一句
   「它的右边界是什么」。负向字符类比 \b 词界更准（可把连字符也钉进去）。

3. **真机内部错的诊断姿势**：output-seal 把 fatal 吞成单行时，别猜——装载器钩子
   对错误分类模块做源改写、只落 name/reason/code 三个标识符（message/stack 绝不落，
   可能携内部细节），零改仓、成功路径零行为差；哨兵跑（一次性台账指向弃置目录）
  可零成本二分「浏览器前 vs 浏览器后」。本次两招合璧把 REPLAY_INTERNAL_ERROR
   定位到 AXES_CREDENTIAL_GATE_REJECTED 只用了一张票据的代价。

4. **grok tmux 输入部件的第二条长中文消息会楔死**（两会话复现同型；ASCII 恒好、
   首条长中文经多次回车能进）：多轮驱动一律「简报写文件 + 纯 ASCII 短令引用」；
   部件楔死后 C-u/C-a/C-k 全失效，只能杀会话重起（产出都在盘上，新会话读文件续）。

5. **票据核销早于启动**：occupy 在浏览器 launch 前原子写台账——任何 launch 前
   之外的后段失败（包括落盘门拒）都已烧票。交接文档说「未核销」要拿台账对质
   （runs/_tier2/replay-grant-ledger/<nonce>/），台账才是权威。
