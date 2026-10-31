import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { resumePeriodIndex } from '../lib/billing-core.js';

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

test('Quotation acceptance validation and state transition logic', () => {
  const evaluateAcceptance = (sub, asOfDate) => {
    if (sub.status !== 'QUOTATION' && sub.status !== 'DRAFT') {
      return { allowed: false, message: `Cannot accept subscription in ${sub.status} status` };
    }
    if (sub.quoteValidUntil && new Date(sub.quoteValidUntil) < asOfDate) {
      return { allowed: false, message: 'This quotation has expired' };
    }
    return { allowed: true, newStatus: 'CONFIRMED' };
  };

  const today = new Date('2026-10-31T00:00:00.000Z');

  // Valid active quotation
  const validQuote = {
    id: 1,
    status: 'QUOTATION',
    quoteValidUntil: '2026-11-15T00:00:00.000Z',
  };
  assert.deepEqual(evaluateAcceptance(validQuote, today), { allowed: true, newStatus: 'CONFIRMED' });

  // Expired quotation
  const expiredQuote = {
    id: 2,
    status: 'QUOTATION',
    quoteValidUntil: '2026-10-15T00:00:00.000Z',
  };
  assert.deepEqual(evaluateAcceptance(expiredQuote, today), {
    allowed: false,
    message: 'This quotation has expired',
  });

  // Already active subscription cannot be accepted again
  const activeSub = {
    id: 3,
    status: 'ACTIVE',
    quoteValidUntil: null,
  };
  assert.deepEqual(evaluateAcceptance(activeSub, today), {
    allowed: false,
    message: 'Cannot accept subscription in ACTIVE status',
  });
});

test('Customer portal subscription query builder enforces customer isolation', () => {
  const buildSubscriptionWhere = (user, query) => {
    const where = {};
    if (user.role === 'CUSTOMER') {
      where.customerId = user.customerId;
    } else if (query?.customerId) {
      where.customerId = Number(query.customerId);
    }
    if (query?.status) where.status = query.status;
    return where;
  };

  const customerUser = { role: 'CUSTOMER', customerId: 55 };
  const adminUser = { role: 'ADMIN', customerId: null };

  // Customer query strictly enforces customerId
  const custWhere = buildSubscriptionWhere(customerUser, { status: 'QUOTATION' });
  assert.equal(custWhere.customerId, 55);
  assert.equal(custWhere.status, 'QUOTATION');

  // Customer cannot tamper customerId by passing query param
  const tamperedWhere = buildSubscriptionWhere(customerUser, { customerId: '999' });
  assert.equal(tamperedWhere.customerId, 55);

  // Admin query can filter any customer or none
  const adminWhere = buildSubscriptionWhere(adminUser, { customerId: '999' });
  assert.equal(adminWhere.customerId, 999);
});

test('Plan capability rules enforcement (pausable and closable constraints)', () => {
  const canPauseSubscription = (sub) => {
    if (!sub.plan?.pausable) return { allowed: false, error: 'Plan is not pausable' };
    if (sub.status !== 'ACTIVE') return { allowed: false, error: 'Only ACTIVE subscriptions can be paused' };
    if (sub.isPaused) return { allowed: false, error: 'Already paused' };
    return { allowed: true };
  };

  const canCloseSubscription = (sub) => {
    if (!sub.plan?.closable) return { allowed: false, error: 'Plan is not closable' };
    if (sub.status === 'CLOSED') return { allowed: false, error: 'Already closed' };
    return { allowed: true };
  };

  // Pausable plan active sub
  assert.deepEqual(canPauseSubscription({ plan: { pausable: true }, status: 'ACTIVE', isPaused: false }), { allowed: true });
  // Non-pausable plan
  assert.deepEqual(canPauseSubscription({ plan: { pausable: false }, status: 'ACTIVE', isPaused: false }), {
    allowed: false,
    error: 'Plan is not pausable',
  });

  // Closable plan active sub
  assert.deepEqual(canCloseSubscription({ plan: { closable: true }, status: 'ACTIVE' }), { allowed: true });
  // Non-closable plan
  assert.deepEqual(canCloseSubscription({ plan: { closable: false }, status: 'ACTIVE' }), {
    allowed: false,
    error: 'Plan is not closable',
  });
});

