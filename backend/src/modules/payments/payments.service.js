import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../lib/http-error.js';
import { parseDate, toPaise, toRupees } from '../../lib/billing-core.js';

export async function recordPayment(invoiceId, input, userId) {
  return prisma.$transaction(async (tx) => {
    // Lock the invoice row so two payments can't over-pay it.
    const [inv] = await tx.$queryRaw`SELECT id, status::text AS status, "customerId", "amountTotal", "amountPaid"
                                     FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    if (!inv) throw httpError(404, 'Invoice not found');
    if (inv.status !== 'CONFIRMED') throw httpError(409, 'Payments can only be recorded on confirmed invoices');

    const due = toPaise(inv.amountTotal) - toPaise(inv.amountPaid);
    const amount = toPaise(input.amount);
    if (amount <= 0 || amount > due) {
      throw httpError(422, `Amount must be between ₹0.01 and ₹${toRupees(due)}`, {
        amount: [`Amount must be between ₹0.01 and ₹${toRupees(due)}`],
      });
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        customerId: inv.customerId,
        method: input.method,
        amount: toRupees(amount),
        paymentDate: parseDate(input.paymentDate),
        note: input.note || null,
        recordedById: userId || null,
      },
    });

    const paid = toPaise(inv.amountPaid) + amount;
    const fullyPaid = paid === toPaise(inv.amountTotal);

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: toRupees(paid),
        ...(fullyPaid ? { status: 'PAID', paidAt: new Date() } : {}),
      },
    });

    return payment;
  });
}
