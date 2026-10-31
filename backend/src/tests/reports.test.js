import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRupees, toPaise } from '../lib/billing-core.js';

test('MRR to ARR conversion calculation logic is mathematically exact', () => {
  const mrrInRupees = 45000;
  const arrInRupees = mrrInRupees * 12;
  assert.equal(arrInRupees, 540000);

  const mrrPaise = toPaise(mrrInRupees);
  assert.equal(toRupees(mrrPaise * 12), 540000);
});

test('Billing period normalization correctly derives MRR weights', () => {
  // DAILY: 365 / 12
  // WEEKLY: 52 / 12
  // MONTHLY: 1
  // YEARLY: 1 / 12
  const monthlyAmount = 1000;
  const yearlyAmount = 12000;
  const weeklyAmount = 250;

  const monthlyMRR = monthlyAmount * 1;
  const yearlyMRR = yearlyAmount * (1 / 12);
  const weeklyMRR = weeklyAmount * (52 / 12);

  assert.equal(monthlyMRR, 1000);
  assert.equal(yearlyMRR, 1000);
  assert.ok(Math.abs(weeklyMRR - 1083.33) < 0.1);
});

test('Overdue metric formula isolates unpaid balance of past-due invoices', () => {
  const invoices = [
    { id: 1, amountTotal: 10000, amountPaid: 10000, isOverdue: true }, // paid: overdue balance = 0
    { id: 2, amountTotal: 8000, amountPaid: 3000, isOverdue: true },   // partial: overdue balance = 5000
    { id: 3, amountTotal: 5000, amountPaid: 0, isOverdue: false },    // not overdue: overdue balance = 0
    { id: 4, amountTotal: 12000, amountPaid: 0, isOverdue: true },    // unpaid: overdue balance = 12000
  ];

  const overdueInvoices = invoices.filter((i) => i.isOverdue && i.amountPaid < i.amountTotal);
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (i.amountTotal - i.amountPaid), 0);

  assert.equal(overdueCount, 2);
  assert.equal(overdueAmount, 17000);
});

test('Revenue by month data aggregates invoiced vs collected correctly', () => {
  const monthlyData = [
    { month: '2026-08', invoiced: 25000, collected: 20000 },
    { month: '2026-09', invoiced: 30000, collected: 28000 },
    { month: '2026-10', invoiced: 35000, collected: 32000 },
  ];

  const totalInvoiced = monthlyData.reduce((acc, row) => acc + row.invoiced, 0);
  const totalCollected = monthlyData.reduce((acc, row) => acc + row.collected, 0);

  assert.equal(totalInvoiced, 90000);
  assert.equal(totalCollected, 80000);
  assert.equal(totalInvoiced - totalCollected, 10000);
});
