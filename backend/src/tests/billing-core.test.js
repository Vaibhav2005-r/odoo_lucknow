import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_RULE, parseDate, fmtDate, todayIn, addPeriods, duePeriods, resumePeriodIndex,
  computeTotals, allocate, canMove, SUBSCRIPTION_FLOW, INVOICE_FLOW, toRupees,
} from '../lib/billing-core.js';

const D = parseDate;

test('password: more than 8 chars + upper + lower + special', () => {
  assert.equal(PASSWORD_RULE.test('Abcdefg!'), false);   // 8 chars -> not "more than eight"
  assert.equal(PASSWORD_RULE.test('Abcdefgh!'), true);   // 9 chars
  assert.equal(PASSWORD_RULE.test('abcdefgh!'), false);  // no uppercase
  assert.equal(PASSWORD_RULE.test('ABCDEFGH!'), false);  // no lowercase
  assert.equal(PASSWORD_RULE.test('Abcdefghi'), false);  // no special
  assert.equal(PASSWORD_RULE.test('Brightloop@2026'), true);
});

test('monthly periods anchor on start date, no month-end drift', () => {
  const a = D('2026-01-31');
  assert.equal(fmtDate(addPeriods(a, 'MONTHLY', 1)), '2026-02-28');
  assert.equal(fmtDate(addPeriods(a, 'MONTHLY', 2)), '2026-03-31');
  assert.equal(fmtDate(addPeriods(D('2024-02-29'), 'YEARLY', 1)), '2025-02-28');
  assert.equal(fmtDate(addPeriods(D('2026-10-31'), 'WEEKLY', 1)), '2026-11-07');
});

test('billing catch-up returns every missed period, then nothing (idempotent)', () => {
  const sub = { startDate: '2026-08-01', billingPeriod: 'MONTHLY', nextPeriodIndex: 0 };
  const due = duePeriods(sub, D('2026-10-15'));
  assert.deepEqual(due.map((p) => fmtDate(p.start)), ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.equal(fmtDate(due[0].end), '2026-08-31');
  assert.equal(duePeriods({ ...sub, nextPeriodIndex: 3 }, D('2026-10-15')).length, 0);
});

test('billing stops at expiry date and caps last period end', () => {
  const sub = { startDate: '2026-01-01', billingPeriod: 'MONTHLY', nextPeriodIndex: 0, expiryDate: '2026-03-15' };
  const due = duePeriods(sub, D('2026-12-01'));
  assert.equal(due.length, 3);
  assert.equal(fmtDate(due[2].end), '2026-03-15');
});

test('resume after pause skips periods that started while paused', () => {
  const sub = { startDate: '2026-01-10', billingPeriod: 'MONTHLY', nextPeriodIndex: 2 };
  assert.equal(resumePeriodIndex(sub, D('2026-04-20')), 4); // next bill 2026-05-10
  assert.equal(resumePeriodIndex(sub, D('2026-03-10')), 2); // resumed exactly on a period start
});

test('IST today differs from UTC late evening', () => {
  assert.equal(fmtDate(todayIn('Asia/Kolkata', new Date('2026-10-31T19:00:00Z'))), '2026-11-01');
});

test('variant price + product discount + 18% GST', () => {
  const lines = [{ productId: 1, quantity: 10, unitPrice: 1200 + 560, taxRates: [18] }];
  const discounts = [{ id: 7, type: 'PERCENTAGE', value: 10, scope: 'PRODUCT', productIds: [1], minQuantity: 5,
    startDate: '2026-10-01', endDate: '2026-12-31', usageLimit: 100, usedCount: 3, isActive: true }];
  const r = computeTotals(lines, discounts, D('2026-10-31'));
  assert.equal(toRupees(r.subtotal), 17600);
  assert.equal(toRupees(r.discount), 1760);
  assert.equal(toRupees(r.untaxed), 15840);
  assert.equal(toRupees(r.tax), 2851.2);
  assert.equal(toRupees(r.total), 18691.2);
  assert.deepEqual(r.appliedDiscountIds, [7]);
});

test('min quantity not met / expired / used up -> no discount', () => {
  const line = [{ productId: 1, quantity: 2, unitPrice: 1000, taxRates: [] }];
  const base = { id: 1, type: 'PERCENTAGE', value: 10, scope: 'PRODUCT', productIds: [1], isActive: true, usedCount: 0 };
  assert.equal(computeTotals(line, [{ ...base, minQuantity: 5 }], D('2026-10-31')).discount, 0);
  assert.equal(computeTotals(line, [{ ...base, endDate: '2026-10-30' }], D('2026-10-31')).discount, 0);
  assert.equal(computeTotals(line, [{ ...base, usageLimit: 3, usedCount: 3 }], D('2026-10-31')).discount, 0);
});

test('fixed whole-subscription discount spreads exactly; inactive add-on excluded', () => {
  const lines = [
    { productId: 1, quantity: 1, unitPrice: 999.99, taxRates: [18] },
    { productId: 2, quantity: 3, unitPrice: 333.33, taxRates: [18] },
    { productId: 3, quantity: 1, unitPrice: 500, taxRates: [18], isActive: false },
  ];
  const d = [{ id: 9, type: 'FIXED', value: 500, scope: 'SUBSCRIPTION', minPurchase: 1000, isActive: true, usedCount: 0 }];
  const r = computeTotals(lines, d, D('2026-10-31'));
  assert.equal(r.lines.length, 2);
  assert.equal(r.discount, 50000);
  assert.equal(r.lines.reduce((a, l) => a + l.discount, 0), 50000);
  assert.equal(r.untaxed + r.tax, r.total);
  assert.equal(r.subtotal - r.discount, r.untaxed);
});

test('allocate is exact', () => {
  const parts = allocate(100, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
});

test('state machines', () => {
  assert.ok(canMove(SUBSCRIPTION_FLOW, 'DRAFT', 'QUOTATION'));
  assert.ok(canMove(SUBSCRIPTION_FLOW, 'CONFIRMED', 'ACTIVE'));
  assert.ok(!canMove(SUBSCRIPTION_FLOW, 'CLOSED', 'ACTIVE'));
  assert.ok(!canMove(INVOICE_FLOW, 'PAID', 'CANCELLED'));
  assert.ok(!canMove(INVOICE_FLOW, 'DRAFT', 'PAID'));
});
