#!/usr/bin/env node
// wf-open-smoke C1 去除已作废 known-atoms=18 后的完整纯编译注册后继。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-open-smoke-c1-current-remainder unitCheckId:wf-open-smoke-unit-c1-current-registration
// lifecycle-successor: {"sourceObligationId":"hg-wf-open-smoke-c1-current-remainder","unitCheckId":"wf-open-smoke-unit-c1-current-registration","coverageRelation":"full"}

const unitCheckId = 'wf-open-smoke-unit-c1-current-registration';
for (const atom of ['nav.workflowManagement', 'workflow.open']) {
  if (!isCompilableAtom(atom)) {
    console.error(`FAIL ${unitCheckId}: ${atom} 应可编译`);
    process.exit(1);
  }
}
console.log(`ok   ${unitCheckId}`);
