# ratchet-reverse-index 实施计划

## 失败模式

共享 golden 或 fixture 被修改后，只重签其中一个 PRD。单 PRD gate 可以翻绿，但其他引用同一文件的 PRD 已漂移，直到合并收尾人工全仓扫描才暴露。

## 修改边界

- 新增 `loop-kit/bin/ratchet.mjs`：纯读取、构建反向索引、全仓核验和 affected 查询。
- 新增 `tests/_golden/ratchet-reverse-index.golden.mjs`。
- 新增本契约 PRD。
- 不修改 `gate.mjs`、`contract.mjs`、签署实现和任何现有 PRD。

## 红测试

1. 两份 PRD 共享一个冻结文件时，索引必须列出两个引用者且顺序稳定。
2. 文件字节变化后，所有引用 PRD 均报告 checksum mismatch。
3. 同一文件被声明为不同 hash 时报告 conflicting expectations。
4. 缺文件、坏 JSON、非法 `testChecksums`、绝对路径和父目录逃逸均 fail-closed。
5. affected 查询返回引用变更文件的全部 PRD，并去重排序。
6. CLI JSON 输出稳定，clean exit 0、发现问题 exit 1、用法错误 exit 64。
7. 源码不得拥有文件写能力。

## 验收

- `node tests/_golden/ratchet-reverse-index.golden.mjs`
- `node loop-kit/bin/ratchet.mjs index`（worktree 只核 PRD 结构；完整 `verify` 在含带外 `cases/` 现场的主树合并门执行）
- `node bin/casey.mjs selftest --tier1`

## 影响文件

- `loop-kit/bin/ratchet.mjs`
- `tests/_golden/ratchet-reverse-index.golden.mjs`
- `docs/plans/ratchet-reverse-index/**`
- `loop/prd-ratchet-reverse-index.json`

## 自动升车道条件

若实现需要写入任何 PRD、冻结文件、签署元数据、`passes`、共享索引文件或修改 gate/contract，立即停止并升级为 kernel 级新契约。
