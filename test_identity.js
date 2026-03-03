const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, 'identify.db');

function resetDb() {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  delete require.cache[require.resolve('./db')];
  delete require.cache[require.resolve('./identity')];
  const { initDb } = require('./db');
  initDb();
}

test.beforeEach(() => {
  resetDb();
});

test('creates a primary contact when no match exists', () => {
  const { reconcileIdentity } = require('./identity');
  const response = reconcileIdentity({ email: 'doc@fluxkart.com', phoneNumber: '111' });

  assert.equal(response.contact.primaryContatctId, 1);
  assert.deepEqual(response.contact.emails, ['doc@fluxkart.com']);
  assert.deepEqual(response.contact.phoneNumbers, ['111']);
  assert.deepEqual(response.contact.secondaryContactIds, []);
});

test('creates a secondary contact when incoming payload adds new info', () => {
  const { reconcileIdentity } = require('./identity');
  reconcileIdentity({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' });
  const response = reconcileIdentity({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

  assert.equal(response.contact.primaryContatctId, 1);
  assert.deepEqual(response.contact.emails, ['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
  assert.deepEqual(response.contact.phoneNumbers, ['123456']);
  assert.deepEqual(response.contact.secondaryContactIds, [2]);
});

test('merges two primary trees and keeps the oldest as primary', () => {
  const { reconcileIdentity } = require('./identity');
  reconcileIdentity({ email: 'george@hillvalley.edu', phoneNumber: '919191' });
  reconcileIdentity({ email: 'biffsucks@hillvalley.edu', phoneNumber: '717171' });

  const response = reconcileIdentity({ email: 'george@hillvalley.edu', phoneNumber: '717171' });

  assert.equal(response.contact.primaryContatctId, 1);
  assert.deepEqual(response.contact.emails, ['george@hillvalley.edu', 'biffsucks@hillvalley.edu']);
  assert.deepEqual(response.contact.phoneNumbers, ['919191', '717171']);
  assert.deepEqual(response.contact.secondaryContactIds, [2]);
});
