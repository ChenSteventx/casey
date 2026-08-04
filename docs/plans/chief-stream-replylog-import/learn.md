# learn · chief-stream-replylog-import

## 事实链

- 2026-08-03/04 两轮 chief 真机 compile 均败于第 5 步 `chat.sendAndWait`，
  `COMPILE_ATOM_EXECUTION_FAILED`，持久动作证据 `CONFIRMED`（两条真实消息已入 SUT 记录）。
- 根因不是 SUT、不是选择器、不是时序：`lib/compile-atoms-agent.mjs:342` 用
  `requestLogPath` 回填 `replyStreamUrl`，import 清单漏词。流取证记录一在场必抛
  `ReferenceError`——所以该抛点同时反证两轮的流请求都真实发起。
- hermetic 金牌此前恒绿的原因：旧夹具没有「流记录在场」形态。测的形态不含出事的形态，
  绿就只覆盖测过的那一半。

## 教训（可迁移）

1. **静态可查的缺陷不该等真机来教**：`requestLogPath` 未定义是 lint 级问题
   （`no-undef`），真机两条真实消息的代价换来的。后续值得给 `lib/`+`bin/` 补一道
   零依赖静态检查（node --check 抓不住 no-undef，需要真正的 undef 扫描）进 tier1。
2. **夹具形态覆盖要以取证分支为准**：`compileChatSendAndWait` 有流/无流是两条真实
   分支，金牌只造了无流形态。新金牌把两形态都钉住（S1/S2），并用因果纪律
   （回复相对基线有变才回填）防「恒定文本冒充回复」的假绿。
3. **替身要忠实到调用形状级**：生产等待器对 `last()` 的返回值再调 `count()`——替身
   `last()` 只给 `innerText` 时，等待器整个 10 秒预算都在 catch 里空转、返回 null。
   第一版夹具因此假红。替身的保真单位是「被调用的形状」，不是「被读的值」。

## 评审

- R1 双路联审（全仓暴露）：`grok-4.5` high（tmux 真 TTY 多轮）+ `pi.dev`
  `deepseek-v4-flash` thinking high（带工具跑真工作树），快照 `01e965f`（基线 `96f6107`），
  同料同指令。两路各自变异复现红形态、核对 sha256、自跑邻接。
- 结论：两路均终局 APPROVE，零 Critical/High/Medium。收敛 info 一条：S1 的 replyText 腿
  不具修复判别力（赋值行先于抛点），判别在 replyStreamUrl 腿与 S4；该腿是因果纪律回归钉。
  冻结字节不动，如实记录（详见 `reviews/README.md`）。
- 产物：`reviews/r1-grok-4.5-high.txt`、`reviews/r1-pi-deepseek-v4-flash-high.md`。

## 遗留

- 真机第三次 compile 重跑须 Steven 明示授权（每跑一次多一条真实消息）；hermetic 绿
  只算机器门禁绿，`replyText` 真机回填质量仍属 route:human。
