# Claude 家族四路异构评审：codex 层（2026-07-28）

评审对象：codex 家族在 Claude 流水线实现之上叠加的层（录制生命周期、同次 capture 身份链 R8/R9、
`teachin-plan` 入口、formal 接线、实体链传播）。评审方：Claude 四路只读代理 + 主会话汇裁。
方法：只读源码 + 零 SUT 纯内存探针（探针脚本临时件，结论以本文与各 finding 记录为准）；
金牌判定只信退出码。校准：技术探索原型非银行级，理论攻击面降级，洗绿/fail-open 照常报。

## 终判

须修后过：Critical 0、High 0、Medium 6、Low 5。无洗绿、无 fail-open、无身份链断裂。
六 Medium 已由闭合修复轮处置（五修一走 R10 修单后修），L1 挂账；codex 终审复核见
`codex-final-20260728.md` 与 delta 复审记录。

## 七核对点结论

1. 同次 capture 身份链贯穿 admission/events/pair/三 runtime namespace：过（12/12 探针；
   旧「两次录制」流程实证必拒；hash 门零放宽；单次落盘单次读取，无第二份字节缝）。
2. legacy plan 严格只作模板：过（旧 events 路径零读取——指向不存在文件照常装配实证；
   pairId/三 namespace 全部重绑当前 capture）。
3. 录制归属交接与清理恰关一次：过（逐退出路径枚举，关闭靠事件/对象状态守门非计数；
   完成控件经 closed shadow root + composedPath 过滤确证不进业务事件；见证预装幂等、
   一次性铸权拒复用探针实证）。
4. signed expected/obligations 一致：过（全部消费同源于同一 expectedBytes；义务按
   intentId 与谓词摘要锚逐条对齐，数量精确相等）。
5. 动态活动页 + 共享取证态真接生产：过（活动页为按访问实时解析的投影，active 关闭即拒；
   attribution state 与 pageErrors 单实例引用链贯穿三段；逐步归因纪律保持）。
6. 实体 publication 未授权全链 fail-closed：过（发布根空表缺席即拒 → 授权判定四条同真且
   现版本铸不出 runtime 授权 → pair 封印还须消费 verifier 私铸 handle，三层独立；
   生产装配静态封死无注入面）。
7. 技术证据词恒为开发期口径：过（全出口盖 developmentOnly:true 与 promotionReady:false；
   正式 verdict/report 通道对 CLEAN/REPRODUCED/EQUIVALENT 零引用；teachin-plan 全链
   纯函数零猜测，五类模糊面稳定拒绝转人工）。

R9「同次 capture 身份链」的金牌重写经弱化比对判净收紧（唯一移除的断言钉的正是缺陷行为，
替换为双向更强断言）。

## 六 Medium 与处置

| # | 发现 | 处置 |
|---|---|---|
| M1 | legacy 模板内嵌对象与盘上字节无一致性校验 | 已修：盘上字节重新 parse 再投影 + 序列化相等校验 |
| M2 | legacy 跳过生成期具名前置门 | 已修：entity lock 空数组字节门 + mutation 复检，具名 reason |
| M3 | cycle-entry 前置校验早退不收尾（潜伏漏路径） | 已修（替代方案）：record 交接点归属回收，保全冻结断言 |
| M4 | 完成语义只绑初始页（多标签两向皆错） | 已修：逐页订阅 + 活跃集清空判定；codex 终审逮出枚举竞态残缝后补两处立即重检闭合 |
| M5 | global 断言双重投影，裁判输入偏离签名集 | 已修：preflight 原地清空再投影，保金牌字面与共享引用 |
| M6 | raw-axes 预检窄于绑定核，错绑烧一次性 authority | 已修（R10 修单）：金牌扩两键 + 摘要例外，预检全量对齐 |

## 五 Low 与处置

已修：完成控件激活闸（L2）、装配死参数与未检返回值（L3）。
挂账：comparator 的 promotionEligible 真值悬空旗标（被两枚冻结金牌钉死，无消费者，
编排出口恒 promotionReady:false）；plan 产物与 CLEAN 裸词 stdout 自述标记；签名门前白烧
fresh（fail-closed 无洞，记录取舍）。

## 附带核出的既有红（非本层所致）

teachin-observation 与 teachin-runtime-successor 家族 5 枚金牌既有红（含两枚撤销守卫按设计红，
详见全仓漂移普查记录）；grok R2 残差之 preflight reason 折钝仍在（不阻断）。
