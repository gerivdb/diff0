/**
 * Database layer — diff0-fork v2.0.0
 *
 * Uses sql.js (pure JS SQLite) — no native compilation needed.
 *
 * Tables:
 *   deliveries   — idempotency tracking (webhook delivery IDs)
 *   reviews      — review history with TritVector[5]
 *   ternary_reviews — ternary fingerprint index
 *
 * IntentHash: 0xDIFF0_FORK_DATABASE_20260604
 */

'use strict';

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'diff0.db');

let db;

async function getDb() {
  if (!db) {
    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initTables();
    saveDb();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS deliveries (
      delivery_id TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      action TEXT NOT NULL,
      received_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      sha TEXT NOT NULL,
      decision INTEGER NOT NULL,
      entropy REAL,
      comments_count INTEGER DEFAULT 0,
      trit_vector TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ternary_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      repo TEXT NOT NULL,
      file_path TEXT NOT NULL,
      t0 INTEGER, t1 INTEGER, t2 INTEGER, t3 INTEGER, t4 INTEGER,
      hamming_distance INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repo)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reviews_sha ON reviews(sha)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ternary_repo ON ternary_reviews(repo)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ternary_vector ON ternary_reviews(t0, t1, t2, t3, t4)');
}

async function deliveryExists(deliveryId) {
  const result = await getDb();
  const stmt = result.prepare('SELECT 1 FROM deliveries WHERE delivery_id = ?');
  stmt.bind([deliveryId]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

async function recordDelivery(deliveryId, repo, prNumber, action) {
  const result = await getDb();
  result.run(
    'INSERT OR IGNORE INTO deliveries (delivery_id, repo, pr_number, action) VALUES (?, ?, ?, ?)',
    [deliveryId, repo, prNumber, action]
  );
  saveDb();
}

async function recordReview({ delivery_id, repo, pr_number, sha, decision, entropy, comments_count, trit_vector }) {
  const result = await getDb();
  result.run(
    `INSERT INTO reviews (delivery_id, repo, pr_number, sha, decision, entropy, comments_count, trit_vector)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [delivery_id, repo, pr_number, sha, decision, entropy || 0, comments_count || 0, trit_vector || null]
  );
  saveDb();
}

async function insertTernaryReview({ review_id, repo, file_path, t0, t1, t2, t3, t4, hamming_distance }) {
  const result = await getDb();
  result.run(
    `INSERT INTO ternary_reviews (review_id, repo, file_path, t0, t1, t2, t3, t4, hamming_distance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [review_id, repo, file_path, t0, t1, t2, t3, t4, hamming_distance]
  );
  saveDb();
}

async function getRecentReviews(repo, limit = 50) {
  const result = await getDb();
  const stmt = result.prepare('SELECT * FROM reviews WHERE repo = ? ORDER BY created_at DESC LIMIT ?');
  stmt.bind([repo, limit]);

  const reviews = [];
  while (stmt.step()) {
    reviews.push(stmt.getAsObject());
  }
  stmt.free();
  return reviews;
}

module.exports = {
  getDb,
  initTables,
  deliveryExists,
  recordDelivery,
  recordReview,
  insertTernaryReview,
  getRecentReviews,
  saveDb,
};