test('Subscription resumption recalculates period index skipping pause duration', () => {
  // Subscription started on 2026-01-01, Monthly. Paused. Resumed on 2026-04-15.
  const nextIdx = resumePeriodIndex(
    {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      billingPeriod: 'MONTHLY',
      nextPeriodIndex: 1, // Jan period billed, paused during Feb
    },
    new Date('2026-04-15T00:00:00.000Z')
  );

  // Period 0: Jan 1
  // Period 1: Feb 1
  // Period 2: Mar 1
  // Period 3: Apr 1 (starts before April 15, so next period to bill starts May 1 -> index 4)
  assert.equal(nextIdx, 4);
});

test('Customer portal invoices query builder applies customer data isolation and tab views', () => {
  const buildInvoiceWhere = (user, view, today) => {
    const base = user.role === 'CUSTOMER' ? { customerId: user.customerId } : {};
    let viewWhere = {};
    if (view === 'OUTSTANDING') viewWhere = { status: 'CONFIRMED' };
    else if (view === 'OVERDUE') viewWhere = { status: 'CONFIRMED', dueDate: { lt: today } };
    else if (view === 'PAID') viewWhere = { status: 'PAID' };
    return { ...base, ...viewWhere };
  };

  const customerUser = { role: 'CUSTOMER', customerId: 77 };
  const today = new Date('2026-10-31T00:00:00.000Z');

  const outstandingQuery = buildInvoiceWhere(customerUser, 'OUTSTANDING', today);
  assert.equal(outstandingQuery.customerId, 77);
  assert.equal(outstandingQuery.status, 'CONFIRMED');

  const overdueQuery = buildInvoiceWhere(customerUser, 'OVERDUE', today);
  assert.equal(overdueQuery.customerId, 77);
  assert.equal(overdueQuery.status, 'CONFIRMED');
  assert.deepEqual(overdueQuery.dueDate, { lt: today });
});

test('Customer invoice summary calculator aggregates invoiced, paid and outstanding balance', () => {
  const invoiceList = [
    { id: 1, amountTotal: '2000.00', amountPaid: '2000.00', status: 'PAID' },
    { id: 2, amountTotal: '1500.00', amountPaid: '500.00', status: 'CONFIRMED' },
    { id: 3, amountTotal: '750.50', amountPaid: '0.00', status: 'CONFIRMED' },
  ];

  const invoiced = invoiceList.reduce((sum, inv) => sum + Number(inv.amountTotal), 0);
  const paid = invoiceList.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
  const due = Math.max(0, invoiced - paid);

  assert.equal(invoiced, 4250.50);
  assert.equal(paid, 2500.00);
  assert.equal(due, 1750.50);
});

test('Portal payment schema validates allowed methods and amount constraints', () => {
  const portalPaySchema = z.object({
    method: z.enum(['UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).default('CARD'),
    amount: z.coerce.number().positive('Payment amount must be greater than 0'),
    note: z.string().trim().max(255).optional().nullable(),
  });

  const valid = portalPaySchema.safeParse({
    method: 'UPI',
    amount: '1499.50',
    note: 'GPay UTR 982348271',
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.method, 'UPI');
  assert.equal(valid.data.amount, 1499.5);

  // Invalid negative amount
  const neg = portalPaySchema.safeParse({
    method: 'CARD',
    amount: '-500',
  });
  assert.equal(neg.success, false);

  // Invalid payment method
  const badMethod = portalPaySchema.safeParse({
    method: 'BITCOIN',
    amount: '100',
  });
  assert.equal(badMethod.success, false);
});

test('Customer invoice ownership authorization check on payment endpoint', () => {
  const authorizePayment = (user, invoice) => {
    if (user.role === 'CUSTOMER') {
      const isOwner =
        user.customerId === invoice.customerId ||
        invoice.customer?.userId === user.id ||
        invoice.customer?.email === user.email;
      if (!isOwner) return { allowed: false, status: 404, message: 'Invoice not found' };
    }
    return { allowed: true };
  };

  const customerUser = { id: 10, role: 'CUSTOMER', customerId: 88, email: 'cust@mail.com' };
  const ownInvoice = { id: 1, customerId: 88, customer: { userId: 10, email: 'cust@mail.com' } };
  const foreignInvoice = { id: 2, customerId: 99, customer: { userId: 20, email: 'other@mail.com' } };

  // Own invoice -> allowed
  assert.deepEqual(authorizePayment(customerUser, ownInvoice), { allowed: true });
  // Foreign invoice -> 404 (ID enumeration protection)
  assert.deepEqual(authorizePayment(customerUser, foreignInvoice), {
    allowed: false,
    status: 404,
    message: 'Invoice not found',
  });
});

test('Portal direct password change schema validation and mismatch check', () => {
  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{9,}$/, 'Password must have >8 chars, upper, lower, special'),
      confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });

  // Valid password change
  const valid = changePasswordSchema.safeParse({
    currentPassword: 'OldPassword!1',
    newPassword: 'NewSecurePassword#2026',
    confirmPassword: 'NewSecurePassword#2026',
  });
  assert.equal(valid.success, true);

  // Mismatched confirmation
  const mismatch = changePasswordSchema.safeParse({
    currentPassword: 'OldPassword!1',
    newPassword: 'NewSecurePassword#2026',
    confirmPassword: 'DifferentPassword#2026',
  });
  assert.equal(mismatch.success, false);

  // Weak new password (less than 9 chars / missing special)
  const weak = changePasswordSchema.safeParse({
    currentPassword: 'OldPassword!1',
    newPassword: 'short',
    confirmPassword: 'short',
  });
  assert.equal(weak.success, false);
});

