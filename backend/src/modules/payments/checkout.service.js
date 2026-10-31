import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { httpError } from '../../lib/http-error.js';
import { fmtDate, todayIn, toPaise, toRupees } from '../../lib/billing-core.js';
import { recordPayment } from './payments.service.js';
import { gatewayName, getProvider } from './gateway.js';

/** Starts an online payment for what is still owed on an invoice. */
export async function createCheckout(invoiceId, user) {
  const provider = getProvider();
  const name = gatewayName();
  if (!provider) throw httpError(503, 'Online payments are not enabled. Please contact us to arrange payment.');

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { customer: true } });
  if (!inv) throw httpError(404, 'Invoice not found');
  if (user.role === 'CUSTOMER' && user.customerId !== inv.customerId) throw httpError(404, 'Invoice not found');
  if (inv.status !== 'CONFIRMED') throw httpError(409, 'Only confirmed, unpaid invoices can be paid online');

  const due = toRupees(toPaise(inv.amountTotal) - toPaise(inv.amountPaid));
  if (due <= 0) throw httpError(409, 'Nothing is owed on this invoice');

  const { orderId } = await provider.createOrder({
    amountRupees: due,
    receipt: inv.number,
    notes: { invoiceId: String(inv.id), invoice: inv.number },
  });
  const intent = await prisma.paymentIntent.create({
    data: { invoiceId: inv.id, provider: name, providerOrderId: orderId, amount: due, createdById: user.id },
  });
  return {
    intentId: intent.id,
    provider: name,
    orderId,
    amount: due,
    amountPaise: toPaise(due),
    currency: 'INR',
    keyId: name === 'razorpay' ? env.RAZORPAY_KEY_ID : null,
    invoiceNumber: inv.number,
    company: env.COMPANY_NAME,
    prefill: { name: inv.customer.name, email: inv.customer.email, contact: inv.customer.phone || '' },
  };
}

/**
 * Records the payment for a gateway order. Called from the customer's browser (after checkout) AND from the
 * gateway's webhook; whichever arrives first does the work and the other finds the order already PAID.
 * The order row is locked, and the payment is recorded in the same transaction, so a payment is never
 * recorded twice and never half-recorded.
 */
export async function settleIntent({ orderId, paymentId, method = 'OTHER', invoiceId = null }) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw`SELECT id, "invoiceId", amount, status::text AS status
                                     FROM "PaymentIntent" WHERE "providerOrderId" = ${orderId} FOR UPDATE`;
    if (!row || (invoiceId && row.invoiceId !== invoiceId)) throw httpError(404, 'Unknown payment order');
    if (row.status === 'PAID') return { status: 'PAID', already: true, invoiceId: row.invoiceId };

    let payment;
    try {
      payment = await recordPayment(
        row.invoiceId,
        {
          amount: Number(row.amount),
          method,
          paymentDate: fmtDate(todayIn(env.APP_TZ)),
          note: `Online payment ${paymentId}`,
        },
        null,
        tx,
      );
    } catch (e) {
      // The gateway has the money but the invoice can no longer take it (paid by hand meanwhile, cancelled ...).
      await tx.paymentIntent.update({
        where: { id: row.id },
        data: { status: 'REVIEW', providerPaymentId: paymentId, note: e.message },
      });
      return { status: 'REVIEW', invoiceId: row.invoiceId, reason: e.message };
    }
    await tx.paymentIntent.update({
      where: { id: row.id },
      data: { status: 'PAID', providerPaymentId: paymentId, paidAt: new Date() },
    });
    return { status: 'PAID', already: false, invoiceId: row.invoiceId, paymentId: payment.id };
  });
}

export async function failIntent(orderId, reason = 'Payment failed') {
  const r = await prisma.paymentIntent.updateMany({
    where: { providerOrderId: orderId, status: 'CREATED' },
    data: { status: 'FAILED', note: reason },
  });
  return r.count;
}
