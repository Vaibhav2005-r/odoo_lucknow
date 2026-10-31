import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { sendMail } from '../../lib/mailer.js';
import { addDays, fmtDate, todayIn, toPaise, toRupees } from '../../lib/billing-core.js';
import { emailLayout, esc, money } from '../../lib/email.js';

// When reminders go out, in days relative to the trigger date. Each stage is e-mailed at most once.
export const DUE_SOON_DAYS = 3; //                 3 days before the due date
export const OVERDUE_STAGES = [1, 7, 14, 30]; //   1, 7, 14 and 30 days after the due date
export const RENEWAL_STAGES = [30, 7]; //          30 and 7 days before a subscription expires

const MAX_FAILURES_IN_A_ROW = 5;
const DAY = 86_400_000;
const daysBetween = (a, b) => Math.round((a - b) / DAY);

// Customers should get e-mail in the daytime, not at 00:05. The job simply skips outside this window;
// the next run (the 09:00 schedule, or the next start-up) picks everything up because stages never repeat.
export function withinSendingWindow(now = new Date(), tz = env.APP_TZ, from = 9, to = 21) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= from && hour < to;
}

// Reserve the reminder first (unique key), then send. A failed send gives the reservation back so tomorrow retries.
async function deliver({ dedupeKey, kind, stage, invoiceId = null, subscriptionId = null, customer, subject, html }, send) {
  try {
    await prisma.notificationLog.create({
      data: { dedupeKey, kind, stage, invoiceId, subscriptionId, customerId: customer.id, recipient: customer.email },
    });
  } catch (e) {
    if (e.code === 'P2002') return 'skipped'; // already sent (or another server is sending it right now)
    throw e;
  }
  const ok = await send({ to: customer.email, subject, html });
  if (!ok) {
    await prisma.notificationLog.delete({ where: { dedupeKey } }).catch(() => {});
    return 'failed';
  }
  return 'sent';
}

const balanceOf = (inv) => toRupees(toPaise(inv.amountTotal) - toPaise(inv.amountPaid));

function invoiceMail(inv, { stage, kind }) {
  const link = `${env.CLIENT_URL}/portal/invoices/${inv.id}`;
  const due = fmtDate(inv.dueDate);
  const bal = money(balanceOf(inv));
  const details = `
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr><td style="padding:6px 0;color:#86868b">Invoice</td><td style="text-align:right;font-weight:600">${esc(inv.number)}</td></tr>
      <tr><td style="padding:6px 0;color:#86868b">Due date</td><td style="text-align:right">${esc(due)}</td></tr>
      <tr><td style="padding:6px 0;color:#86868b">Amount due</td><td style="text-align:right;font-weight:600">${esc(bal)}</td></tr>
    </table>`;
  if (kind === 'INVOICE_DUE_SOON') {
    return {
      subject: `Invoice ${inv.number} is due on ${due}`,
      html: emailLayout({
        heading: 'Your invoice is due soon',
        tone: 'warn',
        bodyHtml: `<p>Hello ${esc(inv.customer.name)},</p><p>A quick heads-up: your invoice is ${-stage === 0 ? 'due today' : `due in ${esc(String(-stage))} day${-stage === 1 ? '' : 's'}`}.</p>${details}`,
        cta: { label: 'View and pay invoice', url: link },
      }),
    };
  }
  const late = stage >= 14;
  return {
    subject: `${late ? 'Action needed: ' : 'Reminder: '}invoice ${inv.number} is ${stage} day${stage === 1 ? '' : 's'} overdue`,
    html: emailLayout({
      heading: `Invoice ${inv.number} is overdue`,
      tone: 'danger',
      bodyHtml: `<p>Hello ${esc(inv.customer.name)},</p><p>Our records show this invoice is now <strong>${esc(String(stage))} day${stage === 1 ? '' : 's'}</strong> past its due date.${late ? ' Please settle it soon to avoid any interruption to your service.' : ''}</p>${details}<p style="color:#86868b">If you have already paid, please ignore this message.</p>`,
      cta: { label: 'Review and pay invoice', url: link },
    }),
  };
}

function renewalMail(sub, stage) {
  const link = `${env.CLIENT_URL}/portal/subscriptions/${sub.id}`;
  const exp = fmtDate(sub.expiryDate);
  return {
    subject: `${sub.plan.name} renews in ${stage} days`,
    html: emailLayout({
      heading: 'Your subscription is coming up for renewal',
      tone: 'info',
      bodyHtml: `<p>Hello ${esc(sub.customer.name)},</p>
        <p>Your subscription <strong>${esc(sub.number)}</strong> (${esc(sub.plan.name)}) is active until <strong>${esc(exp)}</strong>.</p>
        <p>To keep your service running without a break, renew it from your account before then.</p>`,
      cta: { label: 'Manage my subscription', url: link },
    }),
  };
}

