/**
 * TritThermoGate — diff0-fork v2.0.0
 *
 * Decision ternaire basee sur l'entropie du signal de review.
 *
 * +1 : POST inline comment (signal clair, entropie basse)
 *  0 : LOG only (entropie haute, pas assez de signal)
 * -1 : ESCALADE FLUX (critique, HITL requis — D4)
 *
 * L'entropie est calculee a partir du TritVector[5].
 * Chaque trit ∈ {-1, 0, +1}. L'entropie = nombre de trits != 0 / 5.
 *
 * IntentHash: 0xDIFF0_FORK_THERMO_GATE_20260604
 */

'use strict';

class TritThermoGate {
  /**
   * Calcule l'entropie d'un TritVector[5]
   * @param {number[]} tritVector — [t0, t1, t2, t3, t4], each ∈ {-1, 0, +1}
   * @returns {number} entropie ∈ [0, 1]
   */
  computeEntropy(tritVector) {
    if (!tritVector || tritVector.length !== 5) return 1.0;
    const active = tritVector.filter(t => t !== 0).length;
    return active / 5;
  }

  /**
   * Decision ternaire
   * @param {object} analysis — resultat du LLM { tritVector, comments, summary }
   * @returns {{ action: number, entropy: number, reason: string }}
   *   action: +1 (POST), 0 (LOG), -1 (ESCALADE FLUX)
   */
  decide(analysis) {
    const tritVector = analysis.tritVector || [0, 0, 0, 0, 0];
    const entropy = this.computeEntropy(tritVector);

    // -1 : security_risk = +1 OR critical comments present
    const hasCritical = (analysis.comments || []).some(c => c.severity === 'critical');
    if (tritVector[1] === 1 || hasCritical) {
      return { action: -1, entropy, reason: 'critical_security_or_comment' };
    }

    // +1 : entropie basse (signal clair) + au moins un commentaire
    if (entropy <= 0.4 && (analysis.comments || []).length > 0) {
      return { action: 1, entropy, reason: 'clear_signal_with_comments' };
    }

    // 0 : entropie haute ou pas de commentaires
    return { action: 0, entropy, reason: 'high_entropy_or_no_comments' };
  }
}

module.exports = { TritThermoGate };
