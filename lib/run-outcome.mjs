const VERDICTS = ['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN'];

export function summarizeRunVerdict(verdictDoc) {
  const steps = Array.isArray(verdictDoc?.steps) ? verdictDoc.steps : [];
  const counts = Object.fromEntries(VERDICTS.map((name) => [name, 0]));
  let malformed = !Array.isArray(verdictDoc?.steps);
  for (const step of steps) {
    const verdict = step?.verdict;
    if (!VERDICTS.includes(verdict)) {
      malformed = true;
      continue;
    }
    counts[verdict] += 1;
  }
  return {
    counts,
    total: steps.length,
    allPass: !malformed && steps.length > 0 && counts.PASS === steps.length,
    malformed,
  };
}
