# cycle-evidence-inner-reason learn

## 落地结论

`projectAndVerify` 的 15 个拒付位适合由一枚小 helper 收口：取证事件先同步发射，
业务返回继续携带原 reason。生产者自己的六码闭集只约束取证投影；外来动态串降格为
`OTHER_REASON`，不能反向改写业务拒付码。

第 22 个归因点只须加入纯上下文枚举。output、裁判与 authority 形状都不需要变化，
因此这次改动保持 schemaVersion 与主控制流不变。

## 本轮暴露的工装事实

1. `/tmp` worktree 不会自动拥有主仓 gitignored 的 `cases/`、`runs/` 与
   `node_modules`。缺这些件会让相邻金牌或漂移扫描报文件缺席；应先判环境身份，不能
   把隔离树缺件写成生产回归。
2. 受管沙箱里的嵌套 `spawnSync` 可能返回 `EPERM` 且吞掉 stdout/stderr；同一金牌在
   沙箱外 15/15 GREEN。涉及 gate、浏览器和子进程的证据必须记真实运行边界。
3. 精选评审料能提高聚焦度，但会隐藏传递调用者。用户要求开放完整仓后，pi 与 Grok
   都能确认 `inspectBinding` 没有旁路发射，并把首轮 Medium 准确降为未来加固 Low。

## 后继挂账

- 下次发生验收换签时，可顺带补两枚非阻断棘轮：模块级新归因点发射唯一性，以及
  预检动态位的非六码降格负控；本轮不为未来可能新增的坏代码改写已签冻结件。
- A4 真机仍是独立完成闸：最终主树复录一次，边车须先出现
  `raw-axes.projection-denied` 的六码之一，随后出现既有外层统一码。只看到前者不算
  验收通过，也不把“见到真因”写成“闭环已经转绿”。
