# 评审收据 · credgate-lineage-keys

## R1 双路 + R2 delta（并集修一轮闭合）

| 项 | 值 |
|---|---|
| 被审快照 | R1=`d27af96`（基线 dev `1a601fa`）；并集修 `24acd64`；R2 delta 只审修复 hunks |
| 实现家族 | Claude（Fable 5 executor） |
| 评审环境 | ext4 克隆树 `~/casey-review/credgate-lineage-keys`（node_modules 软链；审后 tracked `git diff HEAD` 空） |
| 评审方甲 | `grok-4.5` high（tmux 伪终端、本机探针直调门函数）：R1 `CHANGES_REQUIRED`（唯一 finding M1·Medium）→ R2 `APPROVE`（M1 关闭、零新增） |
| 评审方乙 | `pi.dev` `deepseek-v4-pro` high（默认配置入口、`-p` 带工具、`--exclude-tools edit,write`）：`APPROVE` 零 C/H/M（对 `d27af96`） |
| 结论 | **零未决 finding；安全门改动经「找绕过优先」双路对抗审通过** |

## M1（grok，Medium）与并集修

`null` 交替无终止断言：`"batchToken": nullable` 类 null 前缀畸形值被吃前缀中和键名
→ 相对契约偏松一寸（非凭据外泄级：值/后缀仍全额扫，字面量扫原文）。修
`(?![A-Za-z0-9_-])` 负向先行（比 grok 建议多含 `-`，钉死连字符续缀）+ G2 三钉
（nullable/nullish/null-garbage）先红后绿；PRD `checksumAmendments` 登记金牌改版。

## 双方独立对抗证据（并集）

- 走私面零发现：Unicode 转义键、嵌套引号、重复键、大小写变体、裸文本上下文、
  豁免键值携各关键词/含空格 bearer——两层防御（关键词扫中和副本+字面量扫原文）无短路；
- 中性标记逐字符核零拼接关键词；正则线性无 ReDoS（万次命中模糊 ok）；
- `p7-credgate-coverage` 冻结金牌零触碰绿（无须改版人签）、seams-freeze 两件绿；
- 六钉金牌、邻接七命令、全仓 304 串行扫描对基线唯一差异=新金牌绿。

## 已知披露（双方确认不计 finding）

1. G5 真凭据在场跳过分支（本克隆树无凭据故实跑覆盖）；
2. 合形不透明值经豁免键放行与任意非禁键同值基线同权——门本就非未知秘密通用检测器。
