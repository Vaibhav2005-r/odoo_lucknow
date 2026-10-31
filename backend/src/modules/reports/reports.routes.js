import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { todayIn, fmtDate } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { getSummary, revenueByMonth, getExpiringSoon } from './reports.service.js';

const router = Router();

// Internal staff / admin only
router.use(requireRole('ADMIN', 'STAFF'));

const summaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  planId: z.coerce.number().int().positive().optional(),
});

router.get('/summary', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const today = fmtDate(todayIn(env.APP_TZ));
    const from = req.query.from || `${today.slice(0, 7)}-01`;
    const to = req.query.to || today;
    const planId = req.query.planId ? Number(req.query.planId) : null;

    const data = await getSummary({ from, to, planId });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const revenueQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

router.get('/revenue-by-month', validate(revenueQuerySchema, 'query'), async (req, res, next) => {
  try {
    const months = req.query.months ? Number(req.query.months) : 12;
    const data = await revenueByMonth({ months });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

router.get('/expiring', validate(expiringQuerySchema, 'query'), async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const data = await getExpiringSoon({ days });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
