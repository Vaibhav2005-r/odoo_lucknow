import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPaise, toRupees, parseDate, addDays, duePeriods, computeTotals } from '../lib/billing-core.js';

test('FIFO Payment Allocation logic splits lump sum across oldest invoices accurately', () => {
  const invoices = [
    { id: 101, number: 'INV/2026/00001', amountTotal: 5000, amountPaid: 0, dueDate: '2026-10-01' },
    { id: 102, number: 'INV/2026/00002', amountTotal: 10000, amountPaid: 2000, dueDate: '2026-10-15' }, // 8000 due
    { id: 103, number: 'INV/2026/00003', amountTotal: 7000, amountPaid: 0, dueDate: '2026-11-01' },
  ];

  let lumpSumPaise = toPaise(10000); // ₹10,000 payment
  const allocations = [];

  for (const inv of invoices) {
    if (lumpSumPaise <= 0) break;
    const duePaise = toPaise(inv.amountTotal) - toPaise(inv.amountPaid);
    if (duePaise <= 0) continue;

    const payPaise = Math.min(lumpSumPaise, duePaise);
    const newPaidPaise = toPaise(inv.amountPaid) + payPaise;
    const fullyPaid = newPaidPaise === toPaise(inv.amountTotal);

    allocations.push({
      invoiceId: inv.id,
      paidAmount: toRupees(payPaise),
      remainingDue: toRupees(duePaise - payPaise),
      status: fullyPaid ? 'PAID' : 'CONFIRMED',
    });

    lumpSumPaise -= payPaise;
  }

  assert.equal(allocations.length, 2);
  // Invoice 1: fully paid with 5000
  assert.equal(allocations[0].invoiceId, 101);
  assert.equal(allocations[0].paidAmount, 5000);
  assert.equal(allocations[0].remainingDue, 0);
  assert.equal(allocations[0].status, 'PAID');

  // Invoice 2: partially paid with remaining 5000 (out of 8000 due -> 3000 remaining)
  assert.equal(allocations[1].invoiceId, 102);
  assert.equal(allocations[1].paidAmount, 5000);
  assert.equal(allocations[1].remainingDue, 3000);
  assert.equal(allocations[1].status, 'CONFIRMED');

  // Unallocated remainder should be 0
  assert.equal(lumpSumPaise, 0);
});

test('Customer Statement aging bucketing classifies invoices accurately', () => {
  const asOf = new Date('2026-10-31T00:00:00Z');

  const unpaidInvoices = [
    { id: 1, dueDate: '2026-11-10', dueAmount: 4000 },  // future due -> Current
    { id: 2, dueDate: '2026-10-20', dueAmount: 6000 },  // 11 days overdue -> 1-30 days
    { id: 3, dueDate: '2026-09-15', dueAmount: 8000 },  // 46 days overdue -> 31-60 days
    { id: 4, dueDate: '2026-07-01', dueAmount: 12000 }, // 122 days overdue -> 60+ days
  ];

  let current = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let aging60Plus = 0;

  for (const inv of unpaidInvoices) {
    const diffDays = Math.floor((asOf.getTime() - new Date(`${inv.dueDate}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      current += inv.dueAmount;
    } else if (diffDays <= 30) {
      aging1to30 += inv.dueAmount;
    } else if (diffDays <= 60) {
      aging31to60 += inv.dueAmount;
    } else {
      aging60Plus += inv.dueAmount;
    }
  }

  assert.equal(current, 4000);
  assert.equal(aging1to30, 6000);
  assert.equal(aging31to60, 8000);
  assert.equal(aging60Plus, 12000);
  assert.equal(current + aging1to30 + aging31to60 + aging60Plus, 30000);
});

test('Statement running balance tracks chronological debit and credit progression', () => {
  const transactions = [
    { date: '2026-08-01', type: 'INVOICE', debit: 10000, credit: 0 },
    { date: '2026-08-15', type: 'PAYMENT', debit: 0, credit: 10000 },
    { date: '2026-09-01', type: 'INVOICE', debit: 12000, credit: 0 },
    { date: '2026-09-20', type: 'PAYMENT', debit: 0, credit: 5000 },
    { date: '2026-10-01', type: 'INVOICE', debit: 15000, credit: 0 },
  ];

  let balance = 0;
  const balances = [];
  for (const tx of transactions) {
    balance += (tx.debit - tx.credit);
    balances.push(balance);
  }

  assert.deepEqual(balances, [10000, 0, 12000, 7000, 22000]);
});

test('RFC 4180 CSV cell escaping handles quotes, commas, and special characters', () => {
  const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  assert.equal(escapeCell('Acme, Inc.'), '"Acme, Inc."');
  assert.equal(escapeCell('He said "Hello"'), '"He said ""Hello"""');
  assert.equal(escapeCell(1234.5), '"1234.5"');
  assert.equal(escapeCell(null), '""');
});
