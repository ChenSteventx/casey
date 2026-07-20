#!/usr/bin/env node
// replay-video V4a 的纯装配后继：只调用已导出的 assembleReportModel；不启动/连接 SUT、浏览器或 listener。
import { assembleReportModel } from '../../../lib/report-model.mjs';

// sourceObligationId:hg-replay-video-v4a-assembler-mapping-unit unitCheckId:replay-video-unit-v4a-assembler-mapping
// lifecycle-successor: {"sourceObligationId":"hg-replay-video-v4a-assembler-mapping-unit","unitCheckId":"replay-video-unit-v4a-assembler-mapping","coverageRelation":"full"}

const CASE_ID = 'tc_video_probe';
const axes = {
  caseId: CASE_ID,
  steps: [
    {
      stepId: 'atstep_0',
      intentId: 'intent_0',
      atom: 'workflow.create',
      action: { resolution: 'unique' },
      postAssertions: [
        { kind: 'textVisible', op: 'contains', value: '列表', actual: '列表', ok: true, soft: false },
      ],
      forensics: { network: [], lifecycle: {} },
    },
    {
      stepId: 'atstep_1',
      intentId: 'intent_1',
      atom: 'workflow.publish',
      action: { resolution: 'unique' },
      postAssertions: [
        { kind: 'textVisible', op: 'contains', value: '已发布', actual: null, ok: false, soft: false },
      ],
      forensics: {
        network: [
          { url: '/api/publish', status: 500, initiator: 'fetch', attributedStepId: 'atstep_1' },
        ],
        lifecycle: {},
      },
    },
  ],
};
const verdict = {
  caseId: CASE_ID,
  steps: [
    { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.create', verdict: 'PASS', reason: null },
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.publish', verdict: 'SUT_DEFECT', reason: null },
  ],
};
const videoMeta = {
  file: 'video.webm',
  steps: [
    { stepId: 'atstep_0', videoAt: 0 },
    { stepId: 'atstep_1', videoAt: 4200 },
  ],
};

const failures = [];
let passed = 0;
function check(unitCheckId, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId}`);
  } catch (error) {
    failures.push(`${unitCheckId}: ${String(error?.message || error).slice(-500)}`);
  }
}

check('replay-video-unit-v4a-assembler-mapping', () => {
  const model = assembleReportModel({
    caseId: CASE_ID,
    channel: 'web',
    verdict,
    axes,
    meta: { generatedAt: '2026-07-03T00:00:00.000Z' },
    videoMeta,
  });
  const s0 = model.steps.find((step) => step.stepId === 'atstep_0');
  const s1 = model.steps.find((step) => step.stepId === 'atstep_1');
  if (!s0?.attachments || s0.attachments.video !== 'video.webm' || s0.attachments.videoAt !== 0) {
    throw new Error(`atstep_0 attachments 须 {video:video.webm, videoAt:0}，实际 ${JSON.stringify(s0?.attachments)}`);
  }
  if (!s1?.attachments || s1.attachments.video !== 'video.webm' || s1.attachments.videoAt !== 4200) {
    throw new Error(`atstep_1 attachments 须 {video:video.webm, videoAt:4200}，实际 ${JSON.stringify(s1?.attachments)}`);
  }
  if (!s1.defectTicket || s1.defectTicket.videoAt !== 4200) {
    throw new Error(`败步缺陷单 videoAt 须 4200，实际 ${JSON.stringify(s1.defectTicket?.videoAt)}`);
  }
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`replay-video unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`replay-video unit: ${passed}/${passed} passed`);
