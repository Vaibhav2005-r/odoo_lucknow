import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { todayIn, fmtDate } from '../../lib/billing-core.js';
import { env } from '../../config/env.js';
import { getSummary, revenueByMonth, getExpiringSoon, getCustomerStatement, getGstSummary } from './reports.service.js';

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

// GET /api/reports/export-summary - CSV export of summary KPIs
router.get('/export-summary', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const today = fmtDate(todayIn(env.APP_TZ));
    const from = req.query.from || `${today.slice(0, 7)}-01`;
    const to = req.query.to || today;
    const planId = req.query.planId ? Number(req.query.planId) : null;

    const s = await getSummary({ from, to, planId });

    const rows = [
      'Metric,Value,Unit',
      `"Reporting Period From",${from},"Date"`,
      `"Reporting Period To",${to},"Date"`,
      `"Active Subscriptions",${s.activeSubscriptions},"Count"`,
      `"Monthly Recurring Revenue (MRR)",${s.mrr.toFixed(2)},"INR"`,
      `"Annual Recurring Revenue (ARR)",${s.arr.toFixed(2)},"INR"`,
      `"Total Invoiced (Period)",${s.invoiced.toFixed(2)},"INR"`,
      `"Total Collected (Period)",${s.collected.toFixed(2)},"INR"`,
      `"Outstanding Balance",${s.outstanding.toFixed(2)},"INR"`,
      `"Overdue Amount",${s.overdueAmount.toFixed(2)},"INR"`,
      `"Overdue Invoices Count",${s.overdueCount},"Count"`,
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financial-summary-${from}-to-${to}.csv"`);
    res.send(rows.join('\r\n'));
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

// GET /api/reports/customer-statement/:id - Customer statement of account with aging
router.get('/customer-statement/:id', async (req, res, next) => {
  try {
    const data = await getCustomerStatement(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Indian financial year: 1 April to 31 March
function financialYearStart(today) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return `${m >= 4 ? y : y - 1}-04-01`;
}
const gstQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const gstRange = (q) => {
  const today = fmtDate(todayIn(env.APP_TZ));
  return { from: q.from || financialYearStart(today), to: q.to || today };
};

// GET /api/reports/gst-summary - CGST / SGST / IGST collected, by month and by rate
router.get('/gst-summary', validate(gstQuerySchema, 'query'), async (req, res, next) => {
  try {
    res.json(await getGstSummary(gstRange(req.valid.query)));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/export-gst - the same figures as a CSV file for the accountant
router.get('/export-gst', validate(gstQuerySchema, 'query'), async (req, res, next) => {
  try {
    const r = await getGstSummary(gstRange(req.valid.query));
    const line = (a) => a.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    const head = ['Taxable value', 'CGST', 'SGST', 'IGST', 'Other tax', 'Total tax'];
    const vals = (x) => [x.taxable, x.cgst, x.sgst, x.igst, x.other, x.tax].map((n) => n.toFixed(2));
    const rows = [
      line(['GST summary', r.supplier.name, `GSTIN ${r.supplier.gstin}`, `${r.from} to ${r.to}`]),
      '',
      line(['Month', 'Invoices', ...head]),
      ...r.byMonth.map((m) => line([m.month, m.invoices, ...vals(m)])),
      line(['Total', r.totals.invoices, ...vals(r.totals)]),
      '',
      line(['Tax rate %', '', ...head]),
      ...r.byRate.map((x) => line([x.rate, '', ...vals(x)])),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gst-summary-${r.from}-to-${r.to}.csv"`);
    res.send(rows.join('\r\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
