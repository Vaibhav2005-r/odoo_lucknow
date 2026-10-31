// Pure business logic: no database, no Express. Every money value inside is in PAISE (integer)
// so totals never drift because of floating point. Convert at the edges with toPaise / toRupees.

// ---------- Password rule (PDF: more than 8 chars, upper, lower, special) ----------
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
export const PASSWORD_MESSAGE =
  'Password must be more than 8 characters and contain an uppercase letter, a lowercase letter and a special character';

// ---------- Money ----------
export const toPaise = (v) => Math.round(Number(v) * 100);
export const toRupees = (p) => Math.round(p) / 100;

// ---------- Dates (always UTC-midnight Date objects; DB columns are @db.Date) ----------
const DAY_MS = 86_400_000;

export function parseDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) throw new Error(`Invalid date: ${value}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export const fmtDate = (d) => d.toISOString().slice(0, 10);

// "Today" in the business time zone (IST), as a UTC-midnight date. Avoids the 00:00–05:30 IST bug.
export function todayIn(timeZone = 'Asia/Kolkata', now = new Date()) {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return parseDate(s);
}

export const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);

const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

export function addMonthsClamped(d, n) {
  const total = d.getUTCMonth() + n;
  const y = d.getUTCFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m))));
}

// Period k always counts from the anchor (start date) -> Jan 31, Feb 28, Mar 31 ... no drift.
export function addPeriods(anchor, billingPeriod, k) {
  switch (billingPeriod) {
    case 'DAILY': return addDays(anchor, k);
    case 'WEEKLY': return addDays(anchor, 7 * k);
    case 'MONTHLY': return addMonthsClamped(anchor, k);
    case 'YEARLY': return addMonthsClamped(anchor, 12 * k);
    default: throw new Error(`Unknown billing period: ${billingPeriod}`);
  }
}

export function periodBounds(anchor, billingPeriod, k, expiryDate = null) {
  const start = addPeriods(anchor, billingPeriod, k);
  let end = addDays(addPeriods(anchor, billingPeriod, k + 1), -1);
  if (expiryDate && end > expiryDate) end = expiryDate;
  return { index: k, start, end };
}

// Every period that is due on `asOf` and not billed yet. Catch-up safe: if the job did not run
// for 3 days, all 3 missed periods come back. Re-running returns [] once nextPeriodIndex moved on.
export function duePeriods({ startDate, billingPeriod, nextPeriodIndex, expiryDate = null }, asOf, max = 366) {
  const anchor = parseDate(startDate);
  const expiry = expiryDate ? parseDate(expiryDate) : null;
  const out = [];
  for (let k = nextPeriodIndex; out.length < max; k++) {
    const p = periodBounds(anchor, billingPeriod, k, expiry);
    if (p.start > asOf) break;
    if (expiry && p.start > expiry) break;
    out.push(p);
  }
  return out;
}

// Resume after pause: periods that STARTED while paused are not billed (by design, not a skip bug).
export function resumePeriodIndex({ startDate, billingPeriod, nextPeriodIndex }, resumeDate) {
  const anchor = parseDate(startDate);
  let k = nextPeriodIndex;
  while (addPeriods(anchor, billingPeriod, k) < resumeDate) k++;
  return k;
}

// Recurring amount -> monthly, for MRR.
export const MONTHLY_FACTOR = { DAILY: 365 / 12, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 };

// ---------- Discounts, taxes, totals ----------
export function isDiscountUsable(d, asOf) {
  if (!d || d.isActive === false) return false;
  if (d.startDate && parseDate(d.startDate) > asOf) return false;
  if (d.endDate && parseDate(d.endDate) < asOf) return false;
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return false;
  return true;
}

function discountOn(d, basePaise) {
  if (basePaise <= 0) return 0;
  const raw = d.type === 'PERCENTAGE'
    ? Math.round((basePaise * Number(d.value)) / 100)
    : toPaise(d.value);
  return Math.min(basePaise, raw);
}

// Split an amount across weights, exact to the paisa (largest remainder method).
export function allocate(amount, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const parts = raw.map(Math.floor);
  let rest = amount - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - parts[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; j < rest; j++) parts[order[j][1]] += 1;
  return parts;
}

/**
 * lines:     [{ productId, quantity, unitPrice (rupees), taxRates: [18], isActive }]
 * discounts: usable candidates = PRODUCT-scope rules (with productIds) + the rule attached
 *            to this subscription (SUBSCRIPTION scope). Loaded by the caller.
 * Rule: best product discount per line, then at most one whole-subscription discount on what
 *       is left, spread across lines; tax is charged on the discounted (taxable) amount.
 * Returns paise.
 */
export function computeTotals(lines, discounts = [], asOf = todayIn()) {
  const usable = discounts.filter((d) => isDiscountUsable(d, asOf));
  const applied = new Set();

  const base = lines.filter((l) => l.isActive !== false).map((l) => {
    const quantity = Number(l.quantity);
    const subtotal = quantity * toPaise(l.unitPrice);
    let lineDiscount = 0;
    let bestId = null;
    for (const d of usable) {
      if (d.scope !== 'PRODUCT' || !(d.productIds || []).includes(l.productId)) continue;
      if (d.minQuantity != null && quantity < d.minQuantity) continue;
      if (d.minPurchase != null && subtotal < toPaise(d.minPurchase)) continue;
      const amt = discountOn(d, subtotal);
      if (amt > lineDiscount) { lineDiscount = amt; bestId = d.id; }
    }
    if (bestId != null) applied.add(bestId);
    const taxRate = (l.taxRates || []).reduce((a, r) => a + Number(r), 0);
    return { ...l, quantity, subtotal, lineDiscount, taxRate };
  });

  const gross = base.reduce((a, l) => a + l.subtotal, 0);
  const totalQty = base.reduce((a, l) => a + l.quantity, 0);
  const remaining = base.map((l) => l.subtotal - l.lineDiscount);
  const remainingSum = remaining.reduce((a, b) => a + b, 0);

  let orderDiscount = 0;
  let orderId = null;
  for (const d of usable) {
    if (d.scope !== 'SUBSCRIPTION') continue;
    if (d.minQuantity != null && totalQty < d.minQuantity) continue;
    if (d.minPurchase != null && gross < toPaise(d.minPurchase)) continue;
    const amt = discountOn(d, remainingSum);
    if (amt > orderDiscount) { orderDiscount = amt; orderId = d.id; }
  }
  if (orderId != null) applied.add(orderId);
  const shares = allocate(orderDiscount, remaining);

  const out = base.map((l, i) => {
    const discount = l.lineDiscount + shares[i];
    const taxable = l.subtotal - discount;
    const tax = Math.round((taxable * l.taxRate) / 100);
    const { lineDiscount, ...rest } = l;
    return { ...rest, discount, taxable, tax, total: taxable + tax };
  });
  const sum = (k) => out.reduce((a, l) => a + l[k], 0);
  return {
    lines: out,
    subtotal: sum('subtotal'),
    discount: sum('discount'),
    untaxed: sum('taxable'),
    tax: sum('tax'),
    total: sum('total'),
    appliedDiscountIds: [...applied],
  };
}

// ---------- State machines ----------
export const SUBSCRIPTION_FLOW = {
  DRAFT: ['QUOTATION', 'CONFIRMED', 'CLOSED'],
  QUOTATION: ['DRAFT', 'CONFIRMED', 'CLOSED'],
  CONFIRMED: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};
export const INVOICE_FLOW = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};
export function canMove(flow, from, to) {
  return (flow[from] || []).includes(to);
}
