import { api } from '../lib/api';

export function calculateLineTotals(lines = []) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  const calculatedLines = lines.map((line) => {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
    const discountRate = Math.min(100, Math.max(0, Number(line.discountPercent) || 0));
    const taxRate = Math.max(0, Number(line.taxRate) || 0);

    const lineSubtotal = qty * unitPrice;
    const lineDiscount = lineSubtotal * (discountRate / 100);
    const lineTaxable = Math.max(0, lineSubtotal - lineDiscount);
    const lineTax = lineTaxable * (taxRate / 100);
    const lineTotal = lineTaxable + lineTax;

    subtotal += lineSubtotal;
    totalDiscount += lineDiscount;
    totalTax += lineTax;

    return {
      ...line,
      lineSubtotal: Math.round(lineSubtotal * 100) / 100,
      lineDiscount: Math.round(lineDiscount * 100) / 100,
      lineTax: Math.round(lineTax * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    };
  });

  const grandTotal = Math.max(0, subtotal - totalDiscount) + totalTax;

  return {
    lines: calculatedLines,
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(totalDiscount * 100) / 100,
    taxAmount: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

// Price shown for a template line: the plan price for the plan's own product, list price otherwise,
// plus the chosen variant's extra price (the server prices subscriptions the same way).
export function mapTemplate(t) {
  return {
    ...t,
    description: t.notes || '',
    planName: t.plan?.name || '',
    paymentTermId: t.paymentTermId || null,
    paymentTermName: t.paymentTerm?.name || '',
    lines: (t.lines || []).map((l) => {
      const base = l.productId === t.plan?.productId ? Number(t.plan.price) : Number(l.product?.salesPrice || 0);
      const extra = Number(l.variant?.extraPrice || 0);
      const taxRate = (l.product?.taxes || []).reduce((a, x) => a + Number(x.rate), 0);
      return {
        id: l.id,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.variant ? `${l.product.name} (${l.variant.attribute}: ${l.variant.value})` : l.product?.name || '',
        description: '',
        quantity: l.quantity,
        unitPrice: Math.round((base + extra) * 100) / 100,
        taxRate,
        discountPercent: 0,
      };
    }),
  };
}

const toPayload = (d) => ({
  ...(d.name !== undefined ? { name: d.name } : {}),
  ...(d.planId !== undefined ? { planId: Number(d.planId) } : {}),
  ...(d.paymentTermId !== undefined ? { paymentTermId: d.paymentTermId ? Number(d.paymentTermId) : null } : {}),
  ...(d.validityDays !== undefined ? { validityDays: Number(d.validityDays) || 30 } : {}),
  ...(d.description !== undefined ? { notes: d.description || null } : {}),
  ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
  ...(Array.isArray(d.lines)
    ? {
        lines: d.lines.map((l) => ({
          productId: Number(l.productId),
          variantId: l.variantId ? Number(l.variantId) : null,
          quantity: Math.max(1, Number(l.quantity) || 1),
        })),
      }
    : {}),
});

export const templateService = {
  async getAll({ search = '', status = 'ALL' } = {}) {
    const res = await api.get('/quotation-templates', {
      params: { search: search.trim() || undefined, status: status !== 'ALL' ? status : undefined },
    });
    return res.data.map(mapTemplate);
  },

  async getById(id) {
    return mapTemplate((await api.get(`/quotation-templates/${id}`)).data);
  },

  async create(data) {
    return mapTemplate((await api.post('/quotation-templates', toPayload(data))).data);
  },

  async update(id, data) {
    return mapTemplate((await api.patch(`/quotation-templates/${id}`, toPayload(data))).data);
  },

  async toggleActive(id) {
    return mapTemplate((await api.post(`/quotation-templates/${id}/toggle`)).data);
  },

  async delete(id) {
    await api.delete(`/quotation-templates/${id}`);
    return true;
  },
};
