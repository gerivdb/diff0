/**
 * Sandbox Manager — diff0-fork v2.0.0
 *
 * Orchestre les sandboxes LXC/LXD via KIVA.
 * Lifecycle: create -> clone -> analyze -> destroy (5min TTL)
 *
 * IntentHash: 0xDIFF0_FORK_SANDBOX_20260604
 */

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SANDBOX_PREFIX = 'diff0-sandbox';
const SANDBOX_IMAGE = 'ubuntu:22.04';
const SANDBOX_TTL_MS = 5 * 60 * 1000; // 5 minutes
const KIVA_BIN = process.env.KIVA_BIN || 'kiva';

class SandboxManager {
  constructor() {
    this.sandboxName = null;
    this.sandboxDir = null;
  }

  /**
   * Extrait le diff d'une PR dans un sandbox LXC
   */
  async extractDiff({ owner, repo, prNumber, headSha }) {
    this.sandboxName = `${SANDBOX_PREFIX}-${Date.now()}`;
    this.sandboxDir = path.join('sandbox', this.sandboxName);

    try {
      // Create sandbox via KIVA
      this._execKiva('create', `--name ${this.sandboxName}`, `--image ${SANDBOX_IMAGE}`);

      // Clone repo
      const cloneUrl = `https://github.com/${owner}/${repo}.git`;
      this._execInSandbox(`git clone --depth 50 ${cloneUrl} /workspace/repo`);

      // Fetch PR diff
      this._execInSandbox(
        `cd /workspace/repo && git fetch origin pull/${prNumber}/head:pr-${prNumber} 2>/dev/null || true`
      );
      this._execInSandbox(
        `cd /workspace/repo && git diff HEAD..pr-${prNumber} > /workspace/diff.patch || echo "no diff"`
      );

      // Read diff
      const diff = this._readFromSandbox('/workspace/diff.patch');

      return diff;
    } finally {
      // Always cleanup
      this.destroy();
    }
  }

  destroy() {
    if (this.sandboxName) {
      try {
        this._execKiva('destroy', `--name ${this.sandboxName}`, '--force');
      } catch (e) {
        // Best effort cleanup
      }
      this.sandboxName = null;
    }
  }

  _execKiva(...args) {
    const cmd = `${KIVA_BIN} ${args.join(' ')}`;
    console.log(`[sandbox] ${cmd}`);
    return execSync(cmd, { timeout: 60000, encoding: 'utf-8' });
  }

  _execInSandbox(cmd) {
    return this._execKiva('exec', `--name ${this.sandboxName}`, `--command "${cmd}"`);
  }

  _readFromSandbox(filePath) {
    try {
      return this._execKiva('cp', `--name ${this.sandboxName}`, `--source ${filePath}`, `--dest ${this.sandboxDir}/diff.patch`);
    } catch (e) {
      return '';
    }
  }
}

module.exports = { SandboxManager };
