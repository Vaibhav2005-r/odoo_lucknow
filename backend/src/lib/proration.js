import { addDays, parseDate, periodBounds, toPaise, toRupees } from './billing-core.js';
import { splitTaxLine } from './gst.js';

// Proration: when seats or add-ons change in the middle of a billing period, the customer pays (or is credited)
// only for the part of the period that is left. No database, no Express: money is in paise.

const DAY = 86_400_000;
const daysBetween = (from, to) => Math.round((to - from) / DAY);

/**
 * The billing period that contains `onDate`: { index, start, end }, or null when the date is before the
 * subscription starts or after it expires. Periods count from the start date, exactly like the billing engine,
 * and the last one is cut short at the expiry date.
 */
export function periodContaining({ startDate, billingPeriod, expiryDate = null }, onDate) {
  const anchor = parseDate(startDate);
  const day = parseDate(onDate);
  const expiry = expiryDate ? parseDate(expiryDate) : null;
  if (day < anchor || (expiry && day > expiry)) return null;
  for (let k = 0; k < 40_000; k++) {
    const p = periodBounds(anchor, billingPeriod, k, expiry);
    if (day <= p.end) return p;
  }
  return null;
}

/**
 * How much of `period` is left on `onDate`. Today counts, so a change on the first day is a full period and a
 * change on the last day is one day: { days, totalDays }.
 */
export function remainingDays(period, onDate) {
  const day = parseDate(onDate);
  return {
    days: daysBetween(day, period.end) + 1,
    totalDays: daysBetween(period.start, period.end) + 1,
  };
}

/** The price of one unit for `days` of `totalDays`, in rupees, rounded to the paisa (half up). */
export const proratedUnit = (unitPrice, days, totalDays) => toRupees(Math.round((toPaise(unitPrice) * days) / totalDays));

/**
 * Money for `quantity` units at a prorated unit price, with its tax and the CGST/SGST/IGST split. All positive paise.
 *   taxes: [{ rate, kind }]   interState: bool (see lib/gst.js)
 */
export function lineAmounts({ unitPrice, quantity, taxes = [], interState = false }) {
  const subtotal = quantity * toPaise(unitPrice);
  const taxRate = taxes.reduce((a, t) => a + Number(t.rate), 0);
  const gstRate = taxes.filter((t) => t.kind !== 'OTHER').reduce((a, t) => a + Number(t.rate), 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  const split = splitTaxLine({ taxPaise: tax, taxRate, gstRate, interState });
  return { subtotal, tax, total: subtotal + tax, taxRate, ...split };
}

/** The mirror image of a charge, so a credit for the same units is exactly the opposite of the charge. */
export function negate(a) {
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, k === 'taxRate' ? v : -v]));
}

export { addDays };