/**
 * Sends every reminder that is due as of `asOf`. Safe to run any number of times a day.
 * Per invoice / subscription only the latest applicable stage is sent, so a long-overdue invoice that is
 * picked up for the first time gets one e-mail, not four.
 * `customerId` limits the run to one customer.
 * `limit` caps e-mails per run (newest due dates first) so switching reminders on for a system with thousands
 * of old overdue invoices does not blast them all at once; the rest follow on the next runs.
 */
export async function runReminders(asOf = todayIn(env.APP_TZ), { send = sendMail, limit = env.REMINDER_BATCH_LIMIT, customerId = null } = {}) {
  const only = customerId ? { customerId } : {}; // optionally restrict the run to one customer
  const out = { dueSoon: 0, overdue: 0, renewals: 0, failed: 0, skipped: 0, deferred: 0, mailDown: false };

  // ---- work out everything that could be sent, without touching the database per item
  const work = [];

  const open = await prisma.invoice.findMany({
    where: { status: 'CONFIRMED', dueDate: { lte: addDays(asOf, DUE_SOON_DAYS) }, ...only },
    include: { customer: true },
    orderBy: { dueDate: 'desc' },
  });
  for (const inv of open) {
    if (balanceOf(inv) <= 0 || !inv.customer?.email) continue;
    const late = daysBetween(asOf, inv.dueDate); // >0 days overdue, <=0 not yet due
    const overdue = late > 0;
    const stage = overdue ? [...OVERDUE_STAGES].reverse().find((s) => late >= s) : -DUE_SOON_DAYS;
    const kind = overdue ? 'INVOICE_OVERDUE' : 'INVOICE_DUE_SOON';
    work.push({
      dedupeKey: `${kind}:${stage}:inv:${inv.id}`, kind, stage, invoiceId: inv.id, customer: inv.customer, bucket: overdue ? 'overdue' : 'dueSoon',
      build: () => invoiceMail(inv, { stage: overdue ? stage : -daysBetween(inv.dueDate, asOf), kind }),
    });
  }

  const expiring = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      expiryDate: { gte: asOf, lte: addDays(asOf, Math.max(...RENEWAL_STAGES)) },
      plan: { renewable: true },
      ...only,
    },
    include: { customer: true, plan: true },
  });
  for (const sub of expiring) {
    if (!sub.customer?.email) continue;
    const left = daysBetween(sub.expiryDate, asOf);
    const stage = [...RENEWAL_STAGES].sort((a, b) => a - b).find((s) => left <= s);
    work.push({
      dedupeKey: `RENEWAL_UPCOMING:${stage}:sub:${sub.id}:${fmtDate(sub.expiryDate)}`, kind: 'RENEWAL_UPCOMING', stage, subscriptionId: sub.id,
      customer: sub.customer, bucket: 'renewals', build: () => renewalMail(sub, left),
    });
  }

  // ---- drop what was already sent, in a handful of queries rather than one per invoice
  const sent = new Set();
  for (let i = 0; i < work.length; i += 5000) {
    const rows = await prisma.notificationLog.findMany({
      where: { dedupeKey: { in: work.slice(i, i + 5000).map((w) => w.dedupeKey) } },
      select: { dedupeKey: true },
    });
    rows.forEach((r) => sent.add(r.dedupeKey));
  }
  const todo = work.filter((w) => !sent.has(w.dedupeKey));
  out.skipped = work.length - todo.length;

  // ---- send
  // If the mail server is down, every attempt fails (or hangs). After a few failures in a row give up for this
  // run instead of working through hundreds of doomed sends; nothing is lost, tomorrow's run retries them all.
  let attempts = 0;
  let failuresInARow = 0;
  for (const w of todo) {
    if (attempts >= limit || out.mailDown) { out.deferred += 1; continue; }
    attempts += 1;
    const { subject, html } = w.build();
    const result = await deliver({ ...w, subject, html }, send);
    if (result === 'sent') { out[w.bucket] += 1; failuresInARow = 0; }
    else if (result === 'failed') {
      out.failed += 1;
      failuresInARow += 1;
      if (failuresInARow >= MAX_FAILURES_IN_A_ROW) out.mailDown = true;
    } else out.skipped += 1;
  }
  return out;
}
