// "6583.22" -> "Rupees Six Thousand Five Hundred Eighty Three and Twenty Two Paise Only", with Indian grouping
// (thousand, lakh, crore) as printed on Indian tax invoices.

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n) {
  const parts = [];
  if (n >= 100) { parts.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '')); } else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

export function numberToWords(n) {
  if (n === 0) return 'Zero';
  const units = [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1000, 'Thousand']];
  const parts = [];
  for (const [size, name] of units) {
    if (n >= size) { parts.push(`${below1000(Math.floor(n / size))} ${name}`); n %= size; }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(' ');
}

export function amountInWords(amount) {
  const paise = Math.round(Math.abs(Number(amount)) * 100);
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  let text = `Rupees ${numberToWords(rupees)}`;
  if (rest) text += ` and ${numberToWords(rest)} Paise`;
  return `${text} Only`;
}
