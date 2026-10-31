import 'dotenv/config';

for (const k of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[k]) throw new Error(`Missing env var ${k} — copy .env.example to .env`);
}

export const env = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  APP_TZ: process.env.APP_TZ || 'Asia/Kolkata',
  // number of reverse proxies in front of the API (nginx, a load balancer). 0 = none, so X-Forwarded-For is ignored.
  // Online payments. With Razorpay keys set, real (or test-mode) Razorpay checkout is used. Otherwise
  // PAYMENT_GATEWAY=mock gives a built-in test checkout for demos; it is the default outside production.
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  PAYMENT_GATEWAY: process.env.PAYMENT_GATEWAY || (process.env.NODE_ENV === 'production' ? 'none' : 'mock'),
  REMINDERS_ENABLED: process.env.REMINDERS_ENABLED !== 'false',
  REMINDER_BATCH_LIMIT: Math.max(1, Number(process.env.REMINDER_BATCH_LIMIT || 500)),
  REMINDER_HOUR: Math.min(20, Math.max(0, Number(process.env.REMINDER_HOUR ?? 9))),
  TRUST_PROXY: Number(process.env.TRUST_PROXY || 0),
  COMPANY_NAME: process.env.COMPANY_NAME || 'Brightloop Software',
  // our own GST registration: the state decides whether a customer pays CGST + SGST (same state) or IGST
  COMPANY_GSTIN: (process.env.COMPANY_GSTIN || '09AABCB1234C1Z7').toUpperCase(),
  COMPANY_ADDRESS: process.env.COMPANY_ADDRESS || 'Gomti Nagar, Lucknow, Uttar Pradesh 226010',
  SMTP: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  MAIL_FROM: process.env.MAIL_FROM || 'Brightloop Billing <billing@brightloop.local>',
};

// the state part of our GSTIN (first two digits)
env.COMPANY_STATE_CODE = process.env.COMPANY_STATE_CODE || env.COMPANY_GSTIN.slice(0, 2);
