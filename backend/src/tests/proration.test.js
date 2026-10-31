import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineAmounts, negate, periodContaining, proratedUnit, remainingDays } from '../lib/proration.js';
import { fmtDate, parseDate } from '../lib/billing-core.js';

const d = (s) => parseDate(s);
const span = (p) => [fmtDate(p.start), fmtDate(p.end)];

test('the period that contains a date, for every billing period', () => {
  const monthly = { startDate: '2026-01-15', billingPeriod: 'MONTHLY' };
  assert.deepEqual(span(periodContaining(monthly, d('2026-01-15'))), ['2026-01-15', '2026-02-14'], 'first day');
  assert.deepEqual(span(periodContaining(monthly, d('2026-02-14'))), ['2026-01-15', '2026-02-14'], 'last day');
  assert.deepEqual(span(periodContaining(monthly, d('2026-02-15'))), ['2026-02-15', '2026-03-14']);
  assert.equal(periodContaining(monthly, d('2026-02-15')).index, 1);
  assert.deepEqual(span(periodContaining(monthly, d('2026-06-30'))), ['2026-06-15', '2026-07-14']);

  // anchored on the 31st: February is short, March goes back to the 31st (no drift)
  const end = { startDate: '2026-01-31', billingPeriod: 'MONTHLY' };
  assert.deepEqual(span(periodContaining(end, d('2026-02-10'))), ['2026-01-31', '2026-02-27']);
  assert.deepEqual(span(periodContaining(end, d('2026-03-01'))), ['2026-02-28', '2026-03-30']);

  assert.deepEqual(span(periodContaining({ startDate: '2026-10-01', billingPeriod: 'WEEKLY' }, d('2026-10-17'))), ['2026-10-15', '2026-10-21']);
  assert.deepEqual(span(periodContaining({ startDate: '2026-10-01', billingPeriod: 'DAILY' }, d('2026-10-17'))), ['2026-10-17', '2026-10-17']);
  assert.deepEqual(span(periodContaining({ startDate: '2025-03-10', billingPeriod: 'YEARLY' }, d('2026-10-01'))), ['2026-03-10', '2027-03-09']);
});

test('dates outside the subscription have no period, and the last period stops at the expiry date', () => {
  const sub = { startDate: '2026-01-01', billingPeriod: 'MONTHLY', expiryDate: '2026-03-20' };
  assert.equal(periodContaining(sub, d('2025-12-31')), null, 'before it starts');
  assert.equal(periodContaining(sub, d('2026-03-21')), null, 'after it expires');
  assert.deepEqual(span(periodContaining(sub, d('2026-03-10'))), ['2026-03-01', '2026-03-20'], 'clipped at expiry');
});

test('days left count today, so the first day is the whole period and the last day is one day', () => {
  const p = periodContaining({ startDate: '2026-11-01', billingPeriod: 'MONTHLY' }, d('2026-11-01')); // 1 Nov - 30 Nov
  assert.deepEqual(remainingDays(p, d('2026-11-01')), { days: 30, totalDays: 30 });
  assert.deepEqual(remainingDays(p, d('2026-11-12')), { days: 19, totalDays: 30 });
  assert.deepEqual(remainingDays(p, d('2026-11-30')), { days: 1, totalDays: 30 });
  const feb = periodContaining({ startDate: '2028-02-01', billingPeriod: 'MONTHLY' }, d('2028-02-10')); // leap year: 29 days
  assert.equal(remainingDays(feb, d('2028-02-10')).totalDays, 29);
  const clipped = periodContaining({ startDate: '2026-01-01', billingPeriod: 'MONTHLY', expiryDate: '2026-03-20' }, d('2026-03-10'));
  assert.deepEqual(remainingDays(clipped, d('2026-03-10')), { days: 11, totalDays: 20 }, 'a clipped period is prorated over its own length');
});

test('prorated prices are rounded to the paisa, half up', () => {
  assert.equal(proratedUnit(1000, 19, 30), 633.33);
  assert.equal(proratedUnit(1000, 30, 30), 1000);
  assert.equal(proratedUnit(1000, 1, 30), 33.33);
  assert.equal(proratedUnit(100, 1, 3), 33.33);
  assert.equal(proratedUnit(100, 2, 3), 66.67);
  assert.equal(proratedUnit(0.05, 1, 2), 0.03, '2.5 paise rounds up');
  assert.equal(proratedUnit(299, 7, 31), 67.52);
  for (const total of [28, 29, 30, 31, 365]) {
    for (let days = 1; days <= total; days++) {
      const v = proratedUnit(999, days, total);
      assert.ok(v > 0 && v <= 999, `${days}/${total}`);
    }
  }
});

test('tax on a prorated line is split like any invoice line', () => {
  const gst18 = { rate: 18, kind: 'GST' };
  const same = lineAmounts({ unitPrice: 633.33, quantity: 3, taxes: [gst18], interState: false });
  assert.equal(same.subtotal, 189999);
  assert.equal(same.tax, 34200); // 18% of 1899.99 = 341.9982 -> 342.00
  assert.equal(same.cgst + same.sgst, same.tax);
  assert.equal(same.cgst, 17100);
  assert.equal(same.total, same.subtotal + same.tax);

  const other = lineAmounts({ unitPrice: 633.33, quantity: 3, taxes: [gst18], interState: true });
  assert.equal(other.igst, other.tax);
  assert.equal(other.cgst + other.sgst, 0);

  const cess = lineAmounts({ unitPrice: 100, quantity: 1, taxes: [gst18, { rate: 2, kind: 'OTHER' }], interState: false });
  assert.deepEqual([cess.cgst, cess.sgst, cess.other, cess.tax], [900, 900, 200, 2000]);

  const none = lineAmounts({ unitPrice: 50, quantity: 2, taxes: [] });
  assert.deepEqual([none.subtotal, none.tax, none.total], [10000, 0, 10000]);
});

test('a credit is exactly the opposite of the matching charge, to the paisa', () => {
  for (const [unit, qty] of [[633.33, 3], [67.52, 7], [0.03, 1], [1234.57, 11]]) {
    const charge = lineAmounts({ unitPrice: unit, quantity: qty, taxes: [{ rate: 18, kind: 'GST' }, { rate: 2, kind: 'OTHER' }], interState: false });
    const credit = negate(charge);
    for (const k of ['subtotal', 'tax', 'total', 'cgst', 'sgst', 'igst', 'other']) assert.equal(charge[k] + credit[k], 0, `${k} for ${qty} x ${unit}`);
    assert.equal(credit.taxRate, charge.taxRate);
  }
});
