import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { paginate } from '../lib/params.js';

const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().max(20).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
  gstin: z.string().trim().max(20).optional().nullable(),
});

test('Customer creation validation rules', () => {
  // Valid customer payload
  const valid = createCustomerSchema.safeParse({
    name: 'Sharma Retail',
    email: 'Riya@SharmaRetail.in',
    phone: '9820000001',
    company: 'Sharma Retail Pvt Ltd',
    gstin: '27AAAAA0000A1Z5',
    address: 'Andheri West, Mumbai',
  });
  assert.equal(valid.success, true);
  // Email is lowercased automatically
  assert.equal(valid.data.email, 'riya@sharmaretail.in');

  // Invalid email format
  const badEmail = createCustomerSchema.safeParse({
    name: 'Sharma Retail',
    email: 'not-an-email',
  });
  assert.equal(badEmail.success, false);
  assert.equal(badEmail.error.flatten().fieldErrors.email[0], 'Enter a valid email address');

  // Name too short
  const shortName = createCustomerSchema.safeParse({
    name: 'S',
    email: 'valid@example.com',
  });
  assert.equal(shortName.success, false);
  assert.equal(shortName.error.flatten().fieldErrors.name[0], 'Name must be at least 2 characters');
});

test('Customer search query builder logic', () => {
  const buildSearch = (search) => {
    return search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
  };

  const empty = buildSearch('');
  assert.deepEqual(empty, {});

  const q = buildSearch('Sharma');
  assert.equal(q.OR.length, 3);
  assert.equal(q.OR[0].name.contains, 'Sharma');
  assert.equal(q.OR[0].name.mode, 'insensitive');
});

test('Customer pagination helper clamps bounds properly', () => {
  const p1 = paginate({ page: '1', pageSize: '20' });
  assert.equal(p1.page, 1);
  assert.equal(p1.pageSize, 20);
  assert.equal(p1.skip, 0);
  assert.equal(p1.take, 20);

  const p2 = paginate({ page: '3', pageSize: '10' });
  assert.equal(p2.page, 3);
  assert.equal(p2.skip, 20);
  assert.equal(p2.take, 10);

  // Maximum pageSize clamped to 100
  const p3 = paginate({ page: '1', pageSize: '500' });
  assert.equal(p3.pageSize, 100);

  // Negative or non-numeric page clamped to 1
  const p4 = paginate({ page: '-5', pageSize: 'invalid' });
  assert.equal(p4.page, 1);
  assert.equal(p4.pageSize, 20);
});

test('Customer role editing restrictions (cannot tamper email or GSTIN)', () => {
  const filterCustomerUpdate = (role, body) => {
    const sanitized = { ...body };
    if (role === 'CUSTOMER') {
      delete sanitized.email;
      delete sanitized.gstin;
    }
    return sanitized;
  };

  const payload = {
    name: 'Updated Name',
    email: 'hacker@malicious.com',
    gstin: 'FAKEGSTIN1234',
    phone: '9999999999',
  };

  // As customer
  const customerResult = filterCustomerUpdate('CUSTOMER', payload);
  assert.equal(customerResult.email, undefined);
  assert.equal(customerResult.gstin, undefined);
  assert.equal(customerResult.name, 'Updated Name');
  assert.equal(customerResult.phone, '9999999999');

  // As staff
  const staffResult = filterCustomerUpdate('STAFF', payload);
  assert.equal(staffResult.email, 'hacker@malicious.com');
  assert.equal(staffResult.gstin, 'FAKEGSTIN1234');
});
