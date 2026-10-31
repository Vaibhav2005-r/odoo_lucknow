import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PASSWORD_RULE, PASSWORD_MESSAGE } from '../lib/billing-core.js';
import { requireRole, ownScope, isInternal } from '../middleware/auth.js';
import { httpError } from '../lib/http-error.js';

test('Password rule enforcement matches PDF specification', () => {
  // Exactly 8 chars must fail (PDF: "more than eight characters")
  assert.equal(PASSWORD_RULE.test('Admin12!'), false);
  // 9 chars with upper, lower, special, number passes
  assert.equal(PASSWORD_RULE.test('Admin123!'), true);
  // Missing uppercase fails
  assert.equal(PASSWORD_RULE.test('admin123!'), false);
  // Missing lowercase fails
  assert.equal(PASSWORD_RULE.test('ADMIN123!'), false);
  // Missing special char fails
  assert.equal(PASSWORD_RULE.test('Admin1234'), false);
  assert.equal(
    PASSWORD_MESSAGE,
    'Password must be more than 8 characters and contain an uppercase letter, a lowercase letter and a special character'
  );
});

test('Password hashing with bcrypt behaves securely', async () => {
  const pwd = 'Brightloop@2026';
  const hash = await bcrypt.hash(pwd, 10);
  assert.notEqual(hash, pwd);
  assert.equal(await bcrypt.compare(pwd, hash), true);
  assert.equal(await bcrypt.compare('WrongPassword!1', hash), false);
});

test('Reset token SHA-256 generation and verification', () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  assert.equal(rawToken.length, 64);
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.equal(hash.length, 64);
  // Verify deterministic hashing
  assert.equal(crypto.createHash('sha256').update(rawToken).digest('hex'), hash);
});

test('JWT generation and role payload integrity', () => {
  const secret = 'test-secret-key-12345';
  const payload = { sub: '42', role: 'STAFF', cid: 10 };
  const token = jwt.sign(payload, secret, { expiresIn: '7d' });
  const verified = jwt.verify(token, secret);
  assert.equal(verified.sub, '42');
  assert.equal(verified.role, 'STAFF');
  assert.equal(verified.cid, 10);
});

test('Role-based access control (requireRole)', () => {
  const adminMiddleware = requireRole('ADMIN');
  const staffOrAdmin = requireRole('ADMIN', 'STAFF');

  let nextCalled = false;
  let errorPassed = null;

  const mockReqAdmin = { user: { role: 'ADMIN' } };
  const mockReqStaff = { user: { role: 'STAFF' } };
  const mockReqCustomer = { user: { role: 'CUSTOMER' } };

  // Admin accessing admin-only
  adminMiddleware(mockReqAdmin, {}, (err) => {
    nextCalled = true;
    errorPassed = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errorPassed, undefined);

  // Customer accessing admin-only
  nextCalled = false;
  errorPassed = null;
  adminMiddleware(mockReqCustomer, {}, (err) => {
    nextCalled = true;
    errorPassed = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errorPassed?.status, 403);

  // Staff accessing admin-or-staff
  nextCalled = false;
  errorPassed = null;
  staffOrAdmin(mockReqStaff, {}, (err) => {
    nextCalled = true;
    errorPassed = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errorPassed, undefined);
});

test('Data isolation via ownScope for customers vs internal team', () => {
  const customerReq = { user: { role: 'CUSTOMER', customerId: 99 } };
  const staffReq = { user: { role: 'STAFF', customerId: null } };
  const adminReq = { user: { role: 'ADMIN', customerId: null } };

  assert.deepEqual(ownScope(customerReq), { customerId: 99 });
  assert.deepEqual(ownScope(staffReq), {});
  assert.deepEqual(ownScope(adminReq), {});

  assert.equal(isInternal(customerReq), false);
  assert.equal(isInternal(staffReq), true);
  assert.equal(isInternal(adminReq), true);
});

test('httpError creates structured errors with details', () => {
  const err = httpError(422, 'Validation failed', { email: ['Invalid email'] });
  assert.equal(err.status, 422);
  assert.equal(err.message, 'Validation failed');
  assert.deepEqual(err.details, { email: ['Invalid email'] });
});
