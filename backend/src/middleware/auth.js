import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { httpError } from '../lib/http-error.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return next(httpError(401, 'Please log in'));
  try {
    const p = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: Number(p.sub), role: p.role, customerId: p.cid ?? null };
    return next();
  } catch {
    return next(httpError(401, 'Your session has expired, please log in again'));
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(httpError(403, 'You do not have permission to do this'));

export const isInternal = (req) => req.user.role === 'ADMIN' || req.user.role === 'STAFF';

// Customers only ever see their own rows. Use in every list/get of subscriptions, invoices, payments.
export const ownScope = (req) =>
  req.user.role === 'CUSTOMER' ? { customerId: req.user.customerId ?? -1 } : {};
