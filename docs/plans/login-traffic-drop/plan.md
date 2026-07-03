# login-traffic-drop — 登录期流量不进 axes（direct）

## 改动

1. `bin/replay.mjs`：登录预备动作成功后记 `loginMark = forensics.records().length`；投影改 `records().slice(loginMark)`——登录期记录整体不进 axes（步过滤本就按 `firingStepId`，唯一入径是孤儿并入，切断之）。无旗标 `loginMark=0` 零行为差。
2. `tests/_golden/replay-login-bootstrap.golden.mjs` 补钉（红先行）：带旗标登录成功场景，axes 全文零 `/api/login`（登录 POST 此前经孤儿并入在场→红）；其 prd 补冻。

## 验收

login golden 补钉红先行改绿 + prd 补冻 gate 复验；p5 两冻结/chiefcomplaint/run-history 回归锁；真机 `casey run` 复跑过门（route:human 顺手核）。