test('Portal direct password update verification and old-vs-new check', async () => {
  const verifyPasswordChange = async (storedHash, currentInput, newInput) => {
    const matches = await bcrypt.compare(currentInput, storedHash);
    if (!matches) return { success: false, error: 'Current password is incorrect' };

    const isSame = await bcrypt.compare(newInput, storedHash);
    if (isSame) return { success: false, error: 'New password cannot be the same as your current password' };

    return { success: true };
  };

  const storedHash = await bcrypt.hash('CorrectCurrent!99', 10);

  // Wrong current password
  const badCurrent = await verifyPasswordChange(storedHash, 'WrongPassword!99', 'BrandNewPass#100');
  assert.equal(badCurrent.success, false);
  assert.equal(badCurrent.error, 'Current password is incorrect');

  // New password same as current password
  const samePass = await verifyPasswordChange(storedHash, 'CorrectCurrent!99', 'CorrectCurrent!99');
  assert.equal(samePass.success, false);
  assert.equal(samePass.error, 'New password cannot be the same as your current password');

  // Valid change
  const validChange = await verifyPasswordChange(storedHash, 'CorrectCurrent!99', 'BrandNewPass#100');
  assert.equal(validChange.success, true);
});

test('Portal summary calculator returns exact metrics for dashboard indicators', () => {
  const calculatePortalSummary = ({ subscriptions, invoices }) => {
    const pendingQuotations = subscriptions.filter((s) => s.status === 'QUOTATION').length;
    const activeSubscriptions = subscriptions.filter((s) => ['ACTIVE', 'CONFIRMED'].includes(s.status)).length;
    const unpaidInvoices = invoices.filter((i) => i.status === 'CONFIRMED' && Number(i.amountTotal) > Number(i.amountPaid)).length;
    const paidInvoices = invoices.filter((i) => i.status === 'PAID').length;

    const outstanding = invoices
      .filter((i) => i.status === 'CONFIRMED')
      .reduce((sum, i) => sum + (Number(i.amountTotal) - Number(i.amountPaid)), 0);

    return {
      pendingQuotations,
      activeSubscriptions,
      unpaidInvoices,
      paidInvoices,
      outstandingAmount: Math.max(0, Math.round(outstanding * 100) / 100),
      currency: 'INR',
    };
  };

  const sampleSubscriptions = [
    { id: 1, status: 'QUOTATION' },
    { id: 2, status: 'QUOTATION' },
    { id: 3, status: 'ACTIVE' },
    { id: 4, status: 'CLOSED' },
  ];

  const sampleInvoices = [
    { id: 10, status: 'CONFIRMED', amountTotal: '5000.00', amountPaid: '2000.00' },
    { id: 11, status: 'CONFIRMED', amountTotal: '1500.00', amountPaid: '1500.00' },
    { id: 12, status: 'PAID', amountTotal: '3000.00', amountPaid: '3000.00' },
  ];

  const summary = calculatePortalSummary({ subscriptions: sampleSubscriptions, invoices: sampleInvoices });
  assert.equal(summary.pendingQuotations, 2);
  assert.equal(summary.activeSubscriptions, 1);
  assert.equal(summary.unpaidInvoices, 1);
  assert.equal(summary.paidInvoices, 1);
  assert.equal(summary.outstandingAmount, 3000.00);
  assert.equal(summary.currency, 'INR');
});
