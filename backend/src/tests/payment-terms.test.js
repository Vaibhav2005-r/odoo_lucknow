import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const createPaymentTermSchema = z.object({
  name: z.string().trim().min(2, 'Term name must be at least 2 characters').max(50),
  dueDays: z.coerce.number().int('Due days must be an integer').min(0, 'Due days cannot be negative').max(365, 'Due days cannot exceed 365'),
  isActive: z.boolean().default(true),
});

test('Payment term validation: dueDays integer 0 to 365 check', () => {
  // Valid immediate (0 days) and standard business terms
  assert.equal(createPaymentTermSchema.safeParse({ name: 'Immediate', dueDays: 0 }).success, true);
  assert.equal(createPaymentTermSchema.safeParse({ name: '15 Days', dueDays: 15 }).success, true);
  assert.equal(createPaymentTermSchema.safeParse({ name: '30 Days', dueDays: 30 }).success, true);
  assert.equal(createPaymentTermSchema.safeParse({ name: 'Yearly Term', dueDays: 365 }).success, true);

  // Negative days rejected
  const neg = createPaymentTermSchema.safeParse({ name: 'Invalid', dueDays: -1 });
  assert.equal(neg.success, false);
  assert.equal(neg.error.flatten().fieldErrors.dueDays[0], 'Due days cannot be negative');

  // Days > 365 rejected
  const over = createPaymentTermSchema.safeParse({ name: 'Too long', dueDays: 400 });
  assert.equal(over.success, false);
  assert.equal(over.error.flatten().fieldErrors.dueDays[0], 'Due days cannot exceed 365');

  // Float rejected
  const floatVal = createPaymentTermSchema.safeParse({ name: 'Fractional', dueDays: 15.5 });
  assert.equal(floatVal.success, false);
  assert.equal(floatVal.error.flatten().fieldErrors.dueDays[0], 'Due days must be an integer');
});

test('Payment terms RBAC: Admin only write, Staff read-only', () => {
  const adminOnly = requireRole('ADMIN');
  const staffOrAdmin = requireRole('ADMIN', 'STAFF');

  // Staff write blocked with 403
  let errCaptured = null;
  adminOnly({ user: { role: 'STAFF' } }, {}, (err) => {
    errCaptured = err;
  });
  assert.equal(errCaptured?.status, 403);

  // Admin write allowed
  let adminWriteAllowed = false;
  adminOnly({ user: { role: 'ADMIN' } }, {}, (err) => {
    if (!err) adminWriteAllowed = true;
  });
  assert.equal(adminWriteAllowed, true);

  // Staff read allowed
  let staffReadAllowed = false;
  staffOrAdmin({ user: { role: 'STAFF' } }, {}, (err) => {
    if (!err) staffReadAllowed = true;
  });
  assert.equal(staffReadAllowed, true);
});
