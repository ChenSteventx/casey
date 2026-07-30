#!/usr/bin/env node
// S5 生产 façade 静态咬合：canonical core 必须真实构造并被唯一入口委托。
// 只读源码与 ESM 导出；零 SUT/browser/network/LLM。

import { readFileSync } from 'node:fs';

const TAG = 'teachin-replayability-orchestrator-wiring';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

let source = '';
let coreSource = '';
let adapterSource = '';
let facadeApi;
let coreApi;
try {
  source = readFileSync(
    new URL('../../lib/teachin/dual-replay-orchestrator.mjs', import.meta.url),
    'utf8',
  );
  coreSource = readFileSync(
    new URL('../../lib/teachin/dual-replay-orchestrator-core.mjs', import.meta.url),
    'utf8',
  );
  adapterSource = readFileSync(
    new URL('../../lib/teachin/runtime-cycle-adapter.mjs', import.meta.url),
    'utf8',
  );
  facadeApi = await import('../../lib/teachin/dual-replay-orchestrator.mjs');
  coreApi = await import('../../lib/teachin/dual-replay-orchestrator-core.mjs');
} catch (error) {
  failures.push(`production facade unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

if (source && facadeApi) {
  await check('W1 façade 只导出一个自然语言上层可调函数', () => {
    assert(JSON.stringify(Object.keys(facadeApi).sort()) === '["runTeachinReplayabilityCycle"]',
      `生产导出面不闭合：${JSON.stringify(Object.keys(facadeApi).sort())}`);
    assert(typeof facadeApi.runTeachinReplayabilityCycle === 'function',
      'runTeachinReplayabilityCycle 必须是函数');
    assert(JSON.stringify(Object.keys(coreApi)) === '["createDualReplayOrchestratorCore"]',
      `core 导出面不闭合：${JSON.stringify(Object.keys(coreApi))}`);
  });

  await check('W2 六个 canonical 依赖全部静态 import', () => {
    const patterns = [
      /import\s+\*\s+as\s+dualReplayApi\s+from\s+['"]\.\.\/dual-replay\/index\.mjs['"]/,
      /import\s+\*\s+as\s+runAuthorityApi\s+from\s+['"]\.\.\/dual-replay\/run-authority\.mjs['"]/,
      /import\s+atomRegistry\s+from\s+['"]\.\.\/atoms-registry\.snapshot\.json['"]\s+with\s*\{\s*type:\s*['"]json['"]\s*\}/,
      /import\s*\{\s*createDualReplayOrchestratorCore\s*\}\s*from\s*['"]\.\/dual-replay-orchestrator-core\.mjs['"]/,
      /import\s+\*\s+as\s+resolvedProjectionApi\s+from\s+['"]\.\/resolved-projection\.mjs['"]/,
      /import\s*\{\s*canonicalRuntimeCycleAdapter\s*\}\s*from\s*['"]\.\/runtime-cycle-adapter\.mjs['"]/,
    ];
    for (const pattern of patterns) {
      assert(pattern.test(source), `缺 canonical 静态 import：${pattern}`);
    }
  });

  await check('W3 module scope 恰构造一个完整 canonical core', () => {
    assert((source.match(/createDualReplayOrchestratorCore\s*\(/g) || []).length === 1,
      'canonical core 必须恰构造一次');
    assert((source.match(/^const\s+canonicalCore\s*=/gm) || []).length === 1,
      'canonicalCore 必须是唯一 module-scope const');
    const construction = source.match(
      /^const\s+canonicalCore\s*=\s*createDualReplayOrchestratorCore\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;/m,
    );
    assert(construction, '缺 module-scope canonicalCore 构造');
    const body = construction[1];
    for (const binding of [
      /\bdualReplayApi\b/,
      /\brunAuthorityApi\b/,
      /\bresolvedProjectionApi\b/,
      /\batomRegistry\b/,
      /\bruntimeCycleAdapter\s*:\s*canonicalRuntimeCycleAdapter\b/,
    ]) {
      assert(binding.test(body), `canonical core 漏依赖：${binding}`);
    }
  });

  await check('W4 唯一函数只 await/return canonicalCore.runCycle(input)', () => {
    const fn = source.match(
      /export\s+async\s+function\s+runTeachinReplayabilityCycle\s*\(\s*input\s*\)\s*\{([\s\S]*?)\}/,
    );
    assert(fn, '生产入口必须是单参 async function');
    const normalized = fn[1].replace(/\s+/g, ' ').trim();
    assert(/^return (?:await )?canonicalCore\.runCycle\(input\);?$/.test(normalized),
      `生产入口含本地逻辑：${normalized}`);
    assert((source.match(/\bexport\s+(?:async\s+)?function\b/g) || []).length === 1,
      'façade 不得有第二个导出函数');
    for (const forbidden of [
      /\bequivalenceReceipt\b/,
      /\bdevelopmentOnly\b/,
      /\bpromotionReady\b/,
      /\bpromotionEligible\b/,
      /\bequivalent\s*[:=]/,
      /\bok\s*:\s*true/,
    ]) {
      assert(!forbidden.test(source), `façade 不得本地组装结果：${forbidden}`);
    }
  });

  await check('W5 无动态/provider/test/底层 runner 旁路且文件小于 600 行', () => {
    for (const inspected of [source, coreSource]) {
      for (const forbidden of [
        /process\.env/,
        /globalThis/,
        /import\s*\(/,
        /createRuntimeCycleAdapter/,
        /(?:^|\/)tests?\//,
        /raw-replay-runner/,
        /fresh-runtime/,
        /playwright/,
        /(?:^|\/)(?:verdict|report)(?:\.mjs)?['"]/m,
      ]) {
        assert(!forbidden.test(inspected), `orchestrator 命中禁止旁路：${forbidden}`);
      }
    }
    for (const forbidden of [/\bissuer\b/i, /\bprovider\b/i, /\bfactory\b/i]) {
      assert(!forbidden.test(source), `生产 façade 命中注入旁路：${forbidden}`);
    }
    assert(source.trimEnd().split(/\r?\n/).length < 600, '生产 façade 必须 <600 行');
    const ownLines = readFileSync(new URL(import.meta.url), 'utf8').trimEnd().split(/\r?\n/).length;
    assert(ownLines < 600, 'wiring golden 必须 <600 行');
  });

  await check('W6 canonical adapter 装配非空心：reset/claim/preflight 三接缝绑定真实现', () => {
    // 负向钉：canonical 装配不得把 deps.* 裸转发/裸传——createRuntimeCycleAdapter({}) 下
    // 裸 deps.* 即 undefined，resetIssuer 运行期 TypeError、preparedRun 恒 RUN_COMPLETION_INVALID。
    assert(!/return\s+deps\.verifyReset\s*\(/.test(adapterSource),
      'resetIssuer 不得裸转发 deps.verifyReset（空心装配）');
    assert(!/inspectClaimedReplayRuntime\s*:\s*deps\.inspectClaimedReplayRuntime\b/
      .test(adapterSource), 'preparedRun 不得裸传 deps.inspectClaimedReplayRuntime');
    assert(!/runCanonicalPreflight\s*:\s*deps\.runCanonicalPreflight\b/.test(adapterSource),
      'preparedRun 不得裸传 deps.runCanonicalPreflight');
    // 正向钉：三接缝各以 seam(deps.X, canonical 实现) 装配，canonical 实现来自静态 import。
    for (const symbol of ['verifyReset', 'inspectClaimedReplayRuntime', 'runCanonicalPreflight']) {
      const bound = adapterSource.match(new RegExp(
        `seam\\(\\s*deps\\.${symbol}\\s*,\\s*([A-Za-z_$][\\w$]*(?:\\.[\\w$]+)?)\\s*\\)`,
      ));
      assert(bound, `${symbol} 必须以 seam(deps.${symbol}, canonical 实现) 装配`);
      const root = bound[1].split('.')[0];
      assert(new RegExp(
        `import\\s*\\{[^}]*\\b${root}\\b[^}]*\\}\\s*from\\s*['"]\\.[./\\w-]+\\.mjs['"]`,
      ).test(adapterSource),
      `${symbol} 的 canonical 实现 ${root} 必须来自静态 import（非本地空壳）`);
    }
  });

  await check('W7 compare 生产调用点唯一且闭合传满 comparator exact 7 键字面', () => {
    assert((coreSource.match(/compareSemanticReplayReceipts\s*\(/g) || []).length === 1,
      'core 必须恰有一个 compare 调用点');
    const call = coreSource.match(/compareSemanticReplayReceipts\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    assert(call, 'compare 调用点必须以对象字面量闭合传参');
    const keys = [...call[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)]
      .map((matched) => matched[1]).sort();
    assert(keys.join(',') === [
      'distilledComparisonGrant', 'distilledReceiptAuthority', 'distilledReceiptBytes',
      'pairAuthority', 'sourceComparisonGrant', 'sourceReceiptAuthority', 'sourceReceiptBytes',
    ].join(','), `compare 调用点键集不闭合：${keys}`);
  });
}

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} RED`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`\n${TAG}: ${passed} passed, 0 RED`);
