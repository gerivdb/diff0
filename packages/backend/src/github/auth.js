/**
 * GitHub App Auth — diff0-fork v2.0.0
 *
 * Gestion de l'authentification GitHub App.
 * Utilise JWT pour obtenir des Installation Tokens.
 *
 * IntentHash: 0xDIFF0_FORK_GITHUB_AUTH_20260604
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { request } = require('undici');

const GITHUB_API = 'https://api.github.com';

/**
 * Genere un JWT pour l'authentification GitHub App
 */
function generateJWT(appId, privateKeyPath) {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  })).toString('base64url');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(privateKey, 'base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Obtient un Installation Token pour acceder aux repos
 */
async function getInstallationToken(appId, privateKeyPath, installationId) {
  const jwt = generateJWT(appId, privateKeyPath);

  const response = await request(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
      },
    }
  );

  if (response.statusCode !== 201) {
    const body = await response.body.text();
    throw new Error(`Failed to get installation token [${response.statusCode}]: ${body.substring(0, 200)}`);
  }

  const data = await response.body.json();
  return data.token;
}

/**
 * Liste les installations de l'App
 */
async function listInstallations(appId, privateKeyPath) {
  const jwt = generateJWT(appId, privateKeyPath);

  const response = await request(`${GITHUB_API}/app/installations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Failed to list installations [${response.statusCode}]`);
  }

  return response.body.json();
}

module.exports = {
  generateJWT,
  getInstallationToken,
  listInstallations,
};
