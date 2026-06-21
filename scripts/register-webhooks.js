/**
 * Webhook registration — diff0-fork v2.0.0
 *
 * Enregistre les webhooks sur les 10 repos priority_high.
 * A executer apres la creation de la GitHub App.
 *
 * Usage: node scripts/register-webhooks.js
 *
 * IntentHash: 0xDIFF0_FORK_WEBHOOK_REGISTER_20260604
 */

'use strict';

const { request } = require('undici');

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

// Repos where the GitHub App is installed (2026-06-04)
const INSTALLED_REPOS = [
  'UAE',
  'VDB',
  'GATEWAY-MANAGER',
  'KIVA-CLI',
  'ECOS-CLI',
  'GOVERNANCE-HUB',
  'REPO-STANDARDS',
  'APOLLO',
  'ARES',
  'KIVA',
];

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN not set');
  process.exit(1);
}

async function registerWebhook(repo) {
  const url = `${GITHUB_API}/repos/gerivdb/${repo}/hooks`;

  try {
    const response = await request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['pull_request'],
        config: {
          url: WEBHOOK_URL,
          content_type: 'json',
          secret: WEBHOOK_SECRET,
          insecure_ssl: '0',
        },
      }),
    });

    if (response.statusCode === 201) {
      console.log(`[OK]   ${repo} — webhook registered`);
      return true;
    } else if (response.statusCode === 422) {
      console.log(`[SKIP] ${repo} — webhook already exists`);
      return true;
    } else {
      const body = await response.body.text();
      console.log(`[FAIL] ${repo} — [${response.statusCode}] ${body.substring(0, 100)}`);
      return false;
    }
  } catch (err) {
    console.log(`[ERR]  ${repo} — ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`[diff0-fork] Registering webhooks on ${HIGH_REPOS.length} repos...`);
  console.log(`[diff0-fork] Webhook URL: ${WEBHOOK_URL}`);

  let ok = 0, fail = 0;
  for (const repo of HIGH_REPOS) {
    const result = await registerWebhook(repo);
    result ? ok++ : fail++;
  }

  console.log(`\n[diff0-fork] Done: ${ok} OK, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
