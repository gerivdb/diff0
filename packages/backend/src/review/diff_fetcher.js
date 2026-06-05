/** @typedef {{ sha: string, files: Array<{filename: string, patch: string, additions: number, deletions: number}> }} DiffPayload */
/** @typedef {{ index: number, files: DiffPayload['files'], lines: number }} DiffChunk */

const GITHUB_API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN || '';

function headers() {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set');
  return {
    authorization: `Bearer ${TOKEN}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'diff0-fork/2.0.0',
  };
}

async function request(path, options = {}, dryRun = false) {
  if (dryRun && ['POST','PATCH','PUT'].includes(options.method || 'GET')) {
    throw new Error('dry-run active: refusing write operation');
  }
  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res;
}

/**
 * @param {{ owner: string, repo: string, pr: number }} prRef
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {Promise<DiffPayload>}
 */
async function fetchDiff(prRef, opts = {}) {
  const { owner, repo, pr } = prRef;
  const path = `/repos/${owner}/${repo}/pulls/${pr}`;
  const res = await request(path, {
    method: 'GET',
    headers: { accept: 'application/vnd.github.v3.diff' },
  }, opts.dryRun);
  const diffText = await res.text();
  const filesRes = await request(`/repos/${owner}/${repo}/pulls/${pr}/files?per_page=100`);
  const filesJson = await filesRes.json();
  const files = filesJson.map((f) => ({
    filename: f.filename,
    patch: f.patch || '',
    additions: f.additions || 0,
    deletions: f.deletions || 0,
  }));
  return { sha: prRef.pr, files };
}

/**
 * @param {DiffPayload} payload
 * @param {number} [maxLines=500]
 * @returns {DiffChunk[]}
 */
function chunkDiff(payload, maxLines = 500) {
  const chunks = [];
  let current = { index: 0, files: [], lines: 0 };
  for (const file of payload.files) {
    const patchLines = (file.patch || '').split('\n').length;
    if (current.lines + patchLines > maxLines && current.files.length > 0) {
      chunks.push(current);
      current = { index: current.index + 1, files: [], lines: 0 };
    }
    current.files.push(file);
    current.lines += patchLines;
  }
  if (current.files.length > 0) chunks.push(current);
  return chunks;
}

module.exports = { fetchDiff, chunkDiff };
