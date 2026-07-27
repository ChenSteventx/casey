# precondition-atom-workflow · learn

> 状态：S1 zero-SUT 纯函数与 adapter barrier 已闭合；实现评审 `PASS`。

## 交付结果

业务前置条件不再只是文字初态。系统会把非登录前置编排成 registry 真值驱动的 setup workflow；
每项前置都必须进入 goal，并由 post-readback 或 already-satisfied probe 形成 candidate receipt，
否则主体 adapter 零调用。

名称/编号继续用于发现与匹配，平台 ID 只从唯一 identity observation 投影；receipt 和主体 mapping
不另造平台 ID。

## 沉淀

1. “不信任前置文本”不能实现成“忽略前置文本”。每项业务前置都要有 goal → provider → final state
   → receipt 的完整覆盖关系。
2. fail-closed 必须发生在动作前：plan/角色/identity obligation 不闭合时，setup adapter 本身就应零调用。
3. exclusive state group 的中间态不是最终能力，不能泄漏到 receipt 给主体复用。
4. session challenge 只能证明相关性，不能从无签 JSON 推导时间事实；freshness 的权威边界在真实
   browser/observer adapter。
5. 动作角色与观察角色冲突不能靠局部夹具选边。未重签统一前应稳定 `route:human`。

## 后继

进入 S2 `zero-shot-observe-admit-step`：先实现主 frame PageObserver、bounded affordance catalog
和 page-wide unique 的确定性 resolver，再接受限单步 proposal。S2 浏览器接缝同时承担 S1
execution request 下沉到实际 readback observer 的集成取证。

