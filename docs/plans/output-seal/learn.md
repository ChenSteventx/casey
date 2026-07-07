# output-seal — learn（2026-07-07，full，codex 三轮 R3 PASS）

全仓输出通道封缝：凭据门只扫落盘产物、stderr/CLI 回显在扫描面外——审计（proposed/AUDIT.md 全筛约 200 处）
分拣出 A1-A13/B1-B8/C 类真裸口，逐口封 + 3 追加缝 + report.mjs 穿越面字符集闸 + inbox/candidates 过门。
27 哨兵金牌，codex 三轮 R1(3)→R2(2)→R3(PASS)。

## 留存学习

1. 遮值不够，定位字段也是文件侧——本契约最硬的一课（codex R1-F2/F3 + R2-F5 连三条同型）：
   把断言值遮了，但报错里为「可诊断」留的 intentId/where/键名定位串本身就是文件侧输入，一样能塞种子。
   根治法不是 SAFE_ID（挡不住字母数字种子 SEEDVAL_x9），而是结构性数组下标（intents[i].expected[j] /
   verdict-baseline entries[i]）——结构位置来自遍历序、与文件内容无关，泄不了。凡「为定位而回显文件字段」
   一律换下标。我自己 A11 先用了 SAFE_ID，被 F2 的论据反打脸（F5）——同一契约内前后不一致是评审重点靶。
2. 校验前 vs 校验后的字段安全性不同（codex R2-F4 + R3 复核确认）：checkKindOp/VERDICT_STATES 之前，
   kind/op/verdict 是任意文件输入（须遮）；通过闭合词表校验之后，同一字段已是枚举值（安全可留）。
   封缝时按「硬闸位置」分段判，不是一刀切遮所有 ${a.kind}。
3. 收窄项要区分「真不可达」与「换个封法就可达」（codex R1-F1）：B5 登录期三口起初按「Playwright 在飞
   报错 hermetic 触发不了」收窄挂 route:human——但那是针对「精确断言报文内容」不可达；改成固定文案（根本
   不拼 e.message）后，封缝不依赖触发即成立，从收窄转实封。收窄前先问：是断言不了，还是封法选错了。
4. 审计子代理的「与 AUDIT 不符」栏是金矿：起草金牌的子代理揪出 3 条 AUDIT 漏项（replay 裸 parse /
   term-guard 门放写后 / 凭据门产物名键携路径）——起草者贴着代码实跑，比只读扫描的审计者看得细。
   fan-out 起草时明确要它回报「与上游分析不符的实事」，把它当二次审计用。
5. 回归揪出上个契约的尾巴（report-exit64 的 p7-credgate-coverage 也钉 exit 2）：output-seal 碰 report.mjs
   使其回归面覆盖 p7-credgate-coverage，揪出 report-exit64 grep 没扫到的钉位。教训呼应 report-exit64
   learn 第 1 条——收敛类契约的全仓文字/钉位扫描是已知盲区，下游契约的回归面是兜底网。

## 交到下一阶段的账

- 无新挂账；prd-caseid-echo-mask 的「全仓输出通道系统审计」observability 就此核销。
- Low 类清单（AUDIT A14-A19 / B 类 Low）逐处判过不封——预扫垫底/门后产物/值域受限，动了是过度工程。
- verdict.json 落盘不过凭据门（内容全为 axes 派生枚举）——记档不动（GRILL D6），若未来 axes 面扩展含
  自由文本再评。
- C 线剩：余 kind 按需（不主动铺）；toast 结构类名采样卡真机（撞上顺手采）；term-guard 乙真接线卡密钥
  （接线骨架 + learn 补账可先行）。
