import cron from 'node-cron';
import { env } from '../config/env.js';
import { todayIn } from '../lib/billing-core.js';
import { activateDueSubscriptions, autoCloseExpired } from '../modules/subscriptions/subscriptions.service.js';
import { runBilling } from '../modules/billing/billing.service.js';

export async function runDailyJobs(asOf = todayIn(env.APP_TZ)) {
  const activated = await activateDueSubscriptions(asOf);
  const billing = await runBilling(asOf); // before auto-close, so the last period is billed
  const closed = await autoCloseExpired(asOf);
  console.log('[daily]', { activated, invoicesCreated: billing.invoicesCreated, failed: billing.failed.length, closed });
}

export function startJobs() {
  runDailyJobs().catch((e) => console.error('[daily] startup run failed', e)); // catch-up if the server was off
  cron.schedule('5 0 * * *', () => runDailyJobs().catch((e) => console.error('[daily]', e)), { timezone: env.APP_TZ });
}
