import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { todayIn } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { runBilling, billingStatus } from './billing.service.js';

const router = Router();

router.get('/status', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const due = await prisma.subscription.count({
    where: { status: 'ACTIVE', isPaused: false, nextInvoiceDate: { lte: todayIn(env.APP_TZ) } },
  });
  res.json({ ...billingStatus(), dueNow: due });
});

router.post('/run', requireRole('ADMIN'), (req, res) => {
  runBilling().catch((e) => console.error('[billing] run failed', e)); // background: page stays fast
  res.status(202).json(billingStatus());
});

export default router;
