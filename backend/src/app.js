import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import taxRoutes from './modules/taxes/taxes.routes.js';
import paymentTermRoutes from './modules/payment-terms/payment-terms.routes.js';
import productRoutes from './modules/products/products.routes.js';
import variantRoutes from './modules/products/variants.routes.js';
import planRoutes from './modules/plans/plans.routes.js';
import templateRoutes from './modules/templates/templates.routes.js';
import discountRoutes from './modules/discounts/discounts.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';

export const app = express();
if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY); // correct client IPs for rate limiting behind nginx
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev')); // prints the response time of every request: proof for "< 2 seconds"

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);

app.use('/api', requireAuth); // everything below needs a login
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/payment-terms', paymentTermRoutes);
app.use('/api/products', productRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/quotation-templates', templateRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: { message: 'Not found' } }));
app.use(errorHandler);
