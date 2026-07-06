# caseid-echo-mask — 姊妹 CLI 拒绝分支原值回显封缝（direct）

## 背景

ingest 契约 codex R2-F2 同族挂账收口：CLI 参数在凭据兜底门扫描面外，非法参数拒绝分支回显原值
即泄漏面。决策见 `proposed/GRILL.md`（机械镜像 ingest 已评审修法，零新决策）。

## 改动

六处报错文案收紧（退出码/闸序零变），逐字镜像 `bin/ingest.mjs:29` 形态「（仅限…；原值不回显）」：

1. `bin/compile.mjs:267` caseId；2. `bin/draft.mjs:40` caseId；3. `bin/flow-bridge.mjs:31` caseId；
4. `bin/sign.mjs:87` caseId；5. `bin/sign.mjs:90` signer；6. `bin/sign.mjs:91` against-build。

新金牌 `tests/_golden/caseid-echo-mask.golden.mjs`（红先行）+ `loop/prd-caseid-echo-mask.json`。

## 非目标

不动不一致类回显（文件侧值）；不动退出码/闸序；不动冻结金牌与 lib；不碰真机。

## 验收（红金牌）

- C1–C6：六处各以含哨兵 `hunter2` 的非法参数直打（假路径，闸序 args-first 已核）→ exit 65 +
  输出含「非法字符」（打中拒绝分支）+ 不含哨兵（不回显）。
- 涟漪回归锁：四 CLI 的既有金牌复跑零行为差——`flow-bridge` / `draft-cli` / `compile-caseid-shape` /
  `p2-sign` / `p3-compile`；`selftest --tier1` 无回归。
