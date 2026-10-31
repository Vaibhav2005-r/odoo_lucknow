import { api } from '../lib/api';

const num = (v) => (v == null ? 0 : Number(v));

// API row -> the flat shape the catalog pages render.
export function mapProduct(p) {
  return {
    ...p,
    sku: `PRD-${String(p.id).padStart(3, '0')}`,
    description: p.notes || '',
    imageUrl: '',
    salesPrice: num(p.salesPrice),
    costPrice: num(p.costPrice),
    taxIds: (p.taxes || []).map((t) => t.id),
    taxes: (p.taxes || []).map((t) => ({ ...t, rate: num(t.rate) })),
    variants: (p.variants || []).map((v) => ({ ...v, extraPrice: num(v.extraPrice) })),
  };
}

const toPayload = (d) => ({
  ...(d.name !== undefined ? { name: d.name } : {}),
  ...(d.type !== undefined ? { type: d.type } : {}),
  ...(d.salesPrice !== undefined ? { salesPrice: Number(d.salesPrice) } : {}),
  ...(d.costPrice !== undefined ? { costPrice: Number(d.costPrice) } : {}),
  ...(d.description !== undefined ? { notes: d.description || null } : {}),
  ...(d.taxIds !== undefined ? { taxIds: d.taxIds } : {}),
  ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
  ...(Array.isArray(d.variants)
    ? {
        variants: d.variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          attribute: v.attribute,
          value: v.value,
          extraPrice: Number(v.extraPrice) || 0,
          ...(v.isActive !== undefined ? { isActive: v.isActive } : {}),
        })),
      }
    : {}),
});

export const productService = {
  async getAll({ search = '', type = 'ALL', status = 'ALL' } = {}) {
    const res = await api.get('/products', {
      params: {
        search: search.trim() || undefined,
        type: type !== 'ALL' ? type : undefined,
        status: status !== 'ALL' ? status : undefined,
      },
    });
    return res.data.map(mapProduct);
  },

  async getById(id) {
    return mapProduct((await api.get(`/products/${id}`)).data);
  },

  async create(data) {
    return mapProduct((await api.post('/products', toPayload(data))).data);
  },

  async update(id, data) {
    return mapProduct((await api.patch(`/products/${id}`, toPayload(data))).data);
  },

  async toggleActive(id) {
    return mapProduct((await api.post(`/products/${id}/toggle`)).data);
  },

  async delete(id) {
    await api.delete(`/products/${id}`);
    return true;
  },

  async getStats() {
    return (await api.get('/products/stats')).data;
  },
};
