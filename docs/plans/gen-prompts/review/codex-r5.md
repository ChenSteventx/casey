# gen-prompts 修复层评审（r5）——codex

调用式：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-gen-prompts -s read-only -m gpt-5.6-sol -c model_reasoning_effort=medium <指令> < docs/plans/gen-prompts/review/material-r5.md`（codex-cli 0.144.1，sandbox=read-only，reasoning effort=medium，用量 98,567 tokens）。评审对象：round-4 双路复核结果（codex round-4 判需修改，给出 1 条 URI authority 检测建议；pi round-4 判通过）经修复者采纳建议实现（commit `0eb068c`）+ 修复者自己在准备本轮评审材料时主动自查发现并修复的一处 userinfo 解析缺口（commit `ca4f230`）。实现方 Claude，评审方 codex（异构冗余，Dissimilar Redundancy，评审族≠实现族）。

---

结论：**PASS**

逐项核实结果：

1. URI authority 修复已兑现

   - `URI_AUTHORITY_RE`（`lib/promptset-authoring.mjs:341`）能覆盖 HTTP(S) 两三段简写、端口、大小写协议头和 userinfo。
   - 对 3,840 组经 WHATWG `URL` 确认可解析的私网 URL 组合进行对照，未发现假阴性。
   - `http://[::1]/`、ULA、link-local IPv6 均由此前的 IPv6 正则先行命中；新增通道不会破坏它们。
   - `ftp://10.1/`、`ws://127.1/` 按设计不进入新增通道。
   - `'http' + '://10.1/'`、`'HT' + 'TP://127.1/'` 在拼接完成后均命中；字符串的构造方式不能绕过运行时正则。`\b` 只排除紧贴 ASCII 单词字符的 `xhttp://...`，该形态不是独立协议 token。

2. userinfo 修复妥当

   `(?:[^\s/?#@]*@)?`（`lib/promptset-authoring.mjs:341`）正确跳过 userinfo。实测覆盖：仅用户名、用户名密码、空用户名、百分号编码字符、多个原始 `@`、尾点、端口和反斜杠路径——均能提取并归一真正主机，未发现同类遗留漏检。

3. 未发现新增缺陷

   - `1ccf8cb..ca4f230` 的实现变更仅涉及 authoring 扫描与对应金牌。
   - 新增测试位于 `F4c1c`（`tests/_golden/gen-prompts.golden.mjs:651`），正反样例与实现一致。
   - PRD 中三个冻结文件的当前 SHA-256 全部匹配，checksum mismatch 为 0。
   - 评审所处环境为只读沙箱，完整金牌因无法在 `/tmp` 建目录而未能独立复跑；材料所附 77/0 结果之外，已完成上述不落盘定向实测。

4. 铁不变量仍成立

   - `bin/verdict.mjs`、`lib/sign-gate.mjs`、`bin/promptset.mjs`、`lib/promptset.mjs` 在区间两端字节哈希一致。
   - 两个 authoring CLI 的零 LLM/零网络纯度检查均为 exit 0。
   - authoring 未进入回放或裁定闭包。
   - 未新增 API、模型、网络或凭据接线。
   - 归档中的私网地址均为合成测试样例；历史真实地址保持脱敏，未发现未脱敏真实目标地址。

---

## 驱动员核对（sonnet5，修复者本人）

codex 与 pi 本轮双双判 PASS，未提出任何需修改项。codex 的实测结论（IPv6 字面量已由既有专有正则先行命中、新增通道不产生副作用；`ftp://`/`ws://` 不受影响；字符串拼接无法绕过运行时正则）与 pi 的观察项（`URI_AUTHORITY_RE` 对 `http://[::1]/` 形态本身的捕获结果不正确，但该结果会被 `tryUrlNormalizeHost` 丢弃、且 IPv6 检测由既有专有正则独立覆盖，故不构成实际缺陷）两者互相印证、并无分歧——已用 `node -e` 直接调用 `scanPrivateAddress` 对 `http://[::1]/path`、`http://[::1]:8080/api`、`http://[fc00::1]/status` 三例实测，均正确返回命中，实测坐实两位评审者的判断一致：这是一个无害的实现细节，不是漏检，不需要修法。详见 `docs/plans/gen-prompts/review/dispositions-r5.md`。round-5 至此双路 PASS，round-2 至 round-4 期间 codex 连续三轮指出的问题均已逐条修死、红先行验证、金牌冻结；本轮双路无新增真发现，判定为收口。
