/**
 * GitHub Comments — diff0-fork v2.0.0
 *
 * Poste les inline review comments sur les PRs GitHub.
 * Utilise l'API REST GitHub avec Installation Token.
 *
 * IntentHash: 0xDIFF0_FORK_GITHUB_COMMENTS_20260604
 */

'use strict';

const { request } = require('undici');
const { getInstallationToken } = require('./auth');

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID || '';
const GITHUB_PRIVATE_KEY_PATH = process.env.GITHUB_PRIVATE_KEY_PATH || '';
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID || '';

/**
 * Obtient un token d'installation (JWT -> Installation Token)
 */
async function getInstallationTokenCached() {
  if (GITHUB_TOKEN) return GITHUB_TOKEN;
  if (GITHUB_APP_ID && GITHUB_PRIVATE_KEY_PATH && GITHUB_INSTALLATION_ID) {
    return await getInstallationToken(GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH, GITHUB_INSTALLATION_ID);
  }
  return '';
}

/**
 * Poste les commentaires inline sur une PR
 */
async function postReviewComment({ owner, repo, prNumber, comments, headSha }) {
  const token = await getInstallationTokenCached();
  if (!token) {
    console.warn('[github] No token available — skipping comment posting');
    return;
  }

  if (!comments || comments.length === 0) return;

  const reviewBody = comments.map(c => `- **${c.severity}** \`${c.path}:${c.line}\`: ${c.body}`).join('\n');

  const response = await request(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: `## diff0-fork Review\n\n${reviewBody}\n\n---\n_Reviewed by diff0-fork v2.0.0 · D4 HITL enforced_`,
        event: 'COMMENT',
        comments: comments.map(c => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
        commit_id: headSha,
      }),
    }
  );

  if (response.statusCode >= 400) {
    const body = await response.body.text();
    throw new Error(`GitHub API error [${response.statusCode}]: ${body.substring(0, 200)}`);
  }

  return response;
}

module.exports = { postReviewComment, getInstallationToken: getInstallationTokenCached };
