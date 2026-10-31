import { inr } from '../lib/format';
import { useCompany } from '../lib/useCompany';

// Turns an invoice's lines into "CGST @ 9%", "SGST @ 9%" / "IGST @ 18%" rows. Lines carry the label
// ("CGST 9% + SGST 9% + Cess 2%") and the amount of each part, so the rows always add up to the invoice tax.
export function taxRows(invoice) {
  const rows = new Map();
  const add = (key, label, amount) => {
    if (!amount) return;
    const row = rows.get(key) || { label, amount: 0 };
    row.amount += amount;
    rows.set(key, row);
  };
  for (const line of invoice?.lines || []) {
    const others = [];
    for (const part of String(line.taxLabel || '').split(' + ').filter(Boolean)) {
      const m = /^(CGST|SGST|IGST) ([\d.]+)%$/.exec(part);
      if (m) add(`${m[1]}${m[2]}`, `${m[1]} @ ${m[2]}%`, Number(line[`${m[1].toLowerCase()}Amount`] || 0));
      else others.push(part);
    }
    if (others.length) add(`o:${others.join('+')}`, others.join(' + '), Number(line.otherTaxAmount || 0));
  }
  const order = (r) => ['CGST', 'SGST', 'IGST'].findIndex((p) => r.label.startsWith(p)) + 1 || 9;
  const out = [...rows.values()].sort((a, b) => order(a) - order(b));
  // invoices issued before the split was recorded only have a total
  if (out.length === 0 && Number(invoice?.amountTax) > 0) return [{ label: 'Tax (GST)', amount: Number(invoice.amountTax) }];
  return out.map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }));
}

/** One row per tax component. `rowClass` lets each page keep its own look. */
export function TaxRows({ invoice, rowClass = 'flex justify-between text-slate-600' }) {
  return taxRows(invoice).map((r) => (
    <div key={r.label} className={rowClass}>
      <span>{r.label}</span>
      <span>{inr(r.amount)}</span>
    </div>
  ));
}

/** "Place of supply: Maharashtra (27). Inter-state supply, IGST applies." */
export function SupplyInfo({ invoice, className = 'text-xs text-slate-500' }) {
  const { data: company } = useCompany();
  if (!invoice?.placeOfSupply) return null;
  const name = company?.states?.[invoice.placeOfSupply];
  return (
    <p className={className}>
      Place of supply: <strong>{name ? `${name} (${invoice.placeOfSupply})` : invoice.placeOfSupply}</strong>
      {' · '}
      {invoice.interState ? 'Inter-state supply, IGST applies' : 'Intra-state supply, CGST + SGST apply'}
    </p>
  );
}
