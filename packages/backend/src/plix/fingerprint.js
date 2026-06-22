/**
 * PLIX Fingerprint — diff0-fork v2.0.0
 *
 * Classification d'un diff en fingerprint ternaire Base 243 (3^5).
 * Chaque dimension du TritVector[5] est derivee des scores UAE.
 *
 * Dimensions:
 *   t0: code_quality    — score moyen des segments
 *   t1: security_risk   — presence de patterns critiques
 *   t2: performance     — complexity delta
 *   t3: architecture    — couplage inter-modules
 *   t4: test_coverage   — ratio tests/code dans le diff
 *
 * Chaque trit ∈ {-1, 0, +1} mappe sur {0, 85, 170} en RGB24.
 *
 * IntentHash: 0xDIFF0_FORK_PLIX_FINGERPRINT_20260604
 */

'use strict';

/**
 * Quantifie un score [0, 242] en trit {-1, 0, +1}
 */
function levelToTrit(level) {
  if (level < 81) return -1;   // low: 0-80
  if (level < 162) return 0;   // mid: 81-161
  return +1;                    // high: 162-242
}

/**
 * Calcule le fingerprint PLIX d'un diff analyse
 * @param {object} analysis — resultat du LLM { comments, summary, scores }
 * @returns {number[]} TritVector[5] — [t0, t1, t2, t3, t4]
 */
function computeFingerprint(analysis) {
  const comments = analysis.comments || [];

  // t0: code_quality — inverse du nombre de commentaires severity=warning+
  const warningCount = comments.filter(c => c.severity === 'warning' || c.severity === 'critical').length;
  const qualityScore = Math.max(0, 242 - warningCount * 40);
  const t0 = levelToTrit(qualityScore);

  // t1: security_risk — presence de commentaires critical
  const criticalCount = comments.filter(c => c.severity === 'critical').length;
  const securityScore = Math.min(242, criticalCount * 121);
  const t1 = levelToTrit(securityScore);

  // t2: performance — estime de la longueur du diff
  const diffLength = analysis.diffLength || 0;
  const perfScore = diffLength > 500 ? 242 : diffLength > 200 ? 121 : 0;
  const t2 = levelToTrit(perfScore);

  // t3: architecture — diversite des fichiers touches
  const files = new Set((comments || []).map(c => c.path));
  const archScore = files.size > 10 ? 242 : files.size > 5 ? 121 : 0;
  const t3 = levelToTrit(archScore);

  // t4: test_coverage — presence de fichiers test dans les commentaires
  const testFiles = comments.filter(c => /test|spec/i.test(c.path)).length;
  const totalFiles = Math.max(files.size, 1);
  const testRatio = testFiles / totalFiles;
  const testScore = testRatio > 0.3 ? 242 : testRatio > 0.1 ? 121 : 0;
  const t4 = levelToTrit(testScore);

  return [t0, t1, t2, t3, t4];
}

/**
 * Convertit un TritVector[5] en niveau Base 243 unique
 */
function tritVectorToLevel(tritVector) {
  const [t0, t1, t2, t3, t4] = tritVector;
  // Map trit {-1,0,+1} -> {0,1,2}
  const b = (t0 + 1);
  const g = (t1 + 1) * 3;
  const r = (t2 + 1) * 9;
  const extra = (t3 + 1) * 27 + (t4 + 1) * 81;
  return Math.min(242, b + g + r + extra);
}

/**
 * Calcule la distance Hamming entre deux TritVector[5]
 */
function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < 5; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

module.exports = {
  computeFingerprint,
  tritVectorToLevel,
  hammingDistance,
  levelToTrit,
};
