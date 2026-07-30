#!/usr/bin/env node
// M3 威胁模型探针：把 codex code-r1 M3 的两条路各跑一遍，证明「收窄口径」是诚实口径。
//   路 A（界内，读取方必须拦）：单侧改名——文件名换成本次 digest，内文顶层摘要还是旧档身份。
//   路 B（界外，读取方拦不住，且本轮明确不声称能拦）：协调双改——改名 + 同步改内文顶层摘要。
// 结论口径见 GRILL D4：边车落点就是本次 run 可写的 out-dir，同一把写权限连 capture 本体
// 都能改；路 B 要防须另立可信收据/manifest 链，属后继契约。零 SUT、零 network。

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence,
} from '../../../../lib/teachin/cycle-evidence-context.mjs';
import {
  buildCycleEvidenceDocument, cycleEvidenceFileName, readCycleEvidence, writeCycleEvidenceSidecar,
} from '../../../../lib/teachin/cycle-evidence-output.mjs';

const CURRENT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const STALE = 'f0e1d2c3b4a59687786958473625140f0e1d2c3b4a59687786958473625140fe';

function build(captureSha256, refusalPoint) {
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => {
    safeEmit(refusalPoint, { stage: 'source-raw-execute', reason: 'RUN_COMPLETION_INVALID' });
  });
  const built = buildCycleEvidenceDocument({
    snapshot: sealCycleEvidence(collector),
    captureSha256,
    recordedAt: '2026-07-01T00:00:00.000Z',
  });
  if (built?.ok !== true) throw new Error(`成档失败：${JSON.stringify(built)}`);
  return built.document;
}

const dir = mkdtempSync(join(tmpdir(), 'casey-m3-threat-'));
let result;
try {
  // 旧档：另一枚 capture 的证据，事件归因与本次不同（可辨识）。
  const stale = build(STALE, 'observer.finish');
  if (writeCycleEvidenceSidecar({ outDir: dir, document: stale })?.ok !== true) {
    throw new Error('旧档落盘失败');
  }
  const staleBytes = readFileSync(join(dir, cycleEvidenceFileName(STALE)), 'utf8');

  // 路 A：只改文件名（内文仍是旧档身份）。
  const pathA = join(dir, cycleEvidenceFileName(CURRENT));
  writeFileSync(pathA, staleBytes, 'utf8');
  const readA = readCycleEvidence(CURRENT, { outDir: dir });

  // 路 B：改名 + 同步把内文顶层 captureSha256 改成本次 digest（events 仍是旧档的）。
  const forged = JSON.parse(staleBytes);
  forged.captureSha256 = CURRENT;
  writeFileSync(pathA, `${JSON.stringify(forged, null, 2)}\n`, 'utf8');
  const readB = readCycleEvidence(CURRENT, { outDir: dir });

  result = {
    pathA_singleSidedRename: {
      accepted: readA?.ok === true,
      reason: readA?.reason || null,
      inContract: true,
    },
    pathB_coordinatedForge: {
      accepted: readB?.ok === true,
      staleEventsSurvived: JSON.stringify(readB?.document?.events || null)
        === JSON.stringify(stale.events),
      inContract: false,
    },
  };
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(JSON.stringify(result, null, 2));

if (result.pathA_singleSidedRename.accepted) {
  console.error('PROBE_RED: 界内的单侧改名冒充竟被读取方接受——收窄后的契约本身就没兑现');
  process.exit(1);
}
if (!result.pathB_coordinatedForge.accepted) {
  console.error('PROBE_RED: 协调双改竟没绕过——那 M3 的收窄措辞是低估，应改回强声明');
  process.exit(1);
}
console.log('PROBE_GREEN: 单侧改名被拦（界内已兑现）；协调双改可绕（界外，GRILL D4 已按此收窄措辞）');
