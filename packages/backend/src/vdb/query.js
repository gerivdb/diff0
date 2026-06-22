/**
 * VDB Query — diff0-fork v2.0.0
 *
 * Interroge la base ternaire pour trouver des patterns similaires.
 * Distance Hamming <= N sur les TritVector[5].
 *
 * Utilise le module PLIX fingerprint pour les requetes.
 *
 * IntentHash: 0xDIFF0_FORK_VDB_QUERY_20260604
 */

'use strict';

const { getDb } = require('../db/database');
const { hammingDistance, computeFingerprint } = require('../plix/fingerprint');

/**
 * Cherche les patterns similaires dans le VDB
 * @param {number[]} tritVector — TritVector[5] de reference
 * @param {number} maxDistance — distance Hamming max (defaut: 1)
 * @param {string} repo — filtre par repo (optionnel)
 * @returns {object[]} patterns similaires
 */
function findSimilarPatterns(tritVector, maxDistance = 1, repo = null) {
  const db = getDb();

  let sql = `SELECT review_id, repo, file_path, t0, t1, t2, t3, t4
             FROM ternary_reviews WHERE 1=1`;
  const params = [];

  if (repo) {
    sql += ' AND repo = ?';
    params.push(repo);
  }

  const rows = db.prepare(sql).all(...params);

  const matches = [];
  for (const row of rows) {
    const vector = [row.t0, row.t1, row.t2, row.t3, row.t4];
    const dist = hammingDistance(tritVector, vector);
    if (dist <= maxDistance) {
      matches.push({
        reviewId: row.review_id,
        repo: row.repo,
        filePath: row.file_path,
        tritVector: vector,
        hammingDistance: dist,
      });
    }
  }

  return matches.sort((a, b) => a.hammingDistance - b.hammingDistance);
}

/**
 * Enregistre un fingerprint dans le VDB
 */
function insertFingerprint(reviewId, repo, filePath, tritVector) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ternary_reviews (review_id, repo, file_path, t0, t1, t2, t3, t4)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reviewId, repo, filePath, tritVector[0], tritVector[1], tritVector[2], tritVector[3], tritVector[4]);
}

/**
 * Stats du VDB
 */
function getVdbStats() {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM ternary_reviews').get();
  const byRepo = db.prepare(
    'SELECT repo, COUNT(*) as count FROM ternary_reviews GROUP BY repo ORDER BY count DESC'
  ).all();

  // Distribution des trit vectors
  const distribution = db.prepare(
    `SELECT t0, t1, t2, t3, t4, COUNT(*) as count
     FROM ternary_reviews
     GROUP BY t0, t1, t2, t3, t4
     ORDER BY count DESC
     LIMIT 20`
  ).all();

  return {
    total: total.count,
    byRepo,
    topPatterns: distribution,
  };
}

module.exports = {
  findSimilarPatterns,
  insertFingerprint,
  getVdbStats,
};
