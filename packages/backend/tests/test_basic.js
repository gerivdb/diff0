/**
 * Tests — diff0-fork v2.0.0
 *
 * IntentHash: 0xDIFF0_FORK_TESTS_20260604
 */

'use strict';

const assert = require('assert');

// --- TritThermoGate tests ---
const { TritThermoGate } = require('../src/thermo/gate');
const gate = new TritThermoGate();

// Test 1: Entropy calculation
assert.strictEqual(gate.computeEntropy([0, 0, 0, 0, 0]), 0, 'All zeros = 0 entropy');
assert.strictEqual(gate.computeEntropy([1, 1, 1, 1, 1]), 1, 'All active = 1 entropy');
assert.strictEqual(gate.computeEntropy([1, 0, -1, 0, 1]), 0.6, '3/5 active = 0.6 entropy');
console.log('[PASS] Entropy calculation');

// Test 2: Decision — critical security -> -1
const criticalResult = gate.decide({
  tritVector: [0, 1, 0, 0, 0],
  comments: [{ severity: 'critical', body: 'SQL injection', path: 'test.py', line: 1 }],
  summary: 'Critical security issue',
});
assert.strictEqual(criticalResult.action, -1, 'Critical security = ESCALADE FLUX');
console.log('[PASS] Critical security escalation');

// Test 3: Decision — clear signal -> +1
const clearResult = gate.decide({
  tritVector: [1, 0, 0, 0, 0],
  comments: [{ severity: 'warning', body: 'Unused import', path: 'test.py', line: 1 }],
  summary: 'Minor issue',
});
assert.strictEqual(clearResult.action, 1, 'Clear signal = POST');
console.log('[PASS] Clear signal POST');

// Test 4: Decision — high entropy -> 0
const highEntropyResult = gate.decide({
  tritVector: [1, -1, 1, -1, 1],
  comments: [],
  summary: 'Mixed signals',
});
assert.strictEqual(highEntropyResult.action, 0, 'High entropy = LOG');
console.log('[PASS] High entropy LOG');

// Test 5: Decision — no comments -> 0
const noCommentsResult = gate.decide({
  tritVector: [1, 0, 0, 0, 0],
  comments: [],
  summary: 'No issues',
});
assert.strictEqual(noCommentsResult.action, 0, 'No comments = LOG');
console.log('[PASS] No comments LOG');

// --- Database tests ---
const { getDb, initTables } = require('../src/db/database');
initTables();
console.log('[PASS] Database initialized');

const db = getDb();
const testDeliveryId = `test-${Date.now()}`;
assert.strictEqual(require('../src/db/database').deliveryExists(testDeliveryId), false, 'Delivery not found initially');
require('../src/db/database').recordDelivery(testDeliveryId, 'gerivdb/TEST', 1, 'opened');
assert.strictEqual(require('../src/db/database').deliveryExists(testDeliveryId), true, 'Delivery found after insert');
console.log('[PASS] Delivery idempotency');

console.log('\n[ALL PASS] diff0-fork tests passed');
