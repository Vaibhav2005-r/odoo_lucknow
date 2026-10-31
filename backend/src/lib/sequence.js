// Atomic per-year counter: INSERT ... ON CONFLICT DO UPDATE under the hood. Call inside the transaction.
export async function nextNumber(tx, prefix, year) {
  const key = `${prefix}/${year}`;
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}/${String(row.value).padStart(5, '0')}`;
}
