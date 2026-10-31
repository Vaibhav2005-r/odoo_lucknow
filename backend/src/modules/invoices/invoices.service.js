import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../lib/http-error.js';
import { canMove, INVOICE_FLOW } from '../../lib/billing-core.js';

export async function confirmInvoices(ids) {
  if (!ids || ids.length === 0) return { confirmed: 0 };
  const r = await prisma.invoice.updateMany({
    where: { id: { in: ids }, status: 'DRAFT' },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  });
  return { confirmed: r.count };
}

export async function cancelInvoice(id) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id } });
    if (!inv) throw httpError(404, 'Invoice not found');
    if (!canMove(INVOICE_FLOW, inv.status, 'CANCELLED')) {
      throw httpError(409, `A ${inv.status.toLowerCase()} invoice cannot be cancelled`);
    }
    if (Number(inv.amountPaid) > 0) {
      throw httpError(409, 'This invoice already has payments, so it cannot be cancelled');
    }

    // Give back discount uses
    for (const did of inv.appliedDiscountIds || []) {
      await tx.$executeRaw`UPDATE "Discount" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE id = ${did}`;
    }

    return tx.invoice.update({
      where: { id, status: inv.status },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  });
}
