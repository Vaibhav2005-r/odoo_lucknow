import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingStatus } from '../modules/billing/billing.service.js';
import { duePeriods, periodBounds, parseDate, fmtDate } from '../lib/billing-core.js';

test('billingStatus returns initial execution statistics object', () => {
  const status = billingStatus();
  assert.equal(typeof status.running, 'boolean');
  assert.equal(typeof status.processed, 'number');
  assert.equal(typeof status.invoicesCreated, 'number');
  assert.ok(Array.isArray(status.failed));
});

test('periodBounds correctly computes start and end for MONTHLY periods', () => {
  const anchor = parseDate('2026-01-31');
  const p0 = periodBounds(anchor, 'MONTHLY', 0);
  assert.equal(fmtDate(p0.start), '2026-01-31');
  assert.equal(fmtDate(p0.end), '2026-02-27');

  const p1 = periodBounds(anchor, 'MONTHLY', 1);
  assert.equal(fmtDate(p1.start), '2026-02-28');
  assert.equal(fmtDate(p1.end), '2026-03-30');
});

test('duePeriods returns empty when subscription has no past or current due periods', () => {
  const sub = {
    startDate: '2026-11-15',
    billingPeriod: 'MONTHLY',
    nextPeriodIndex: 0,
    expiryDate: '2027-11-14',
  };
  const asOf = parseDate('2026-10-31');
  const due = duePeriods(sub, asOf);
  assert.equal(due.length, 0);
});

test('duePeriods calculates all missed periods when server has caught up after downtime', () => {
  const sub = {
    startDate: '2026-07-01',
    billingPeriod: 'MONTHLY',
    nextPeriodIndex: 0,
    expiryDate: '2027-06-30',
  };
  const asOf = parseDate('2026-10-01');
  const due = duePeriods(sub, asOf);
  assert.equal(due.length, 4);
  assert.deepEqual(
    due.map((p) => fmtDate(p.start)),
    ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'],
  );
});

test('duePeriods stops once nextPeriodIndex matches or exceeds asOf', () => {
  const sub = {
    startDate: '2026-07-01',
    billingPeriod: 'MONTHLY',
    nextPeriodIndex: 4,
    expiryDate: '2027-06-30',
  };
  const asOf = parseDate('2026-10-01');
  const due = duePeriods(sub, asOf);
  assert.equal(due.length, 0);
});
