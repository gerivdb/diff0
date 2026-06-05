const { test, describe, expect, beforeEach, mock } = require('node:test');
const assert = require('node:assert');

const { fetchDiff } = require('../src/review/diff_fetcher.js');
const { chunkDiff } = require('../src/review/diff_fetcher.js');
const { postComments } = require('../src/review/inline_commenter.js');

describe('diff_fetcher', () => {
  test('chunkDiff splits large payloads', () => {
    const payload = {
      files: [
        { filename: 'a.js', patch: 'x'.repeat(600), additions: 300, deletions: 300 },
        { filename: 'b.js', patch: 'y'.repeat(600), additions: 300, deletions: 300 },
      ],
    };
    const chunks = chunkDiff(payload, 500);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  test('chunkDiff keeps small payloads intact', () => {
    const payload = {
      files: [
        { filename: 'a.js', patch: 'x', additions: 1, deletions: 0 },
      ],
    };
    const chunks = chunkDiff(payload, 500);
    expect(chunks.length).toBe(1);
    expect(chunks[0].files.length).toBe(1);
  });
});

describe('inline_commenter', () => {
  test('postComments returns array shape', async () => {
    const result = await postComments(
      { owner: 'gerivdb', repo: 'GOVERNANCE-HUB', pr: 1 },
      { comments: [{ path: 'README.md', line: 1, body: 'ok' }], headSha: 'abc' },
      { dryRun: true }
    );
    assert(Array.isArray(result));
  });
});
