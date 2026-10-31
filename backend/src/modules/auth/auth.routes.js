import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { httpError } from '../../lib/http-error.js';
import { sendMail } from '../../lib/mailer.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { PASSWORD_RULE, PASSWORD_MESSAGE } from '../../lib/billing-core.js';

const router = Router();

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().regex(PASSWORD_RULE, PASSWORD_MESSAGE);
const matching = (d) => d.password === d.confirmPassword;
const mismatch = { message: 'Passwords do not match', path: ['confirmPassword'] };

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email,
  password,
  confirmPassword: z.string(),
}).refine(matching, mismatch);

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({ email });

const resetSchema = z.object({
  token: z.string().length(64, 'Invalid reset link'),
  password,
  confirmPassword: z.string(),
}).refine(matching, mismatch);

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  customerId: u.customer?.id ?? null,
});

function startSession(res, user) {
  const token = jwt.sign(
    { sub: String(user.id), role: user.role, cid: user.customer?.id ?? null },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

router.post('/signup', validate(signupSchema), async (req, res) => {
  const { name, email: mail, password: pwd } = req.body;
  if (await prisma.user.findUnique({ where: { email: mail } })) {
    throw httpError(409, 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(pwd, 10);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { name, email: mail, passwordHash, role: 'CUSTOMER' } });
    const existing = await tx.customer.findUnique({ where: { email: mail } }); // staff may have created it
    if (existing && !existing.userId) {
      await tx.customer.update({ where: { id: existing.id }, data: { userId: u.id } });
    } else if (!existing) {
      await tx.customer.create({ data: { name, email: mail, userId: u.id } });
    }
    return tx.user.findUnique({ where: { id: u.id }, include: { customer: true } });
  });
  startSession(res, user);
  res.status(201).json(publicUser(user));
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email }, include: { customer: true } });
  const ok = user && user.isActive && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw httpError(401, 'Invalid email or password');
  startSession(res, user);
  res.json(publicUser(user));
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { customer: true } });
  if (!user || !user.isActive) throw httpError(401, 'Please log in again');
  res.json(publicUser(user));
});

router.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.isActive) throw httpError(401, 'Please log in again');

  const matches = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
  if (!matches) {
    throw httpError(400, 'Current password is incorrect');
  }

  const isSame = await bcrypt.compare(req.body.newPassword, user.passwordHash);
  if (isSame) {
    throw httpError(400, 'New password cannot be the same as your current password');
  }

  const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  res.json({ message: 'Password updated successfully' });
});

router.post('/forgot-password', validate(forgotSchema), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (user?.isActive) {
    const raw = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const link = `${env.CLIENT_URL}/reset-password?token=${raw}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your LoopBill password',
      html: `<p>Hi ${user.name},</p><p><a href="${link}">Reset your password</a>. This link works once and expires in 30 minutes.</p>`,
    });
  }
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset-password', validate(resetSchema), async (req, res) => {
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(req.body.token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
    throw httpError(400, 'This reset link is invalid or has expired. Request a new one.');
  }
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);
  res.json({ message: 'Password updated. You can log in now.' });
});

export default router;
