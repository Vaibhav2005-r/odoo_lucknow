// Indian GST helpers. No database, no Express: money is in paise (integers), like billing-core.

export const GST_STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

// 2 digit state code, 5 letters + 4 digits + 1 letter (PAN), entity number, "Z", check character.
// Only the format and the state code are checked; the check digit is not, because many test GSTINs fail it.
const GSTIN = /^(0[1-9]|[12][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const normaliseGstin = (v) => (v == null ? null : String(v).trim().toUpperCase() || null);
export const isValidGstin = (v) => GSTIN.test(normaliseGstin(v) || '');
export const stateFromGstin = (v) => (isValidGstin(v) ? normaliseGstin(v).slice(0, 2) : null);
export const isStateCode = (v) => Object.hasOwn(GST_STATES, String(v));

// Where the supply is made. A customer's explicit state wins, then the state in their GSTIN; with neither
// we assume the supplier's own state (CGST + SGST) rather than guessing a different one.
export function placeOfSupply(customer, supplierState) {
  return customer?.stateCode || stateFromGstin(customer?.gstin) || supplierState;
}

/**
 * Splits the tax of one invoice line.
 *   taxPaise  total tax charged on the line
 *   taxRate   sum of all tax rates on the line (percent)
 *   gstRate   the part of taxRate that is GST (the rest, e.g. a cess, is charged as is)
 * Same state: GST is halved into CGST and SGST (the odd paisa goes to SGST). Other state: all of it is IGST.
 */
export function splitTaxLine({ taxPaise, taxRate, gstRate, interState }) {
  if (taxPaise <= 0 || taxRate <= 0) return { cgst: 0, sgst: 0, igst: 0, other: Math.max(0, taxPaise) };
  const gst = Math.min(taxPaise, Math.round((taxPaise * gstRate) / taxRate));
  const other = taxPaise - gst;
  if (interState) return { cgst: 0, sgst: 0, igst: gst, other };
  const cgst = Math.floor(gst / 2);
  return { cgst, sgst: gst - cgst, igst: 0, other };
}

// "CGST 9% + SGST 9%" or "IGST 18%" (+ any non-GST tax by name), for the tax column of an invoice line.
export function taxLabel(taxes, interState) {
  const gst = taxes.filter((t) => t.kind !== 'OTHER');
  const other = taxes.filter((t) => t.kind === 'OTHER');
  const rate = gst.reduce((a, t) => a + Number(t.rate), 0);
  const half = Math.round((rate / 2) * 100) / 100;
  const parts = [];
  if (rate > 0) parts.push(interState ? `IGST ${rate}%` : `CGST ${half}% + SGST ${half}%`);
  other.forEach((t) => parts.push(t.name));
  return parts.join(' + ');
}
