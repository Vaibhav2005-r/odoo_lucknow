import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const createTaxSchema = z.object({
  name: z.string().trim().min(2, 'Tax name must be at least 2 characters').max(50),
  rate: z.coerce.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  isActive: z.boolean().default(true),
});

test('Tax rate validation rules: 0% to 100% boundary check', () => {
  // Standard GST rates must pass
  assert.equal(createTaxSchema.safeParse({ name: 'GST 18%', rate: 18 }).success, true);
  assert.equal(createTaxSchema.safeParse({ name: 'GST 5%', rate: 5 }).success, true);
  assert.equal(createTaxSchema.safeParse({ name: 'Zero Tax', rate: 0 }).success, true);
  assert.equal(createTaxSchema.safeParse({ name: 'Max Tax', rate: 100 }).success, true);

  // Negative rate rejected
  const neg = createTaxSchema.safeParse({ name: 'Negative', rate: -5 });
  assert.equal(neg.success, false);
  assert.equal(neg.error.flatten().fieldErrors.rate[0], 'Tax rate cannot be negative');

  // Rate > 100 rejected
  const over = createTaxSchema.safeParse({ name: 'Over', rate: 105 });
  assert.equal(over.success, false);
  assert.equal(over.error.flatten().fieldErrors.rate[0], 'Tax rate cannot exceed 100%');

  // Empty name rejected
  const shortName = createTaxSchema.safeParse({ name: 'G', rate: 18 });
  assert.equal(shortName.success, false);
});

test('Tax creation RBAC: Only ADMIN can create taxes, STAFF gets 403', () => {
  const adminOnly = requireRole('ADMIN');

  let nextCalled = false;
  let errCaptured = null;

  // Staff attempting to write tax
  adminOnly({ user: { role: 'STAFF' } }, {}, (err) => {
    nextCalled = true;
    errCaptured = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errCaptured?.status, 403);

  // Admin permitted
  nextCalled = false;
  errCaptured = null;
  adminOnly({ user: { role: 'ADMIN' } }, {}, (err) => {
    nextCalled = true;
    errCaptured = err;
  });
  assert.equal(nextCalled, true);
  assert.equal(errCaptured, undefined);
});

test('Tax viewing RBAC: Both ADMIN and STAFF can read taxes', () => {
  const adminOrStaff = requireRole('ADMIN', 'STAFF');

  let staffCanRead = false;
  adminOrStaff({ user: { role: 'STAFF' } }, {}, (err) => {
    if (!err) staffCanRead = true;
  });
  assert.equal(staffCanRead, true);

  let adminCanRead = false;
  adminOrStaff({ user: { role: 'ADMIN' } }, {}, (err) => {
    if (!err) adminCanRead = true;
  });
  assert.equal(adminCanRead, true);

  let customerBlocked = false;
  adminOrStaff({ user: { role: 'CUSTOMER' } }, {}, (err) => {
    if (err?.status === 403) customerBlocked = true;
  });
  assert.equal(customerBlocked, true);
});
