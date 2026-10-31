import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../lib/http-error.js';
import { paramId } from '../../lib/params.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/auth.js';
import { parseDate } from '../../lib/billing-core.js';

const router = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const discountBase = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.coerce.number().positive('Discount value must be greater than 0'),
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
  productIds: z.array(z.coerce.number().int().positive()).optional(),
  minPurchase: z.coerce.number().min(0, 'Min purchase cannot be negative').nullable().optional(),
  minQuantity: z.coerce.number().int().positive('Min quantity must be at least 1').nullable().optional(),
  startDate: z.string().regex(dateRegex, 'Start date must be YYYY-MM-DD').nullable().optional(),
  endDate: z.string().regex(dateRegex, 'End date must be YYYY-MM-DD').nullable().optional(),
  usageLimit: z.coerce.number().int().positive('Usage limit must be a positive integer').nullable().optional(),
  isActive: z.boolean().optional(),
};

const validateDiscountRules = (data, ctx) => {
  if (data.type === 'PERCENTAGE' && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    });
  }
  if (data.startDate && data.endDate) {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after start date',
        path: ['endDate'],
      });
    }
  }
  if (data.scope === 'PRODUCT') {
    if (!data.productIds || data.productIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one product for a product-scoped discount',
        path: ['productIds'],
      });
    }
  }
};

const createDiscountSchema = z.object(discountBase).superRefine(validateDiscountRules);

const updateDiscountSchema = z.object({
  name: discountBase.name.optional(),
  type: discountBase.type.optional(),
  value: discountBase.value.optional(),
  scope: discountBase.scope.optional(),
  productIds: discountBase.productIds,
  minPurchase: discountBase.minPurchase,
  minQuantity: discountBase.minQuantity,
  startDate: discountBase.startDate,
  endDate: discountBase.endDate,
  usageLimit: discountBase.usageLimit,
  isActive: discountBase.isActive,
}).superRefine((data, ctx) => {
  if (data.type === 'PERCENTAGE' && data.value !== undefined && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    });
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be on or after start date',
      path: ['endDate'],
    });
  }
});

const listQuerySchema = z.object({
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']).optional(),
  active: z.enum(['true', 'false', 'all']).optional(),
  search: z.string().trim().max(60).optional(),
});

// GET /api/discounts - List discounts (Admin + Staff)
router.get('/', requireRole('ADMIN', 'STAFF'), validate(listQuerySchema, 'query'), async (req, res) => {
  const q = req.valid?.query || {};
  const where = {
    ...(q.scope ? { scope: q.scope } : {}),
    ...(q.active === 'true' ? { isActive: true } : q.active === 'false' ? { isActive: false } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
  };

  const discounts = await prisma.discount.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      products: { select: { id: true, name: true, salesPrice: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  res.json({ data: discounts });
});

// GET /api/discounts/:id - View single discount (Admin + Staff)
router.get('/:id', requireRole('ADMIN', 'STAFF'), async (req, res) => {
  const id = paramId(req);
  const discount = await prisma.discount.findUnique({
    where: { id },
    include: {
      products: { select: { id: true, name: true, salesPrice: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  if (!discount) throw httpError(404, 'Discount not found');
  res.json(discount);
});

// POST /api/discounts - Create discount (Admin only)
router.post('/', requireRole('ADMIN'), validate(createDiscountSchema), async (req, res) => {
  const { productIds, startDate, endDate, ...data } = req.body;

  const existing = await prisma.discount.findUnique({ where: { name: data.name } });
  if (existing) throw httpError(409, 'A discount with this name already exists');

  const discount = await prisma.discount.create({
    data: {
      ...data,
      startDate: startDate ? parseDate(startDate) : null,
      endDate: endDate ? parseDate(endDate) : null,
      products: data.scope === 'PRODUCT' && productIds?.length
        ? { connect: productIds.map((id) => ({ id })) }
        : undefined,
    },
    include: {
      products: { select: { id: true, name: true, salesPrice: true } },
    },
  });

  res.status(201).json(discount);
});

// PATCH /api/discounts/:id - Update discount (Admin only)
router.patch('/:id', requireRole('ADMIN'), validate(updateDiscountSchema), async (req, res) => {
  const id = paramId(req);
  const existing = await prisma.discount.findUnique({ where: { id }, include: { products: true } });
  if (!existing) throw httpError(404, 'Discount not found');

  const { productIds, startDate, endDate, ...data } = req.body;

  if (data.name && data.name !== existing.name) {
    const duplicate = await prisma.discount.findUnique({ where: { name: data.name } });
    if (duplicate) throw httpError(409, 'A discount with this name already exists');
  }

  const effectiveType = data.type || existing.type;
  const effectiveValue = data.value !== undefined ? data.value : Number(existing.value);
  if (effectiveType === 'PERCENTAGE' && effectiveValue > 100) {
    throw httpError(422, 'Percentage discount cannot exceed 100%', { value: ['Percentage discount cannot exceed 100%'] });
  }

  const effectiveScope = data.scope || existing.scope;
  let productsUpdate;
  if (productIds !== undefined) {
    if (effectiveScope === 'PRODUCT') {
      if (productIds.length === 0) {
        throw httpError(422, 'Select at least one product for a product-scoped discount', {
          productIds: ['Select at least one product for a product-scoped discount'],
        });
      }
      productsUpdate = { set: productIds.map((pid) => ({ id: pid })) };
    } else {
      productsUpdate = { set: [] };
    }
  } else if (data.scope === 'SUBSCRIPTION') {
    productsUpdate = { set: [] };
  }

  const updated = await prisma.discount.update({
    where: { id },
    data: {
      ...data,
      ...(startDate !== undefined ? { startDate: startDate ? parseDate(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? parseDate(endDate) : null } : {}),
      ...(productsUpdate ? { products: productsUpdate } : {}),
    },
    include: {
      products: { select: { id: true, name: true, salesPrice: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  res.json(updated);
});

export default router;
