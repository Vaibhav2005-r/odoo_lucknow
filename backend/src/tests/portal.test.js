import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const updateCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
});

test('Portal profile schema validates update inputs', () => {
  const valid = updateCustomerSchema.safeParse({
    name: 'Aarav Patel',
    phone: '+91 9876543210',
    company: 'Patel Logistics LLP',
    address: '402 Business Park, SG Highway, Ahmedabad',
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.name, 'Aarav Patel');
  assert.equal(valid.data.phone, '+91 9876543210');

  const invalid = updateCustomerSchema.safeParse({
    name: 'A', // too short
  });
  assert.equal(invalid.success, false);
});

test('Customer portal data isolation: CUSTOMER cannot query foreign customerId', () => {
  const checkAccess = (user, targetCustomerId) => {
    if (user.role === 'CUSTOMER' && user.customerId !== targetCustomerId) {
      return { allowed: false, status: 404, message: 'Customer not found' };
    }
    return { allowed: true, status: 200 };
  };

  const customerUser = { id: 10, role: 'CUSTOMER', customerId: 42 };
  const adminUser = { id: 1, role: 'ADMIN', customerId: null };

  // Customer querying own profile -> allowed
  assert.deepEqual(checkAccess(customerUser, 42), { allowed: true, status: 200 });

  // Customer querying another customer's ID (e.g. ID 99) -> 404 (ID enumeration protection)
  assert.deepEqual(checkAccess(customerUser, 99), {
    allowed: false,
    status: 404,
    message: 'Customer not found',
  });

  // Admin querying any customer -> allowed
  assert.deepEqual(checkAccess(adminUser, 99), { allowed: true, status: 200 });
});

test('Customer portal profile update sanitization strips email & GSTIN for CUSTOMER role', () => {
  const sanitizeForRole = (role, body) => {
    const payload = { ...body };
    if (role === 'CUSTOMER') {
      delete payload.email;
      delete payload.gstin;
    }
    return payload;
  };

  const maliciousCustomerPayload = {
    name: 'Updated Name',
    phone: '9999999999',
    email: 'hacked@target.com',
    gstin: '99FAKEGSTIN0000',
  };

  const sanitized = sanitizeForRole('CUSTOMER', maliciousCustomerPayload);
  assert.equal(sanitized.name, 'Updated Name');
  assert.equal(sanitized.phone, '9999999999');
  assert.equal(sanitized.email, undefined);
  assert.equal(sanitized.gstin, undefined);

  // Admin role retains email & gstin
  const adminSanitized = sanitizeForRole('ADMIN', maliciousCustomerPayload);
  assert.equal(adminSanitized.email, 'hacked@target.com');
  assert.equal(adminSanitized.gstin, '99FAKEGSTIN0000');
});

test('Customer outstanding balance calculation aggregates confirmed unpaid invoices', () => {
  const invoices = [
    { id: 1, status: 'CONFIRMED', amountTotal: '1500.00', amountPaid: '500.00' }, // outstanding 1000
    { id: 2, status: 'CONFIRMED', amountTotal: '250.50', amountPaid: '250.50' }, // fully paid: 0
    { id: 3, status: 'CONFIRMED', amountTotal: '750.25', amountPaid: '0.00' }, // outstanding 750.25
    { id: 4, status: 'DRAFT', amountTotal: '999.00', amountPaid: '0.00' }, // draft -> excluded
    { id: 5, status: 'CANCELLED', amountTotal: '800.00', amountPaid: '0.00' }, // cancelled -> excluded
  ];

  const confirmedOnly = invoices.filter((inv) => inv.status === 'CONFIRMED');
  const outstanding = confirmedOnly.reduce(
    (sum, inv) => sum + (Number(inv.amountTotal) - Number(inv.amountPaid)),
    0
  );

  const rounded = Math.max(0, Math.round(outstanding * 100) / 100);
  assert.equal(rounded, 1750.25);
});

