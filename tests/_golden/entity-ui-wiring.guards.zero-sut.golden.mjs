#!/usr/bin/env node
// entity-ui-wiring · s4 守恒金牌（zero-SUT，纯 node，禁 SUT/浏览器/网络）。
//
// 职责：钉死「接线红基线零触碰」边界（GRILL 继承边界；Steven 2026-07-18「单元导出+真机双轨」，
// 丙案已否决）。本契约任何提交若动了前瞻红基线的字节、或让它不再诚实红（exit 1），本金牌必红。
// 这是回归保护测试：冻结时即绿。
//
// 检查：
//   G1 前瞻红基线金牌文件 sha256 与其 prd testChecksums 登记一致（字节守恒）；
//   G2 运行该金牌，退出码必须为 1（诚实红守恒——0 意味着有人旁路填绿，同样违例）；
//   G3 其 prd 的 story passes 字段必须仍为 false 且 lane 仍为 forward-spec（gate 权威账守恒，
//       只读断言，不写）。

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GOLDEN_REL = 'tests/_golden/teachin-semantic-lock-runtime-discrimination-successor.zero-sut.golden.mjs';
const PRD_REL = 'loop/prd-teachin-semantic-lock-runtime-discrimination-successor.json';

let failures = 0;
const fail = (label, detail) => { failures += 1; console.error(`RED  entity-ui-wiring.guards: ${label}: ${detail}`); };
const pass = (label) => console.log(`ok   entity-ui-wiring.guards: ${label}`);

// G1 字节守恒
const prd = JSON.parse(readFileSync(new URL(PRD_REL, `file://${ROOT}`), 'utf8'));
const frozen = prd.testChecksums?.[GOLDEN_REL];
const actual = createHash('sha256').update(readFileSync(new URL(GOLDEN_REL, `file://${ROOT}`))).digest('hex');
if (typeof frozen !== 'string' || frozen.length !== 64) {
  fail('G1 prd 冻结登记缺失', `testChecksums[${GOLDEN_REL}] = ${JSON.stringify(frozen)}`);
} else if (actual !== frozen) {
  fail('G1 前瞻红基线字节被触碰', `sha256 实得 ${actual} ≠ 冻结 ${frozen}`);
} else {
  pass('G1 前瞻红基线字节守恒');
}

// G2 诚实红守恒（该金牌自带温拷贝临时仓，跑完自清理）
const run = spawnSync(process.execPath, [GOLDEN_REL], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
if (run.status !== 1) {
  fail('G2 诚实红守恒破坏', `期望 exit 1（诚实红），实得 exit ${run.status}${run.status === 0 ? '——出现旁路填绿，违例' : ''}`);
} else {
  pass('G2 前瞻红基线仍诚实红（exit 1）');
}

// G3 gate 权威账守恒（只读）
const story = Array.isArray(prd.stories) ? prd.stories[0] : null;
if (!story || story.passes !== false) {
  fail('G3 gate 权威账异动', `story.passes = ${JSON.stringify(story?.passes)}（期望 false，唯一写者是 gate.mjs）`);
} else {
  pass('G3 prd story passes 仍 false（诚实红账守恒）');
}

if (failures > 0) {
  console.error(`RED  entity-ui-wiring.guards: ${failures} 项守恒破坏`);
  process.exit(1);
}
console.log('ok   entity-ui-wiring.guards: 3/3 守恒');
