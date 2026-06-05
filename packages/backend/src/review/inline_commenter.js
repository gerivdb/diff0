/**
 * inline_commenter.js - Post review comments via GitHub API.
 *
 * Input : prRef + ReviewResult[]
 * Output: CommentRef[]
 */

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
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res;
}

/**
 * @param {{ owner: string, repo: string, pr: number }} prRef
 * @param {{ comments: Array<{path?: string, line?: number, body: string}> }} results
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {Promise<Array<{id: number, path?: string, line?: number}>>}
 */
async function postComments(prRef, results, opts = {}) {
  const { owner, repo, pr } = prRef;
  const out = [];

  for (const comment of results.comments || []) {
    const body = {
      commit_id: results.headSha,
      event: 'COMMENT',
      body: '',
      comments: [
        {
          path: comment.path,
          line: comment.line,
          body: comment.body,
        },
      ],
    };
    if (!comment.path) delete body.comments;

    const res = await request(
      `/repos/${owner}/${repo}/pulls/${pr}/reviews`,
      { method: 'POST', body: JSON.stringify(body) },
      opts.dryRun
    );
    const data = await res.json();
    out.push({
      id: data.id,
      path: comment.path,
      line: comment.line,
    });
  }

  return out;
}

module.exports = { postComments };
