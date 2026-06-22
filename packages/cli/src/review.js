/**
 * CLI — diff0-fork v2.0.0
 *
 * Interface en ligne de commande pour le review manuel.
 * Usage: node packages/cli/src/review.js --pr 42 --repo BRAIN
 *
 * IntentHash: 0xDIFF0_FORK_CLI_20260604
 */

'use strict';

const { LLMClient } = require('../backend/src/llm/client');
const { TritThermoGate } = require('../backend/src/thermo/gate');

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
};

const prNumber = getArg('--pr');
const repo = getArg('--repo');
const dryRun = args.includes('--dry-run');

if (!prNumber || !repo) {
  console.log(`
diff0-fork CLI v2.0.0

Usage:
  node packages/cli/src/review.js --pr <number> --repo <name> [--dry-run]

Examples:
  node packages/cli/src/review.js --pr 42 --repo BRAIN
  node packages/cli/src/review.js --pr 42 --repo BRAIN --dry-run
  node packages/cli/src/review.js --pr 1 --repo NEXUS --dry-run
`);
  process.exit(1);
}

async function main() {
  console.log(`[diff0-fork] Manual review: ${repo}#${prNumber}${dryRun ? ' (dry-run)' : ''}`);

  const llm = new LLMClient();

  // Simulated diff for manual review
  const diff = `[Manual review] Diff from ${repo}#${prNumber}`;

  const analysis = await llm.analyzeDiff(diff, `gerivdb/${repo}`);
  const gate = new TritThermoGate();
  const decision = gate.decide(analysis);

  console.log(`\nDecision: ${decision.action > 0 ? 'POST' : decision.action < 0 ? 'ESCALADE FLUX' : 'LOG'}`);
  console.log(`Entropy: ${decision.entropy.toFixed(2)}`);
  console.log(`Comments: ${(analysis.comments || []).length}`);
  console.log(`Summary: ${analysis.summary || '(none)'}`);
  console.log(`TritVector: [${(analysis.tritVector || []).join(', ')}]`);

  if (dryRun) {
    console.log('\n[DRY-RUN] No comments posted');
  }

  process.exit(decision.action < 0 ? 2 : 0);
}

main().catch(err => {
  console.error('[diff0-fork] Error:', err.message);
  process.exit(1);
});
