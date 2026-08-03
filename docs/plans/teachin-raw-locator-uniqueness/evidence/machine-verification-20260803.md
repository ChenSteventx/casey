# Wave 2 机器验证（2026-08-03）

## 环境与内容身份

- 主执行环境：Windows PowerShell；Windows 原生 Playwright Chromium。
- WSL：本 Wave 未用于浏览器执行。
- 测试 checksum：`9cdd4beddd91c41670c89ea2e21ed44df3934336ea32120d25161b728064eed9`。
- PRD digest：`9386e40b9a5048431d92c3603559601d710b80f5bac03b526ee7894979b83268`。
- plan digest：`ca6dcd74b3279e27bb5da3ad4936f512c8b47c1882c494d84fd51280df59dded`。
- package-lock digest：`44897ee7221db64f53fa7315b6eb59cfeb70f441832f60cfa86c816f5da19afe`。

## 已执行命令

1. `node tests/_golden/teachin-raw-locator-uniqueness.browser.golden.mjs`
   - 旧实现：exit 1，5 过 / 3 败；精确红项见 `red-baseline-20260803.md`。
   - 修复后：exit 0，8 过 / 0 败。
2. `node tests/_golden/teachin-replayability-action-authority.zero-sut.golden.mjs`
   - exit 0，10 过 / 0 败；含 active page authority 换代、owner、origin 零动作拒绝。
3. `node tests/_golden/teachin-raw-actionability.zero-sut.golden.mjs`
   - exit 0，19 过 / 0 败。
4. `node tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs`
   - exit 0，15 过 / 0 败。
5. `node tests/_golden/teachin-replayability-raw-runner.zero-sut.golden.mjs`
   - exit 0，9 过 / 0 败。
6. `node --check lib/teachin/raw-playwright-driver.mjs`
   - exit 0。
7. `node bin/casey.mjs selftest --tier1`
   - exit 0，5 项全绿。
8. `node loop-kit/bin/term-lint.mjs --registry`
   - exit 0，0 个提示。
9. `node loop-kit/bin/gate.mjs --prd loop/prd-teachin-raw-locator-uniqueness.json`
   - exit 0，ratchet/term 通过，story 3/3 GREEN。

提交后已在精确 Wave 2 commit `a981be10138ee034228028a3aeac6efbb39bbfc8` 上重复运行
新真实浏览器金牌与 gate，均 exit 0；`git diff --check HEAD^ HEAD` exit 0。相同补丁随后
由用户要求落入本地 `dev@d89879d`，未 push。

## 边界

本证据来自真实浏览器但不是生产 SUT。没有读取凭据、发送 mutation 或产生正式 verdict；
不得据此声称 P9 `REAL_SUT_PASSED`。测试 checksum 已进入机器 ratchet，但 exact bytes
尚无人签。
