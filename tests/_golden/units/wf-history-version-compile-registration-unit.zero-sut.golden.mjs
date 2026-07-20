#!/usr/bin/env node
// wf-history-version C1 的纯编译注册后继；事件形状、执行接线和 assertionAtoms 挂靠仍留原行为隔离。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-history-version-c1-atom-compile-knowledge-membership unitCheckId:wf-history-version-unit-c1-atom-compile-knowledge-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-history-version-c1-atom-compile-knowledge-membership","unitCheckId":"wf-history-version-unit-c1-atom-compile-knowledge-membership","coverageRelation":"full"}

const unitCheckId = 'wf-history-version-unit-c1-atom-compile-knowledge-membership';
for (const atom of ['workflow.clickEditorButton', 'workflow.closeDrawer']) {
  if (!isCompilableAtom(atom)) {
    console.error(`FAIL ${unitCheckId}: ${atom} 应在当前编译分派注册中`);
    process.exit(1);
  }
}
for (const atom of ['workflow.clickEditorButton.typo', 'workflow.closeDrawer.typo']) {
  if (isCompilableAtom(atom)) {
    console.error(`FAIL ${unitCheckId}: ${atom} 不应可编译`);
    process.exit(1);
  }
}
console.log(`ok   ${unitCheckId}`);
