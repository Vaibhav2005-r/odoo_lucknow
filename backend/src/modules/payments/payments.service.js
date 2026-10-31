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

// FIFO allocation of a lump-sum payment across customer's confirmed unpaid invoices
export async function reconcileCustomerPayment({ customerId, amount, method, paymentDate, note }, userId) {
  return prisma.$transaction(async (tx) => {
    let unallocatedPaise = toPaise(amount);
    if (unallocatedPaise <= 0) {
      throw httpError(422, 'Payment amount must be greater than zero');
    }

    const invoices = await tx.invoice.findMany({
      where: { customerId: Number(customerId), status: 'CONFIRMED' },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });

    if (invoices.length === 0) {
      throw httpError(404, 'No outstanding confirmed invoices found for this customer');
    }

    const createdPayments = [];

    for (const inv of invoices) {
      if (unallocatedPaise <= 0) break;

      const duePaise = toPaise(inv.amountTotal) - toPaise(inv.amountPaid);
      if (duePaise <= 0) continue;

      const payAmountPaise = Math.min(unallocatedPaise, duePaise);

      const payment = await tx.payment.create({
        data: {
          invoiceId: inv.id,
          customerId: inv.customerId,
          method,
          amount: toRupees(payAmountPaise),
          paymentDate: parseDate(paymentDate),
          note: note ? `${note} (FIFO Auto-Reconciliation)` : 'FIFO Auto-Reconciliation',
          recordedById: userId || null,
        },
      });

      const newPaidPaise = toPaise(inv.amountPaid) + payAmountPaise;
      const fullyPaid = newPaidPaise === toPaise(inv.amountTotal);

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: toRupees(newPaidPaise),
          ...(fullyPaid ? { status: 'PAID', paidAt: new Date() } : {}),
        },
      });

      createdPayments.push({
        paymentId: payment.id,
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        allocatedAmount: toRupees(payAmountPaise),
        remainingInvoiceDue: toRupees(duePaise - payAmountPaise),
        status: fullyPaid ? 'PAID' : 'CONFIRMED',
      });

      unallocatedPaise -= payAmountPaise;
    }

    return {
      totalAllocated: toRupees(toPaise(amount) - unallocatedPaise),
      unallocatedRemainder: toRupees(unallocatedPaise),
      reconciledInvoicesCount: createdPayments.length,
      allocations: createdPayments,
    };
  });
}
