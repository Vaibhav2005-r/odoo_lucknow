import { app } from './app.js';
import { env } from './config/env.js';
import { startJobs } from './jobs/daily.js';

app.listen(env.PORT, () => {
  console.log(`LoopBill API on http://localhost:${env.PORT}`);
  startJobs();
});
