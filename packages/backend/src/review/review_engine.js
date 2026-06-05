/**
 * review_engine.js - Orchestrate diffscope-fork + LLM via GATEWAY.
 *
 * Input : DiffChunk[]
 * Output: ReviewResult[]
 */

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:18000';

async function analyze(diffChunk, fingerprint) {
  const payload = {
    chunk: diffChunk,
    fingerprint,
    repo: diffChunk.repo,
    pr: diffChunk.pr,
  };

  const res = await fetch(`${GATEWAY}/v1/review/analyze`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GATEWAY_TOKEN || ''}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway review failed ${res.status}: ${text}`);
  }

  return res.json();
}

module.exports = { analyze };
