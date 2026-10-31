import { api } from '../lib/api';

export function mapPlan(p) {
  return {
    ...p,
    productName: p.product?.name || '',
    description: '',
    price: Number(p.price),
    startDate: String(p.startDate).slice(0, 10),
    endDate: p.endDate ? String(p.endDate).slice(0, 10) : null,
  };
}

const toPayload = (d) => ({
  ...(d.name !== undefined ? { name: d.name } : {}),
  ...(d.productId !== undefined ? { productId: Number(d.productId) } : {}),
  ...(d.price !== undefined ? { price: Number(d.price) } : {}),
  ...(d.billingPeriod !== undefined ? { billingPeriod: d.billingPeriod } : {}),
  ...(d.minQuantity !== undefined ? { minQuantity: Number(d.minQuantity) || 1 } : {}),
  ...(d.startDate !== undefined ? { startDate: d.startDate } : {}),
  ...(d.endDate !== undefined ? { endDate: d.endDate || null } : {}),
  ...['autoClose', 'closable', 'pausable', 'renewable', 'isActive'].reduce(
    (acc, k) => (d[k] !== undefined ? { ...acc, [k]: Boolean(d[k]) } : acc),
    {},
  ),
});

export const planService = {
  async getAll({ search = '', period = 'ALL', status = 'ALL', productId = null } = {}) {
    const res = await api.get('/plans', {
      params: {
        search: search.trim() || undefined,
        period: period !== 'ALL' ? period : undefined,
        status: status !== 'ALL' ? status : undefined,
        productId: productId || undefined,
      },
    });
    return res.data.map(mapPlan);
  },

  async getById(id) {
    return mapPlan((await api.get(`/plans/${id}`)).data);
  },

  async create(data) {
    return mapPlan((await api.post('/plans', toPayload(data))).data);
  },

  async update(id, data) {
    return mapPlan((await api.patch(`/plans/${id}`, toPayload(data))).data);
  },

  async toggleActive(id) {
    return mapPlan((await api.post(`/plans/${id}/toggle`)).data);
  },

  async delete(id) {
    await api.delete(`/plans/${id}`);
    return true;
  },

  async getStats() {
    return (await api.get('/plans/stats')).data;
  },
};
