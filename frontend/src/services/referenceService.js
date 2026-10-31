import { api } from '../lib/api';

// Dropdown data shared by the catalog and subscription pages, always read from the API.
export const referenceService = {
  async taxes() {
    const res = await api.get('/taxes', { params: { active: true } });
    return res.data.map((t) => ({ ...t, rate: Number(t.rate) }));
  },

  async paymentTerms() {
    const res = await api.get('/payment-terms', { params: { active: true } });
    return res.data;
  },

  // Whole-subscription discounts that can be attached to a contract.
  async subscriptionDiscounts() {
    const res = await api.get('/discounts', { params: { scope: 'SUBSCRIPTION', active: 'true' } });
    return res.data.map((d) => ({ ...d, value: Number(d.value) }));
  },

  async customers(search = '') {
    const res = await api.get('/customers', { params: { pageSize: 100, search: search || undefined } });
    return res.data;
  },
};
