#!/usr/bin/env node
// wf-add-node C1 的现役纯编译注册后继；不承接已作废的 known-atoms=18/openToolPicker 反例。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-add-node-c1-workflow-addnode-membership-unit unitCheckId:wf-add-node-unit-c1-workflow-addnode-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-add-node-c1-workflow-addnode-membership-unit","unitCheckId":"wf-add-node-unit-c1-workflow-addnode-membership","coverageRelation":"full"}
// sourceObligationId:hg-wf-add-node-c1-workflow-connectnodes-membership-unit unitCheckId:wf-add-node-unit-c1-workflow-connectnodes-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-add-node-c1-workflow-connectnodes-membership-unit","unitCheckId":"wf-add-node-unit-c1-workflow-connectnodes-membership","coverageRelation":"full"}

for (const [unitCheckId, atom] of [
  ['wf-add-node-unit-c1-workflow-addnode-membership', 'workflow.addNode'],
  ['wf-add-node-unit-c1-workflow-connectnodes-membership', 'workflow.connectNodes'],
]) {
  if (!isCompilableAtom(atom)) {
    console.error(`FAIL ${unitCheckId}: ${atom} 应可编译`);
    process.exit(1);
  }
  console.log(`ok   ${unitCheckId}`);
}
