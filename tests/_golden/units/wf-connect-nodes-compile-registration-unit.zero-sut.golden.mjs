#!/usr/bin/env node
// wf-connect-nodes C1 的现役纯编译注册后继；不承接已作废的 known-atoms=18/openToolPicker 反例。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-connect-nodes-c1-workflow-connectnodes-membership-unit unitCheckId:wf-connect-nodes-unit-c1-workflow-connectnodes-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-connect-nodes-c1-workflow-connectnodes-membership-unit","unitCheckId":"wf-connect-nodes-unit-c1-workflow-connectnodes-membership","coverageRelation":"full"}
// sourceObligationId:hg-wf-connect-nodes-c1-workflow-addnode-membership-unit unitCheckId:wf-connect-nodes-unit-c1-workflow-addnode-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-connect-nodes-c1-workflow-addnode-membership-unit","unitCheckId":"wf-connect-nodes-unit-c1-workflow-addnode-membership","coverageRelation":"full"}

for (const [unitCheckId, atom] of [
  ['wf-connect-nodes-unit-c1-workflow-connectnodes-membership', 'workflow.connectNodes'],
  ['wf-connect-nodes-unit-c1-workflow-addnode-membership', 'workflow.addNode'],
]) {
  if (!isCompilableAtom(atom)) {
    console.error(`FAIL ${unitCheckId}: ${atom} 应可编译`);
    process.exit(1);
  }
  console.log(`ok   ${unitCheckId}`);
}
