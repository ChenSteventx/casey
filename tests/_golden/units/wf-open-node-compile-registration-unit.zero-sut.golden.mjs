#!/usr/bin/env node
// wf-open-node C1 的现役纯编译注册后继；不承接已作废的 known-atoms=18/openToolPicker 反例。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-open-node-c1-workflow-opennode-membership-unit unitCheckId:wf-open-node-unit-c1-workflow-opennode-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-open-node-c1-workflow-opennode-membership-unit","unitCheckId":"wf-open-node-unit-c1-workflow-opennode-membership","coverageRelation":"full"}

const unitCheckId = 'wf-open-node-unit-c1-workflow-opennode-membership';
if (!isCompilableAtom('workflow.openNode')) {
  console.error(`FAIL ${unitCheckId}: workflow.openNode 应可编译`);
  process.exit(1);
}
console.log(`ok   ${unitCheckId}`);
