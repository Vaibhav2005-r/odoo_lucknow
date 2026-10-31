import cron from 'node-cron';
import { env } from '../config/env.js';
import { todayIn } from '../lib/billing-core.js';
import { activateDueSubscriptions, autoCloseExpired } from '../modules/subscriptions/subscriptions.service.js';
import { runBilling } from '../modules/billing/billing.service.js';
import { runReminders, withinSendingWindow } from '../modules/reminders/reminders.service.js';

export async function runDailyJobs(asOf = todayIn(env.APP_TZ)) {
  const activated = await activateDueSubscriptions(asOf);
  const billing = await runBilling(asOf); // before auto-close, so the last period is billed
  const closed = await autoCloseExpired(asOf);
  console.log('[daily]', { activated, invoicesCreated: billing.invoicesCreated, failed: billing.failed.length, closed });
}

// Reminder e-mails go out in the daytime only. Called by the 09:00 schedule and once at start-up; the unique
// per-reminder key makes extra calls harmless.
export async function runReminderJob(asOf = todayIn(env.APP_TZ)) {
  if (env.REMINDERS_ENABLED === false) return null;
  if (!withinSendingWindow()) return null;
  const r = await runReminders(asOf);
  if (r.dueSoon + r.overdue + r.renewals + r.failed + r.deferred > 0) console.log('[reminders]', r);
  return r;
}

export function startJobs() {
  runDailyJobs().catch((e) => console.error('[daily] startup run failed', e)); // catch-up if the server was off
  runReminderJob().catch((e) => console.error('[reminders] startup run failed', e));
  cron.schedule(`0 ${env.REMINDER_HOUR} * * *`, () => runReminderJob().catch((e) => console.error('[reminders]', e)), { timezone: env.APP_TZ });
  cron.schedule('5 0 * * *', () => runDailyJobs().catch((e) => console.error('[daily]', e)), { timezone: env.APP_TZ });
}
