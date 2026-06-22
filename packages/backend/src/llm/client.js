/**
 * LLM Client — diff0-fork v2.0.0
 *
 * Route les appels LLM via GATEWAY-MANAGER (BDCP enforced).
 * Endpoint: POST http://localhost:9000/openai/v1/chat/completions
 *
 * Le prompt demande un retour TritVector[5] (PLIX base 243)
 * au lieu de texte libre brut.
 *
 * IntentHash: 0xDIFF0_FORK_LLM_CLIENT_20260604
 */

'use strict';

const { request } = require('undici');

const SYSTEM_PROMPT = `You are diff0-review-agent, a code review agent for the gerivdb/* ecosystem.

Analyze the provided diff and return a JSON object with:
1. "comments": array of { path, line, body, severity } for inline review comments
2. "summary": one-paragraph summary of findings
3. "tritVector": [t0, t1, t2, t3, t4] where each t ∈ {-1, 0, +1}
   representing the ternary classification of the review:
   t0: code_quality (-1=poor, 0=acceptable, +1=excellent)
   t1: security_risk (-1=none, 0=low, +1=critical)
   t2: performance (-1=fast, 0=normal, +1=slow/regression)
   t3: architecture (-1=clean, 0=acceptable, +1=concern)
   t4: test_coverage (-1=good, 0=partial, +1=missing)

Rules:
- Only comment on actual issues, not style preferences
- Severity must be one of: "info", "warning", "critical"
- Be concise — max 200 chars per comment
- If no issues found, return empty comments array
- D4: NEVER suggest auto-merge. Human review required.`;

class LLMClient {
  constructor(gatewayUrl = 'http://localhost:9000') {
    this.gatewayUrl = gatewayUrl;
    this.apiUrl = `${gatewayUrl}/openai/v1/chat/completions`;
  }

  async analyzeDiff(diff, repoFullName) {
    const userMessage = `Review this diff from ${repoFullName}:\n\n${diff}`;

    const response = await request(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'diff0-review',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`LLM request failed [${response.statusCode}]: ${body.substring(0, 200)}`);
    }

    const data = await response.body.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty LLM response');
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      // Fallback: wrap raw text
      return {
        comments: [],
        summary: content.substring(0, 500),
        tritVector: [0, 0, 0, 0, 0],
      };
    }
  }
}

module.exports = { LLMClient };
