import { prisma } from '../../lib/prisma.js';
import { todayIn } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { billSubscription } from '../billing/billing.service.js';

const today = () => todayIn(env.APP_TZ);

// Stubs for Hour 3, fully completed in Hours 4 & 6 by Dev B
export async function activateDueSubscriptions(asOf = today(), onlyIds = null) {
  const due = await prisma.subscription.findMany({
    where: { status: 'CONFIRMED', startDate: { lte: asOf }, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    select: { id: true },
  });

  for (const { id } of due) {
    await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id } });
      if (!s || s.status !== 'CONFIRMED') return;
      await tx.subscription.update({
        where: { id },
        data: { status: 'ACTIVE', nextPeriodIndex: 0, nextInvoiceDate: s.startDate },
      });
      await tx.subscriptionLog.create({
        data: {
          subscriptionId: id,
          action: 'ACTIVATED',
          fromStatus: 'CONFIRMED',
          toStatus: 'ACTIVE',
        },
      });
    });
    await billSubscription(id, asOf);
  }
  return due.length;
}

export async function autoCloseExpired(asOf = today()) {
  const subs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', expiryDate: { lt: asOf }, plan: { autoClose: true } },
    select: { id: true },
  });

  for (const { id } of subs) {
    await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id } });
      if (!s || s.status !== 'ACTIVE') return;
      await tx.subscription.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closeReason: 'Expired (auto-close plan)',
          nextInvoiceDate: null,
          isPaused: false,
        },
      });
      await tx.subscriptionLog.create({
        data: {
          subscriptionId: id,
          action: 'AUTO_CLOSED',
          fromStatus: 'ACTIVE',
          toStatus: 'CLOSED',
          note: 'Plan closes automatically at expiry',
        },
      });
    });
  }
  return subs.length;
}
