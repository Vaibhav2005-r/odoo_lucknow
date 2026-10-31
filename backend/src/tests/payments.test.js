import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPaise, toRupees } from '../lib/billing-core.js';

test('Payment math calculation converts rupees and paise without precision loss', () => {
  const totalRupees = 18691.2;
  const totalPaise = toPaise(totalRupees);
  assert.equal(totalPaise, 1869120);

  const partialPayment = 8691.2;
  const remainingPaise = totalPaise - toPaise(partialPayment);
  assert.equal(toRupees(remainingPaise), 10000.0);
});

test('Payment over-payment prevention check', () => {
  const invoice = {
    amountTotal: '15000.00',
    amountPaid: '10000.00',
  };

  const duePaise = toPaise(invoice.amountTotal) - toPaise(invoice.amountPaid);
  assert.equal(toRupees(duePaise), 5000);

  // Attempting to pay 5000.01 should be rejected
  const attemptedAmount = 5000.01;
  const isValidPayment = toPaise(attemptedAmount) <= duePaise && toPaise(attemptedAmount) > 0;
  assert.equal(isValidPayment, false);

  // Attempting to pay exactly 5000 should be valid
  const exactPayment = 5000.0;
  const isExactValid = toPaise(exactPayment) <= duePaise && toPaise(exactPayment) > 0;
  assert.equal(isExactValid, true);
});

test('Full payment triggers PAID status condition', () => {
  const invoiceTotalPaise = toPaise('12000.00');
  const existingPaidPaise = toPaise('6000.00');
  const newPaymentPaise = toPaise('6000.00');

  const totalPaid = existingPaidPaise + newPaymentPaise;
  const isFullyPaid = totalPaid === invoiceTotalPaise;
  assert.equal(isFullyPaid, true);
});

test('Partial payment keeps invoice CONFIRMED condition', () => {
  const invoiceTotalPaise = toPaise('12000.00');
  const existingPaidPaise = toPaise('0.00');
  const newPaymentPaise = toPaise('5000.00');

  const totalPaid = existingPaidPaise + newPaymentPaise;
  const isFullyPaid = totalPaid === invoiceTotalPaise;
  assert.equal(isFullyPaid, false);
});
