export const inr = (v) => Number(v ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
// Business dates are stored as UTC midnight → format in UTC so the day never shifts.
export const date = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
export const due = (inv) => Number(inv.amountTotal) - Number(inv.amountPaid);
