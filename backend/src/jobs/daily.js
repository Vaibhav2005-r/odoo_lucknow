import cron from 'node-cron';
import { env } from '../config/env.js';
import { todayIn } from '../lib/billing-core.js';

export async function runDailyJobs(asOf = todayIn(env.APP_TZ)) {
  console.log('[daily] job triggered for', asOf);
}

export function startJobs() {
  runDailyJobs().catch((e) => console.error('[daily] startup run failed', e));
  cron.schedule('5 0 * * *', () => runDailyJobs().catch((e) => console.error('[daily]', e)), { timezone: env.APP_TZ });
}
