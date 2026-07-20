#!/usr/bin/env node
// wf-set-node-field C1 的现役纯后继；旧 known-atoms=18/openToolPicker 反例仍留源义务隔离。
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';

// sourceObligationId:hg-wf-set-node-field-c1-membership-unit unitCheckId:wf-set-node-field-unit-c1-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-set-node-field-c1-membership-unit","unitCheckId":"wf-set-node-field-unit-c1-membership","coverageRelation":"full"}
// sourceObligationId:hg-wf-set-node-field-c1-nonsense-negative-unit unitCheckId:wf-set-node-field-unit-c1-nonsense-negative
// lifecycle-successor: {"sourceObligationId":"hg-wf-set-node-field-c1-nonsense-negative-unit","unitCheckId":"wf-set-node-field-unit-c1-nonsense-negative","coverageRelation":"full"}

const membershipCheckId = 'wf-set-node-field-unit-c1-membership';
if (!isCompilableAtom('workflow.setNodeField')) {
  console.error(`FAIL ${membershipCheckId}: workflow.setNodeField 应可编译`);
  process.exit(1);
}
console.log(`ok   ${membershipCheckId}`);
const nonsenseCheckId = 'wf-set-node-field-unit-c1-nonsense-negative';
if (isCompilableAtom('nonsense.x')) {
  console.error(`FAIL ${nonsenseCheckId}: nonsense.x 不应可编译`);
  process.exit(1);
}
console.log(`ok   ${nonsenseCheckId}`);
