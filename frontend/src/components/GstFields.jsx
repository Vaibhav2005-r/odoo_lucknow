import { useCompany } from '../lib/useCompany';

const GSTIN = /^(0[1-9]|[12][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const field =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/** GSTIN + state of a customer. A valid GSTIN fills in the state; the two must agree. */
export default function GstFields({ gstin, setGstin, stateCode, setStateCode, disabled = false }) {
  const { data: company } = useCompany();
  const states = company?.states || {};
  const value = (gstin || '').toUpperCase();
  const fromGstin = GSTIN.test(value) ? value.slice(0, 2) : null;
  const badFormat = value.length >= 15 && !fromGstin;
  const mismatch = fromGstin && stateCode && fromGstin !== stateCode;

  const onGstin = (e) => {
    const v = e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15);
    setGstin(v);
    if (GSTIN.test(v)) setStateCode(v.slice(0, 2));
  };

  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
        <input
          type="text"
          value={value}
          onChange={onGstin}
          disabled={disabled}
          maxLength={15}
          placeholder="e.g. 09AABCB1234C1Z7"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${field} font-mono uppercase ${badFormat ? '!border-rose-400' : ''}`}
        />
        {badFormat && <p className="mt-1 text-xs text-rose-600">That is not a valid 15-character GSTIN.</p>}
        {fromGstin && !mismatch && (
          <p className="mt-1 text-xs text-emerald-600">Valid. State: {states[fromGstin] || fromGstin}.</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">State (place of supply)</label>
        <select value={stateCode || ''} onChange={(e) => setStateCode(e.target.value)} disabled={disabled} className={`${field} bg-white`}>
          <option value="">Same state as us ({states[company?.stateCode] || '…'})</option>
          {Object.entries(states).map(([code, name]) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
        {mismatch && <p className="mt-1 text-xs text-rose-600">This state does not match the GSTIN, which is for {states[fromGstin]}.</p>}
        <p className="mt-1 text-[11px] text-slate-400">
          Decides the tax shown on invoices: CGST + SGST within {states[company?.stateCode] || 'our state'}, IGST elsewhere.
        </p>
      </div>
    </>
  );
}
