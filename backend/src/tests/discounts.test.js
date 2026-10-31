import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRule, lineInput } from '../modules/billing/pricing.js';
import { isDiscountUsable, computeTotals, parseDate } from '../lib/billing-core.js';

test('toRule accurately normalizes database discount models', () => {
  const dbDiscount = {
    id: 5,
    name: 'Festive 15%',
    type: 'PERCENTAGE',
    value: '15.00',
    scope: 'PRODUCT',
    products: [{ id: 10 }, { id: 12 }],
    minPurchase: '1000.00',
    minQuantity: 3,
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-11-30'),
    usageLimit: 50,
    usedCount: 10,
    isActive: true,
  };

  const rule = toRule(dbDiscount);
  assert.equal(rule.id, 5);
  assert.equal(rule.value, 15);
  assert.deepEqual(rule.productIds, [10, 12]);
  assert.equal(rule.minPurchase, 1000);
  assert.equal(rule.minQuantity, 3);
  assert.equal(rule.usageLimit, 50);
  assert.equal(rule.usedCount, 10);
  assert.equal(rule.isActive, true);
});

test('lineInput extracts line item attributes for calculation engine', () => {
  const line = {
    productId: 101,
    quantity: 4,
    unitPrice: '1250.50',
    isActive: true,
    description: 'CRM Seat with Odoo Brand',
    taxes: [{ name: 'GST 18%', rate: '18.00' }],
  };

  const input = lineInput(line);
  assert.equal(input.productId, 101);
  assert.equal(input.quantity, 4);
  assert.equal(input.unitPrice, 1250.5);
  assert.deepEqual(input.taxRates, [18]);
  assert.equal(input.isActive, true);
  assert.equal(input.taxLabel, 'GST 18%');
});

test('isDiscountUsable enforces dates, usage limits, and active status', () => {
  const asOf = parseDate('2026-10-31');

  const validRule = {
    id: 1,
    isActive: true,
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    usageLimit: 100,
    usedCount: 20,
  };
  assert.equal(isDiscountUsable(validRule, asOf), true);

  // Inactive
  assert.equal(isDiscountUsable({ ...validRule, isActive: false }, asOf), false);

  // Before start date
  assert.equal(isDiscountUsable({ ...validRule, startDate: '2026-11-01' }, asOf), false);

  // After end date
  assert.equal(isDiscountUsable({ ...validRule, endDate: '2026-10-30' }, asOf), false);

  // Exhausted usage limit
  assert.equal(isDiscountUsable({ ...validRule, usedCount: 100 }, asOf), false);
  assert.equal(isDiscountUsable({ ...validRule, usedCount: 105 }, asOf), false);

  // Unlimited usage (usageLimit null)
  assert.equal(isDiscountUsable({ ...validRule, usageLimit: null, usedCount: 9999 }, asOf), true);
});

test('computeTotals applies eligible product discount and subscription discount correctly', () => {
  const asOf = parseDate('2026-10-31');
  const lines = [
    { productId: 1, quantity: 5, unitPrice: 1000, taxRates: [18], isActive: true },
    { productId: 2, quantity: 2, unitPrice: 2500, taxRates: [18], isActive: true },
  ];

  // 10% on Product 1 (min qty 3), plus Flat ₹500 subscription discount (min purchase ₹8000)
  const discounts = [
    {
      id: 10,
      type: 'PERCENTAGE',
      value: 10,
      scope: 'PRODUCT',
      productIds: [1],
      minQuantity: 3,
      isActive: true,
    },
    {
      id: 20,
      type: 'FIXED',
      value: 500,
      scope: 'SUBSCRIPTION',
      minPurchase: 8000,
      isActive: true,
    },
  ];

  const res = computeTotals(lines, discounts, asOf);

  // Product 1: subtotal 5000, line discount 500, remaining 4500
  // Product 2: subtotal 5000, line discount 0, remaining 5000
  // Total remaining = 9500
  // Order discount = 500 spread across 4500 (45/95) and 5000 (50/95)
  // Total subtotal = 10000
  // Total discount = 500 (product) + 500 (subscription) = 1000 (100000 paise)
  assert.equal(res.subtotal, 1000000);
  assert.equal(res.discount, 100000);
  assert.equal(res.untaxed, 900000);
  assert.equal(res.tax, Math.round(900000 * 0.18));
  assert.equal(res.total, res.untaxed + res.tax);
  assert.deepEqual(res.appliedDiscountIds.sort(), [10, 20]);
});
