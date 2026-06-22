/**
 * Express server — diff0-fork v2.0.0
 *
 * Reçoit les webhooks GitHub, orchestre le pipeline review,
 * et poste les inline comments.
 *
 * Flux :
 *   webhook -> delivery_check -> sandbox -> llm_review -> thermo_gate -> post_comment
 *
 * BDCP : tout appel LLM passe par GATEWAY-MANAGER (localhost:9000)
 * D4 : 0 auto-merge, -1 escalade FLUX
 *
 * IntentHash: 0xDIFF0_FORK_SERVER_20260604
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { getDb, deliveryExists, recordDelivery, recordReview } = require('./db/database');
const { LLMClient } = require('./llm/client');
const { TritThermoGate } = require('./thermo/gate');
const { SandboxManager } = require('./sandbox/manager');
const { postReviewComment, getInstallationToken } = require('./github/comments');

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:9000';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID || '';
const GITHUB_PRIVATE_KEY_PATH = process.env.GITHUB_PRIVATE_KEY_PATH || '';
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID || '';

// --- Middleware ---
app.use(express.json({ limit: '5mb' }));

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'diff0-fork',
    version: '2.0.0',
    intent_hash: '0xDIFF0_FORK_SERVER_20260604',
  });
});

// --- Clapet status (pour BDCP compliance) ---
app.get('/clapet/status', (req, res) => {
  res.json({
    behind_cdp: true,
    gateway_url: GATEWAY_URL,
    bdcp_enforced: true,
  });
});

// --- Webhook receiver ---
app.post('/webhook', async (req, res) => {
  // 1. HMAC-SHA256 signature verification
  const sig = req.headers['x-hub-signature-256'] || '';
  const payload = JSON.stringify(req.body);

  if (WEBHOOK_SECRET) {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // 2. Event type check
  const event = req.headers['x-github-event'];
  if (event !== 'pull_request') {
    return res.status(200).json({ status: 'ignored', reason: 'not_pull_request' });
  }

  const action = req.body.action;
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return res.status(200).json({ status: 'ignored', reason: `action=${action}` });
  }

  const pr = req.body.pull_request;
  const repo = req.body.repository?.full_name || '';

  // 3. Idempotency — Delivery ID check
  const deliveryId = `${repo}/pr/${pr.number}/${pr.updated_at}`;
  if (await deliveryExists(deliveryId)) {
    return res.status(200).json({ status: 'duplicate', delivery_id: deliveryId });
  }

  await recordDelivery(deliveryId, repo, pr.number, action);

  // 4. Async processing (respond 202 immediately)
  res.status(202).json({ status: 'accepted', delivery_id: deliveryId });

  // 5. Pipeline (async fire-and-forget)
  processReview(deliveryId, repo, pr).catch(err => {
    console.error(`[diff0-fork] Pipeline error for ${deliveryId}:`, err.message);
  });
});

/**
 * Pipeline principal de review
 */
async function processReview(deliveryId, repoFullName, pr) {
  const [owner, repo] = repoFullName.split('/');
  const prNumber = pr.number;
  const headSha = pr.head?.sha || '';

  console.log(`[diff0-fork] Processing ${repoFullName}#${prNumber} @${headSha.substring(0, 8)}`);

  // Step 1: Fetch diff via GitHub API (sandbox optional — direct fetch for now)
  let diff;
  try {
    const token = await getInstallationToken(GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH, GITHUB_INSTALLATION_ID);
    const { request } = require('undici');
    const diffResp = await request(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'diff0-fork/2.0.0',
        },
      }
    );
    if (diffResp.statusCode !== 200) {
      throw new Error(`GitHub API [${diffResp.statusCode}]: ${(await diffResp.body.text()).substring(0, 200)}`);
    }
    const files = await diffResp.body.json();
    diff = files.map(f => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch || ''}`).join('\n');
    console.log(`[diff0-fork] Diff fetched: ${files.length} files, ${diff.length} chars`);
  } catch (err) {
    console.error(`[diff0-fork] Diff fetch failed: ${err.message}`);
    return;
  }

  // Step 2: LLM review via GATEWAY-MANAGER
  const llm = new LLMClient(GATEWAY_URL);
  let analysis;
  try {
    analysis = await llm.analyzeDiff(diff, repoFullName);
  } catch (err) {
    console.error(`[diff0-fork] LLM analysis failed: ${err.message}`);
    return;
  }

  // Step 3: TritThermoGate decision
  const gate = new TritThermoGate();
  const decision = gate.decide(analysis);

  // Step 4: Execute decision
  if (decision.action === 1) {
    // POST inline comments
    await postReviewComment({ owner, repo, prNumber, comments: analysis.comments, headSha });
    console.log(`[diff0-fork] Comments posted on ${repoFullName}#${prNumber}`);
  } else if (decision.action === 0) {
    // LOG only (entropie haute)
    console.log(`[diff0-fork] LOG only for ${repoFullName}#${prNumber} (entropy=${decision.entropy})`);
  } else if (decision.action === -1) {
    // ESCALADE FLUX
    console.log(`[diff0-fork] ESCALADE FLUX for ${repoFullName}#${prNumber}`);
    // Write to FLUX pending directory for HITL review
    await escalateToFlux(deliveryId, repoFullName, prNumber, analysis);
  }

  // Step 5: Record in DB
  await recordReview({
    delivery_id: deliveryId,
    repo: repoFullName,
    pr_number: prNumber,
    sha: headSha,
    decision: decision.action,
    entropy: decision.entropy,
    comments_count: analysis.comments?.length || 0,
    trit_vector: analysis.tritVector || null,
  });
}

/**
 * Escalade vers FLUX pour review humaine (D4)
 */
async function escaladeToFlux(deliveryId, repo, prNumber, analysis) {
  const fs = require('fs');
  const fluxDir = process.env.FLUX_PENDING_DIR || 'D:\\DO\\WEB\\TOOLS\\L3-CITIZENS\\FLUX\\reviews\\pending';
  const filename = `diff0-${deliveryId.replace(/[^a-z0-9]/gi, '_')}.json`;

  require('mkdirp').sync(fluxDir);

  const signal = {
    signal_id: `diff0-${Date.now()}`,
    source: 'diff0-fork',
    source_repo: repo,
    pr_number: prNumber,
    delivery_id: deliveryId,
    date_detected: new Date().toISOString(),
    nexus_status: 'PENDING_HUMAN_REVIEW',
    escalation_reason: 'trit_thermo_gate_-1',
    trit_vector: analysis.tritVector,
    trit_message: analysis.summary,
    hits: (analysis.comments || []).map(c => ({
      type: c.severity || 'info',
      description: c.body?.substring(0, 200),
      matches: [c.path, `line:${c.line}`],
    })),
  };

  require('fs').writeFileSync(
    require('path').join(fluxDir, filename),
    JSON.stringify(signal, null, 2)
  );

  console.log(`[diff0-fork] Escalated to FLUX: ${filename}`);
}

// --- Start server ---
app.listen(PORT, () => {
  console.log(`[diff0-fork] Server listening on port ${PORT}`);
  console.log(`[diff0-fork] Gateway (BDCP): ${GATEWAY_URL}`);
  console.log(`[diff0-fork] D4 enforced: 0 auto-merge, -1 -> FLUX HITL`);
});

module.exports = app;
