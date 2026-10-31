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
  COMPANY_NAME: process.env.COMPANY_NAME || 'Brightloop Software',
  SMTP: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  MAIL_FROM: process.env.MAIL_FROM || 'Brightloop Billing <billing@brightloop.local>',
};
