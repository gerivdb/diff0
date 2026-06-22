/**
 * LXC Sandbox Worker — diff0-fork v2.0.0
 *
 * Worker pour l'execution dans un container LXC via KIVA.
 * Remplace Daytona (cloud) par LXC/LXD local (CONTAINER_POLICY).
 *
 * IntentHash: 0xDIFF0_FORK_LXC_WORKER_20260604
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KIVA_BIN = process.env.KIVA_BIN || 'kiva';

/**
 * Cree un sandbox LXC pour l'analyse d'une PR
 */
function createSandbox(name, image = 'ubuntu:22.04') {
  const cmd = `${KIVA_BIN} create --name ${name} --image ${image}`;
  console.log(`[lxc-worker] ${cmd}`);
  return execSync(cmd, { timeout: 120000, encoding: 'utf-8' });
}

/**
 * Execute une commande dans le sandbox
 */
function execInSandbox(name, command) {
  const cmd = `${KIVA_BIN} exec --name ${name} --command "${command}"`;
  return execSync(cmd, { timeout: 60000, encoding: 'utf-8' });
}

/**
 * Clone un repo dans le sandbox
 */
function cloneRepo(name, repoUrl, depth = 50) {
  return execInSandbox(name, `git clone --depth ${depth} ${repoUrl} /workspace/repo`);
}

/**
 * Extrait le diff d'une PR
 */
function extractDiff(name, prNumber) {
  execInSandbox(name, `cd /workspace/repo && git fetch origin pull/${prNumber}/head:pr-${prNumber} 2>/dev/null || true`);
  execInSandbox(name, `cd /workspace/repo && git diff HEAD..pr-${prNumber} > /workspace/diff.patch 2>/dev/null || echo "no diff"`);
  return execInSandbox(name, `cat /workspace/diff.patch`);
}

/**
 * Detruit le sandbox
 */
function destroySandbox(name) {
  const cmd = `${KIVA_BIN} destroy --name ${name} --force`;
  try {
    execSync(cmd, { timeout: 30000, encoding: 'utf-8' });
  } catch (e) {
    // Best effort
  }
}

module.exports = {
  createSandbox,
  execInSandbox,
  cloneRepo,
  extractDiff,
  destroySandbox,
};
