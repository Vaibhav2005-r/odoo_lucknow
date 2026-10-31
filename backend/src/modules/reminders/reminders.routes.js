import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { paginate } from '../../lib/params.js';
import { runReminders } from './reminders.service.js';

const router = Router();
router.use(requireRole('ADMIN', 'STAFF'));

// GET /api/reminders - what has been sent automatically, newest first
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = paginate(req.query);
  const [rows, total] = await prisma.$transaction([
    prisma.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      skip,
      take,
      include: {
        invoice: { select: { id: true, number: true } },
        subscription: { select: { id: true, number: true } },
      },
    }),
    prisma.notificationLog.count(),
  ]);
  res.json({ data: rows, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

// POST /api/reminders/run - send everything that is due right now (admin)
router.post('/run', requireRole('ADMIN'), async (req, res) => {
  const customerId = Number(req.body?.customerId) || null; // optional: only this customer
  res.json({ data: await runReminders(undefined, { customerId }) });
});

export default router;
