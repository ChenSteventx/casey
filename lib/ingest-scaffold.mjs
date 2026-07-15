// lib/ingest-scaffold.mjs —— 归一脚手架纯函数核心（零 I/O、零 LLM、零真机、字节稳定可复现）。
// 决策 docs/plans/ingest-scaffold/proposed/GRILL.md（D6/D8/D10）。
//
//   buildCandidateSkeleton(freeText, { caseId }) -> 候选骨架对象
//
// 相0 归一的前段脚手架：把一段自由文本用例零 LLM 包成 schema 合规的候选骨架——泊 source.raw、发一条
// route:human 占位步（诚实桩），开箱过 parseTestCase。自由文本→N 意图步的语义切分是 CLI 外 LLM 的活
//（切分是语义判断 = LLM territory，镜像 distill D6「零 LLM 投影不臆断分组」），脚手架绝不臆断切分。
//
// I/O（读自由文本、算凭据门、落盘）与 caseId 形状/凭据闸留 CLI 层（bin/scaffold-case.mjs）；本纯函数只吃
// 已读入的字符串，同输入产同字节（不含 ingestedAt 等时刻字段，缺席交下游 ingest 落章——金牌可字节确定）。

// 占位步 reason：留脚手架占位痕迹 + 指明须 CLI 外 LLM 归一后经 parseTestCase 重新入场（route:human 诚实桩）。
const PLACEHOLDER_REASON = '归一脚手架骨架占位：自由文本须 CLI 外 LLM 归一成真实意图步（actionHint/inputValue/expected），经 parseTestCase 重新入场 → route:human';
const PLACEHOLDER_INTENT = '（占位：待 CLI 外 LLM 从 source.raw 归一真实意图步）';

export function buildCandidateSkeleton(freeText, { caseId } = {}) {
  // 键顺序固定（对象字面量插入序）→ JSON.stringify 字节稳定；source 键闭合 {kind,raw}（不加 signed 类字段，
  // 否则被 parseTestCase 拒，GRILL D10）；不含 expected（断言归相2）、不含 target（不臆造 startUrl）。
  return {
    schemaVersion: 1,
    caseId,
    source: { kind: 'freetext', raw: freeText },
    steps: [
      {
        intentId: 'i1',
        intent: PLACEHOLDER_INTENT,
        route: 'human',
        reason: PLACEHOLDER_REASON,
      },
    ],
    uniquePrefix: 'atl_',
  };
}
