import { api } from '../lib/api';

const num = (v) => (v == null ? 0 : Number(v));
const day = (d) => (d ? String(d).slice(0, 10) : null);

// API row (list or detail) -> the flat shape the subscription pages render.
export function mapSubscription(s) {
  const planProductId = s.plan?.productId ?? s.plan?.product?.id;
  const lines = (s.lines || []).map((l) => {
    const taxes = l.taxes || [];
    return {
      id: l.id,
      productId: l.productId,
      variantId: l.variantId ?? null,
      name: l.description,
      type: l.product?.type || (l.productId === planProductId ? 'SERVICE' : 'ADDON'),
      quantity: l.quantity,
      unitPrice: num(l.unitPrice),
      taxRate: taxes.reduce((a, t) => a + num(t.rate), 0),
      taxName: taxes.map((t) => t.name).join(', ') || 'No tax',
      isActive: l.isActive !== false,
      isBasePlan: planProductId != null && l.productId === planProductId,
      total: num(l.total),
      subtotal: num(l.subtotal),
    };
  });
  const sumActive = (pred) =>
    lines.filter((l) => l.isActive && pred(l)).reduce((a, l) => a + l.unitPrice * l.quantity, 0);

  return {
    id: s.id,
    number: s.number,
    status: s.status === 'ACTIVE' && s.isPaused ? 'PAUSED' : s.status,
    customerId: s.customerId,
    customerName: s.customer?.name || '',
    customerCompany: s.customer?.company || '',
    customerEmail: s.customer?.email || '',
    customerPhone: s.customer?.phone || '',
    customerGstin: s.customer?.gstin || '',
    customerAddress: s.customer?.address || '',
    planId: s.planId,
    planName: s.plan?.name || '',
    productName: s.plan?.product?.name || '',
    billingPeriod: s.plan?.billingPeriod || 'MONTHLY',
    planPausable: Boolean(s.plan?.pausable),
    planClosable: s.plan?.closable !== false,
    planRenewable: s.plan?.renewable !== false,
    templateName: s.template?.name || null,
    startDate: day(s.startDate),
    expiryDate: day(s.expiryDate),
    quoteValidUntil: day(s.quoteValidUntil),
    nextBillingDate: day(s.nextInvoiceDate),
    paymentTermId: s.paymentTermId,
    paymentTermName: s.paymentTerm?.name || '',
    discountId: s.discountId ?? null,
    discountName: s.discount?.name || null,
    notes: s.notes || '',
    isPaused: Boolean(s.isPaused),
    pausedAt: day(s.pausedAt),
    lines,
    basePlanPrice: sumActive((l) => l.isBasePlan),
    addonsAmount: sumActive((l) => !l.isBasePlan),
    subtotal: num(s.amountSubtotal),
    discountAmount: num(s.amountDiscount),
    taxAmount: num(s.amountTax),
    recurringAmount: num(s.amountTotal),
    invoices: (s.invoices || []).map((i) => ({
      id: i.id,
      number: i.number,
      invoiceDate: day(i.invoiceDate),
      dueDate: day(i.dueDate),
      amount: num(i.amountTotal),
      amountPaid: num(i.amountPaid),
      status: i.status,
      period: i.periodStart ? `${day(i.periodStart)} to ${day(i.periodEnd)}` : '',
    })),
    invoiceCount: s._count?.invoices ?? (s.invoices || []).length,
    activityLog: (s.history || []).map((h) => ({
      id: h.id,
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      user: h.userId ? `User #${h.userId}` : 'System',
      note: h.note || '',
      timestamp: h.createdAt,
    })),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// Lifecycle calls return different shapes; re-read so the page always gets the full subscription.
const post = async (id, action, body) => {
  await api.post(`/subscriptions/${id}/${action}`, body);
  return mapSubscription((await api.get(`/subscriptions/${id}`)).data);
};

export const subscriptionService = {
  async getAll({ search = '', status = 'ALL', planId = 'ALL', page = 1, pageSize = 10 } = {}) {
    const res = await api.get('/subscriptions', {
      params: {
        search: search.trim() || undefined,
        status: status !== 'ALL' ? status : undefined,
        planId: planId !== 'ALL' ? planId : undefined,
        page,
        pageSize,
      },
    });
    return { data: res.data.map(mapSubscription), meta: res.meta };
  },

  async getById(id) {
    return mapSubscription((await api.get(`/subscriptions/${id}`)).data);
  },

  // input: { customerId, planId, templateId?, paymentTermId, discountId?, startDate, expiryDate, notes, lines, initialStatus }
  // lines: base plan line first, then add-ons. The server prices the plan line from the plan (+ variant extra).
  async create(input) {
    const lines = (input.lines || []).map((l) => ({
      productId: Number(l.productId),
      variantId: l.variantId ? Number(l.variantId) : null,
      quantity: Math.max(1, Number(l.quantity) || 1),
      ...(l.isBasePlan || l.unitPrice == null ? {} : { unitPrice: Number(l.unitPrice) }),
    }));
    const body = {
      customerId: Number(input.customerId),
      planId: Number(input.planId),
      ...(input.templateId ? { templateId: Number(input.templateId) } : {}),
      ...(input.paymentTermId ? { paymentTermId: Number(input.paymentTermId) } : {}),
      ...(input.discountId ? { discountId: Number(input.discountId) } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(lines.length ? { lines } : {}),
    };
    const created = mapSubscription((await api.post('/subscriptions', body)).data);
    return input.initialStatus === 'QUOTATION' ? this.sendQuotation(created.id) : created;
  },

  async update(id, data) {
    return mapSubscription((await api.patch(`/subscriptions/${id}`, data)).data);
  },

  sendQuotation: (id) => post(id, 'send-quotation'),
  confirm: (id) => post(id, 'confirm'),
  activate: (id) => post(id, 'activate'),
  pause: (id) => post(id, 'pause'),
  resume: (id) => post(id, 'resume'),
  close: (id, reason) => post(id, 'close', { reason }),
  renew: (id, expiryDate) => post(id, 'renew', expiryDate ? { expiryDate } : {}),

  async toggleAddon(id, lineId, isActive) {
    return mapSubscription((await api.patch(`/subscriptions/${id}/lines/${lineId}`, { isActive })).data);
  },

  async addAddon(id, { productId, variantId = null, quantity = 1, unitPrice }) {
    const body = {
      productId: Number(productId),
      variantId,
      quantity: Math.max(1, Number(quantity) || 1),
      ...(unitPrice != null ? { unitPrice: Number(unitPrice) } : {}),
    };
    return mapSubscription((await api.post(`/subscriptions/${id}/lines`, body)).data);
  },

  async removeAddon(id, lineId) {
    return mapSubscription((await api.delete(`/subscriptions/${id}/lines/${lineId}`)).data);
  },

  async remove(id) {
    await api.delete(`/subscriptions/${id}`);
    return true;
  },

  async getStats() {
    return (await api.get('/subscriptions/stats')).data;
  },
};
