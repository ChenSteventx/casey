# workflow.deleteByName 真实 UAT 复核

时间：2026-07-15。目标：真实 Heren 发布、历史、CRUD 三条清理链；fake-SUT/fixture 全程未运行。

## 联网与编译

- Windows→真实目标 HTTP 200；`WSL` 回环→真实目标 HTTP 200；反向代理单实例。
- 三案真实重新 compile：16 / 20 / 16 个事件，均 0 blocker、0 用例缺陷候选。
- 三案实采均为 card 布局，精确目标卡片 1、域内删除按钮 1、计数相等；两个删除 click 都携带目标名。
- 现场 build 为 `1.1.2`，三份 cleanup `countChange equals 0` 经 signer `Steven` 重签并刷新 checksum。

## 正式回放与裁定

- `tc_wf_publish_states`：4 `PASS`，其余三态均 0。
- `tc_wf_history_version`：8 `PASS`，其余三态均 0。
- `tc_catalog_wf_crud`：4 `PASS`，其余三态均 0。
- 每案 cleanup 的 7 个 `eventActions` 全为 `unique`，删除触发和确认身份回读均成功；精确目标后置计数为 0。
- 独立真实浏览器只读终检：`atl_r1` 精确残留数 0。

## 视觉与报告

- 发布：创建页、发布成功与已发布/V1、目标删除确认、删除成功与空态均在同次录像中可见。
- 历史：未发布历史为空；发布后 V1、创建时间与查看入口可见；删除成功与空态可见。
- CRUD：保存成功、目标卡片、删除成功与空态可见。
- 视觉复核均为 `CONSISTENT` 且 `verdictImpact=none`；三份单例 HTML 均含自然语言、原子操作、录像、附件、视觉复核和清理证据。

## 诚实失败记录

首次正式批次把 compile 唯一名 `atl_realuat0715a` 错当 replay 实体，但 replay 实际默认实例化 `atl_r1`，导致 profile 的计数对象错误。录像揭示该不一致后，首次批次立即作废；修正 profile 为精确 `atl_r1` 后完整重跑得到本复核的 b2 证据。

## 残余门

合入主干前仍需跨族只读实现评审。当前复核只证明本地组合提交在真实 Heren 上满足用户要求，不替代主干合并审查。
