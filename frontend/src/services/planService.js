const STORAGE_KEY = 'loopbill_mock_plans_v2';

const INITIAL_PLANS = [
  {
    id: 1,
    name: 'ERP Professional Monthly',
    productId: 1,
    productName: 'Enterprise Cloud ERP Suite',
    price: 45000,
    billingPeriod: 'MONTHLY',
    minQuantity: 1,
    startDate: '2026-01-01',
    endDate: null,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    isActive: true,
    description: 'Billed every month on anniversary date. Best for mid-sized growing companies needing core financials, inventory & sales.',
    createdAt: '2026-01-01T09:00:00Z',
    updatedAt: '2026-02-10T11:00:00Z',
  },
  {
    id: 2,
    name: 'ERP Enterprise Annual (15% Off)',
    productId: 1,
    productName: 'Enterprise Cloud ERP Suite',
    price: 459000,
    billingPeriod: 'YEARLY',
    minQuantity: 1,
    startDate: '2026-01-01',
    endDate: null,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    isActive: true,
    description: 'Yearly upfront billing with 15% built-in term discount, full multi-branch access, and unlimited API calls.',
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-02-12T14:20:00Z',
  },
  {
    id: 3,
    name: 'Cloud Infrastructure Sprint Weekly',
    productId: 2,
    productName: 'Dedicated Cloud Compute Node',
    price: 3200,
    billingPeriod: 'WEEKLY',
    minQuantity: 1,
    startDate: '2026-01-05',
    endDate: null,
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    isActive: true,
    description: 'Agile 7-day recurring cycle for compute nodes, staging clusters, and seasonal load testing.',
    createdAt: '2026-01-05T12:00:00Z',
    updatedAt: '2026-02-08T09:30:00Z',
  },
  {
    id: 4,
    name: 'Single Outlet POS Annual Lease',
    productId: 3,
    productName: 'Smart Retail POS Terminal',
    price: 24999,
    billingPeriod: 'YEARLY',
    minQuantity: 1,
    startDate: '2026-01-10',
    endDate: null,
    autoClose: true,
    closable: false,
    pausable: false,
    renewable: true,
    isActive: true,
    description: 'Fixed 12-month hardware lease. Automatically closes on completion unless explicitly renewed.',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-02-15T16:00:00Z',
  },
  {
    id: 5,
    name: 'High-Frequency Daily Sync & Snapshot',
    productId: 6,
    productName: 'Automated Daily Cloud Backup',
    price: 150,
    billingPeriod: 'DAILY',
    minQuantity: 1,
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    isActive: false,
    description: 'Per-day micro-billing subscription for mission-critical disaster recovery replication.',
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-02-18T10:15:00Z',
  },
];

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PLANS));
      return INITIAL_PLANS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PLANS;
  }
}

function saveStored(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save plans in localStorage:', e);
  }
}

export const planService = {
  getAll({ search = '', period = 'ALL', status = 'ALL', productId = null } = {}) {
    let items = getStored();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.productName.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (period && period !== 'ALL') {
      items = items.filter((p) => p.billingPeriod === period);
    }

    if (status && status !== 'ALL') {
      const wantActive = status === 'ACTIVE';
      items = items.filter((p) => p.isActive === wantActive);
    }

    if (productId) {
      items = items.filter((p) => p.productId === Number(productId));
    }

    return items;
  },

  getById(id) {
    const numId = Number(id);
    const items = getStored();
    return items.find((p) => p.id === numId) || null;
  },

  create(planData) {
    const items = getStored();
    const nextId = items.length ? Math.max(...items.map((p) => p.id)) + 1 : 1;
    const now = new Date().toISOString();

    const newPlan = {
      id: nextId,
      name: planData.name?.trim() || 'Untitled Plan',
      productId: Number(planData.productId),
      productName: planData.productName || 'Custom Product',
      price: Number(planData.price) || 0,
      billingPeriod: planData.billingPeriod || 'MONTHLY',
      minQuantity: Number(planData.minQuantity) || 1,
      startDate: planData.startDate || new Date().toISOString().slice(0, 10),
      endDate: planData.endDate || null,
      autoClose: Boolean(planData.autoClose),
      closable: planData.closable !== false,
      pausable: Boolean(planData.pausable),
      renewable: planData.renewable !== false,
      isActive: planData.isActive !== false,
      description: planData.description?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };

    items.unshift(newPlan);
    saveStored(items);
    return newPlan;
  },

  update(id, planData) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((p) => p.id === numId);
    if (index === -1) throw new Error('Plan not found');

    const existing = items[index];
    const updated = {
      ...existing,
      ...planData,
      productId: planData.productId ? Number(planData.productId) : existing.productId,
      price: planData.price !== undefined ? Number(planData.price) : existing.price,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    saveStored(items);
    return updated;
  },

  toggleActive(id) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((p) => p.id === numId);
    if (index === -1) throw new Error('Plan not found');

    items[index].isActive = !items[index].isActive;
    items[index].updatedAt = new Date().toISOString();
    saveStored(items);
    return items[index];
  },

  delete(id) {
    const numId = Number(id);
    const items = getStored();
    const filtered = items.filter((p) => p.id !== numId);
    saveStored(filtered);
    return true;
  },

  getStats() {
    const items = getStored();
    return {
      total: items.length,
      active: items.filter((p) => p.isActive).length,
      monthly: items.filter((p) => p.billingPeriod === 'MONTHLY').length,
      yearly: items.filter((p) => p.billingPeriod === 'YEARLY').length,
    };
  },
};

