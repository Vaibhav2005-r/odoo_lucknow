import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paramId } from '../../lib/params.js';
import { httpError } from '../../lib/http-error.js';
import { PASSWORD_RULE, PASSWORD_MESSAGE } from '../../lib/billing-core.js';

const router = Router();

// All routes in /users require ADMIN role (R19: only admin can manage staff accounts)
router.use(requireRole('ADMIN'));

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().regex(PASSWORD_RULE, PASSWORD_MESSAGE),
  role: z.enum(['ADMIN', 'STAFF']).default('STAFF'),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users - list all staff and admin accounts
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      customer: {
        select: { id: true, name: true, company: true },
      },
    },
  });
  res.json({ data: users });
});

// POST /api/users - create new staff or admin user
router.post('/', validate(createUserSchema), async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw httpError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.status(201).json({ data: user });
});

// PATCH /api/users/:id - update name or activate/deactivate
router.patch('/:id', validate(updateUserSchema), async (req, res) => {
  const id = paramId(req);

  if (id === req.user.id && req.body.isActive === false) {
    throw httpError(400, 'You cannot deactivate your own account');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, 'User not found');
  }

  const user = await prisma.user.update({
    where: { id },
    data: req.body,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  res.json({ data: user });
});

export default router;
