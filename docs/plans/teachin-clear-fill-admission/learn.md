# learn — teachin-clear-fill-admission

> 六阶段收口沉淀。事实源：GRILL.md / plan.md（§7 计划评审、§8 代码评审）/
> loop/prd-teachin-clear-fill-admission.json / review/ 目录七份证据档。

## 一、这轮修了什么（一句话）

「清空输入框」的 fill 事件（目标值=空串）被示教链在投影层丢键、准入层误拒；
两处判据修正后，空串成为一等合法回放目标值，而缺键、非 string、纯空白、敏感遮值
四路全部维持 fail-closed。

## 二、值得沉淀的教训

1. **交接记录的根因可以比真根因浅一层。** HANDOFF 记「fill 事件无 value 键」，
   实际注入侧恒落 value——键是在 `sanitizeRecordEvent` 的 `if (v)` 真值判断里丢的。
   动手前逐层取证（注入→投影→准入→传导→驱动五层各自实测）比按交接直修快且准：
   本例真修点与交接指的行号根本不同文件。
2. **「宽容修复」的第一版几乎总是 fail-open。** 初版把「纯空白坍缩成清空」当明示
   残留放行，codex r1 一针见血：那是把原本拒付的形态洗成静默成功。修误拒 ≠ 放宽
   判据——正确形状是把「空串」从「缺失」里剥出来，其余拒付面一寸不让。同型二犯
   在 code-r1：`cleanString` 对非 string 的 `String()` 强转同样在洗白，补类型闸。
3. **「不用动的层」要机制化证明，不要口头断言。** G6 物理句柄替身第一次跑就绿，
   把「canonical driver 对空串本就通」从文档断言升级成金牌事实；G5 则暴露了
   「传导层绿」不等于「全链绿」（修前 G5 红在准入步）。
4. **评审分工按长处押注（本轮实证）**：codex 逮语义洞（洗白面两连击 + gate 宣称面
   大于证明面），grok 出对抗探针与独立复证但终判偏宽（其 PASS 不盖 codex FAIL，
   铁律再验）；三轮计划评审 + 两轮代码评审共 6 条 findings 全部属实、零误报。
5. **既红邻接面要「签名稳定性」不要只看退出码**：52 枚 sweep 里 7 枚既红
   （observation 家族陈旧红/吊销墓碑）逐条核签名不变才能证明零回归；
   「既红转绿」也必须算偏离（说明别的接缝被动了、须重采基线）——已把这套口径
   固化成 `support/clear-fill-sweep.mjs` 进 gate，护栏 #19 首次机制化。
6. **工装坑三则**：①tmux 保姆匹配弹窗不能用会常驻状态栏的字样（`always-approve`
   在状态栏常显，误匹配导致向 grok 空回车 7 次），只认单选标记 `(●)`；
   ②批量 spawn 金牌时 `while read` 循环会被吃 stdin 的金牌（`cli-mcp-face`）截断
   清单，子进程 stdin 必须接 `/dev/null`（opus 子代理自查自纠实证）；
   ③`pkill -f`/`pgrep -f` 的模式串出现在自己命令行里就会把自己的壳捞进击杀面
   （一日两踩、exit 144×2——第二次还是「先 pgrep 存变量再 kill」的变体，pgrep 捞
   pid 那行自身就含模式串）。治法：杀进程用**上一条命令**先取纯数字 pid、下一条
   再按数字杀，模式串绝不与击杀命令同行。
7. **旧语料不追认是唯一诚实解**：包内无法区分「清空」与「采集丢值」时，追认=伪造
   证据。代价是 Steven 需复录一遍——把「为什么救不回」讲透（键在录制落盘时已丢）
   比含糊答应「想办法恢复」更省信任。

## 三、环境侦察副产物（另档 env-cjk-ime-report.md，本轮零系统改动）

- 标题栏乱码定性**修正**：WSLg weston 走 rdprail-shell、不画装饰，标题串由 Windows
  渲染，Linux 装字体无用且无干净配置口——建议不追。
- 页面内中文已好（用户级 Noto CJK 生效，真 Chromium 截图核证）。
- Wayland 原生输入法被合成器 bind 拒绝（实测），唯一可行路=X11 + fcitx5 GTK 模块；
  完整跑单已备，装包须 Steven 亲自 sudo。
- 证伪旧结论「x11 截屏失败」：两形态截图均成功且字节一致——旧口径待 Steven 确认。

## 四、挂账（route:human，全部已在 prd observability 或此处记名）

- 手录首链复录：修后真机重录 `tc_chiefcomplaint_smoke`（Steven 人在机器前；
  远程桌面键盘进不了 WSLg 与输入法无关，装了也不解决）。
- fcitx5 安装六问（Q1-Q6 见 env-cjk-ime-report.md）待 Steven 裁。
- observation 家族 5 枚陈旧红 + 2 枚吊销墓碑：既有挂账（红金牌诊断
  `docs/plans/teachin-replayability-closure/red-goldens-diagnosis-20260728.md` 同族），
  留后继契约，本轮只证明其签名未被本修扰动。
- 本轮全部产物未 commit（工作树混有并行现场，遵并发 git 卫生纪律）。
