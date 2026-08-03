# 聚焦复核：guard-net R13 修复是否干净解决你上一轮的 Medium

你上一轮（对 e6e7ea1..24e0508）判 CHANGES_REQUIRED，唯一 finding（Medium）：「无子目录」钉被指向目录的符号链接绕过（Dirent.isDirectory() 对 symlink-to-dir 为假）。你建议目录或指向目录的 symlink 一律红。

仓库（只读勿改）：/mnt/d/ctx/heren/casey-zero-shot-typed-progress-predicate-zero-shot-guard-net
修复 diff：git diff 24e0508..e19ccdb

只答五点：
1. 修法是否干净堵住你的反例（自己在 /tmp 外造目录 + ln -sfn 注入复现）？dangling 目录链接口径（选定一律红，理由 fail-safe 证不出即红）是否合理且真的红？
2. 有没有过度收紧（合法平铺 .mjs 文件、文件级 symlink 的既有行为是否不变）？
3. discoverZeroShotCore 保持不解引用不递归、完整性由子目录钉承担的分工说明是否自洽（有没有分工缝隙——某形状两边都不管）？
4. 两条 amendment（observe-admit-step 第 13 条、guard-net 第 1 条）与实物 sha256 是否一致（自己跑）？断言是否零弱化？
5. 跑边界金牌与元钉金牌，只信退出码。

不改文件；变异在 /tmp 副本。结尾一行 VERDICT: APPROVE 或 VERDICT: CHANGES_REQUIRED。
