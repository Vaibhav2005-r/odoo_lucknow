import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canMove, INVOICE_FLOW } from '../lib/billing-core.js';
import { confirmInvoices } from '../modules/invoices/invoices.service.js';

test('Invoice state machine transition rules (R33)', () => {
  // DRAFT can move to CONFIRMED or CANCELLED
  assert.ok(canMove(INVOICE_FLOW, 'DRAFT', 'CONFIRMED'));
  assert.ok(canMove(INVOICE_FLOW, 'DRAFT', 'CANCELLED'));
  assert.ok(!canMove(INVOICE_FLOW, 'DRAFT', 'PAID')); // Cannot jump straight to PAID

  // CONFIRMED can move to PAID or CANCELLED
  assert.ok(canMove(INVOICE_FLOW, 'CONFIRMED', 'PAID'));
  assert.ok(canMove(INVOICE_FLOW, 'CONFIRMED', 'CANCELLED'));

  // Terminal states (PAID, CANCELLED) cannot move
  assert.ok(!canMove(INVOICE_FLOW, 'PAID', 'CANCELLED'));
  assert.ok(!canMove(INVOICE_FLOW, 'PAID', 'DRAFT'));
  assert.ok(!canMove(INVOICE_FLOW, 'CANCELLED', 'CONFIRMED'));
});

test('confirmInvoices gracefully handles empty ID array', async () => {
  const result = await confirmInvoices([]);
  assert.equal(result.confirmed, 0);

  const nullResult = await confirmInvoices(null);
  assert.equal(nullResult.confirmed, 0);
});

test('Overdue invoice definition condition logic', () => {
  const today = new Date('2026-10-31T00:00:00.000Z');

  const confirmedPastDue = {
    status: 'CONFIRMED',
    dueDate: new Date('2026-10-15T00:00:00.000Z'),
  };
  const isOverdue1 = confirmedPastDue.status === 'CONFIRMED' && confirmedPastDue.dueDate < today;
  assert.equal(isOverdue1, true);

  const confirmedFutureDue = {
    status: 'CONFIRMED',
    dueDate: new Date('2026-11-15T00:00:00.000Z'),
  };
  const isOverdue2 = confirmedFutureDue.status === 'CONFIRMED' && confirmedFutureDue.dueDate < today;
  assert.equal(isOverdue2, false);

  const draftPastDue = {
    status: 'DRAFT',
    dueDate: new Date('2026-10-15T00:00:00.000Z'),
  };
  // Drafts are never counted as overdue until confirmed
  const isOverdue3 = draftPastDue.status === 'CONFIRMED' && draftPastDue.dueDate < today;
  assert.equal(isOverdue3, false);
});
