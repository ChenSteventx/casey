# checksum-drift-closure — learn

## 结果

task #17 的两处真实漏签已收口：report schema 与删除静态金牌分别由原 owner 按 Steven 签认的完整
sha256 重签，三份 gate 全绿。全仓 ratchet 从 120 PRD / 396 冻结 / 498 引用 / 4 问题，收敛为
121 PRD / 397 冻结 / 499 引用 / 2 问题；仅余两份有意安全撤销墓碑，零普通漏签、零新增漂移。

本契约零生产实现改动，未启动浏览器、网络、fake/fixture SUT 或真实 SUT。新增零 SUT 回归验收 6/6，
现役删除静态金牌 12/12；Grok 与 `pi.dev` 双路实现评审均 PASS、零 Critical/High/Medium。

## 教训

1. 存量正确语义的回归保护验收冻结时可以直接绿；不要为了形式制造假红。本案真实红基线是 owner
   checksum 漂移，ratchet exit 1 恰好提供可复现的失败事实。
2. 新契约验收可以读取或直接运行既有冻结件，但不应把它们重复登记为第二 owner。新增 PRD 只冻结新增
   golden，目标字节继续由原 owner gate 与全仓 ratchet 守护，减少未来重签涟漪。
3. D1/D2/D3 方案人签不等于 ADR-0004 字节人签。先把语义验收到可复现绿，再把完整当前 sha256 单独交人
   签认，最后才更新 owner；两道签认不能合并成一句模糊“继续”。
4. 预期红也必须精确建模。本契约的正确结束态是 ratchet exit 1 且恰剩两条安全撤销 mismatch，不是全绿；
   把 issueCount、owner 与文件名写进证据，能防已知红掩盖新漂移。
5. 外部评审只认完整出口。Grok 首把 `Cancelled` 即使思考片段像 PASS 也必须拒收；缩小读取面、禁止慢 shell
   后获得正常 `EndTurn`。`pi.dev` 无工具附料评审可作为独立异构视角，两者 findings 仍须本地主线程核实。

## 后续

另立 `ratchet-security-revocation` kernel 级 full 契约，实现 D1=甲：让兄弟 `loop-kit` 的 ratchet 只在
安全撤销回执、原始归档、墓碑字节、后继资产与 owner 旧哈希形成严格闭合时输出具名
`SECURITY_REVOKED`；任一环缺失仍保持红。该契约必须取得兄弟仓写权限，做双设计审、Grok / `pi.dev`
异构实现审、round-2、Casey 与 autotester 双消费者受影响面复验和 Steven 人签。不得通过重签墓碑绕过。
