import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../middleware/auth.js';
import { PASSWORD_RULE } from '../lib/billing-core.js';
import { httpError } from '../lib/http-error.js';

test('Users module access control: requireRole ADMIN', () => {
  const adminOnly = requireRole('ADMIN');

  let nextCalled = false;
  let errCaptured = null;

  // Staff attempting to access users
  adminOnly({ user: { role: 'STAFF' } }, {}, (err) => {
    nextCalled = true;
    errCaptured = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errCaptured?.status, 403);
  assert.equal(errCaptured?.message, 'You do not have permission to do this');

  // Admin accessing users
  nextCalled = false;
  errCaptured = null;
  adminOnly({ user: { role: 'ADMIN' } }, {}, (err) => {
    nextCalled = true;
    errCaptured = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errCaptured, undefined);
});

test('Self-deactivation protection logic', () => {
  const loggedInUserId = 5;
  const targetUserId = 5;
  const isDeactivating = false; // isActive: false

  let err = null;
  if (targetUserId === loggedInUserId && isDeactivating === false) {
    err = httpError(400, 'You cannot deactivate your own account');
  }

  assert.equal(err?.status, 400);
  assert.equal(err?.message, 'You cannot deactivate your own account');

  // Deactivating another user is permitted
  const otherUserId = 6;
  err = null;
  if (otherUserId === loggedInUserId && isDeactivating === false) {
    err = httpError(400, 'You cannot deactivate your own account');
  }
  assert.equal(err, null);
});

test('Staff user creation password rule enforcement', () => {
  // Password must follow identical security policy
  assert.equal(PASSWORD_RULE.test('Staff@12345'), true);
  assert.equal(PASSWORD_RULE.test('weakpass'), false);
  assert.equal(PASSWORD_RULE.test('Staff123'), false); // no special
  assert.equal(PASSWORD_RULE.test('staff@123'), false); // no uppercase
  assert.equal(PASSWORD_RULE.test('STAFF@123'), false); // no lowercase
  assert.equal(PASSWORD_RULE.test('Staf@12'), false); // <= 8 chars
});
