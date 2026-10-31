const STORAGE_KEY = 'loopbill_mock_templates_v2';

const INITIAL_TEMPLATES = [
  {
    id: 1,
    name: 'Standard ERP Enterprise Deployment',
    description: 'Turnkey quotation template for growing mid-market enterprises. Bundles ERP Monthly + 24/7 SLA + Automated Cloud Backups.',
    planId: 1,
    planName: 'ERP Professional Monthly',
    paymentTermId: 2,
    paymentTermName: '15 Days',
    validityDays: 30,
    isActive: true,
    lines: [
      {
        id: 1001,
        productId: 1,
        productName: 'Enterprise Cloud ERP Suite',
        description: 'Core ERP Monthly SaaS License (10 Named Users)',
        quantity: 1,
        unitPrice: 45000,
        taxRate: 18,
        discountPercent: 5,
      },
      {
        id: 1002,
        productId: 5,
        productName: 'Priority 24/7 SLA Support',
        description: 'Dedicated 1-hr SLA Technical Escalation',
        quantity: 1,
        unitPrice: 5000,
        taxRate: 18,
        discountPercent: 0,
      },
      {
        id: 1003,
        productId: 6,
        productName: 'Automated Daily Cloud Backup',
        description: '30-Day Encrypted Snapshot Vault',
        quantity: 1,
        unitPrice: 2000,
        taxRate: 18,
        discountPercent: 0,
      },
    ],
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-14T11:00:00Z',
  },
  {
    id: 2,
    name: 'Annual Cloud Infrastructure Bundle',
    description: 'High-availability infrastructure pack with annual billing terms and discounted compute capacity.',
    planId: 2,
    planName: 'ERP Enterprise Annual (15% Off)',
    paymentTermId: 3,
    paymentTermName: '30 Days',
    validityDays: 45,
    isActive: true,
    lines: [
      {
        id: 2001,
        productId: 1,
        productName: 'Enterprise Cloud ERP Suite',
        description: 'Annual Dedicated ERP Deployment (Unlimited)',
        quantity: 1,
        unitPrice: 459000,
        taxRate: 18,
        discountPercent: 10,
      },
      {
        id: 2002,
        productId: 2,
        productName: 'Dedicated Cloud Compute Node',
        description: 'Secondary Compute Failover Node (32GB RAM)',
        quantity: 2,
        unitPrice: 16000,
        taxRate: 18,
        discountPercent: 5,
      },
      {
        id: 2003,
        productId: 7,
        productName: 'Custom BI Report Builder Engine',
        description: 'Enterprise BI & Drag-and-Drop Report Designer',
        quantity: 1,
        unitPrice: 3500,
        taxRate: 18,
        discountPercent: 0,
      },
    ],
    createdAt: '2026-01-15T14:00:00Z',
    updatedAt: '2026-02-16T15:30:00Z',
  },
  {
    id: 3,
    name: 'Retail POS Starter Kit',
    description: 'Preconfigured hardware and billing software pack for standalone retail stores.',
    planId: 4,
    planName: 'Single Outlet POS Annual Lease',
    paymentTermId: 1,
    paymentTermName: 'Immediate',
    validityDays: 15,
    isActive: true,
    lines: [
      {
        id: 3001,
        productId: 3,
        productName: 'Smart Retail POS Terminal',
        description: 'Touchscreen POS Terminal with 80mm Printer',
        quantity: 1,
        unitPrice: 24999,
        taxRate: 18,
        discountPercent: 0,
      },
      {
        id: 3002,
        productId: 4,
        productName: 'Wireless Barcode Gun Scanner',
        description: '2.4GHz Cordless Barcode Reader',
        quantity: 1,
        unitPrice: 4500,
        taxRate: 18,
        discountPercent: 5,
      },
    ],
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-02-18T10:00:00Z',
  },
];

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

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TEMPLATES));
      return INITIAL_TEMPLATES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TEMPLATES;
  }
}

function saveStored(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save templates in localStorage:', e);
  }
}

export const templateService = {
  getAll({ search = '', status = 'ALL' } = {}) {
    let items = getStored();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.planName.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'ALL') {
      const wantActive = status === 'ACTIVE';
      items = items.filter((t) => t.isActive === wantActive);
    }

    return items;
  },

  getById(id) {
    const numId = Number(id);
    const items = getStored();
    return items.find((t) => t.id === numId) || null;
  },

  create(templateData) {
    const items = getStored();
    const nextId = items.length ? Math.max(...items.map((t) => t.id)) + 1 : 1;
    const now = new Date().toISOString();

    const newTemplate = {
      id: nextId,
      name: templateData.name?.trim() || 'Untitled Template',
      description: templateData.description?.trim() || '',
      planId: Number(templateData.planId),
      planName: templateData.planName || 'Standard Plan',
      paymentTermId: Number(templateData.paymentTermId) || 1,
      paymentTermName: templateData.paymentTermName || 'Immediate',
      validityDays: Number(templateData.validityDays) || 30,
      isActive: templateData.isActive !== false,
      lines: Array.isArray(templateData.lines)
        ? templateData.lines.map((l, idx) => ({
            id: l.id || nextId * 1000 + idx + 1,
            productId: Number(l.productId),
            productName: l.productName || 'Product',
            description: l.description || '',
            quantity: Math.max(1, Number(l.quantity) || 1),
            unitPrice: Math.max(0, Number(l.unitPrice) || 0),
            taxRate: Number(l.taxRate) || 0,
            discountPercent: Number(l.discountPercent) || 0,
          }))
        : [],
      createdAt: now,
      updatedAt: now,
    };

    items.unshift(newTemplate);
    saveStored(items);
    return newTemplate;
  },

  update(id, templateData) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((t) => t.id === numId);
    if (index === -1) throw new Error('Template not found');

    const existing = items[index];
    const updated = {
      ...existing,
      ...templateData,
      planId: templateData.planId ? Number(templateData.planId) : existing.planId,
      paymentTermId: templateData.paymentTermId ? Number(templateData.paymentTermId) : existing.paymentTermId,
      validityDays: templateData.validityDays !== undefined ? Number(templateData.validityDays) : existing.validityDays,
      lines: Array.isArray(templateData.lines) ? templateData.lines : existing.lines,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    saveStored(items);
    return updated;
  },

  toggleActive(id) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((t) => t.id === numId);
    if (index === -1) throw new Error('Template not found');

    items[index].isActive = !items[index].isActive;
    items[index].updatedAt = new Date().toISOString();
    saveStored(items);
    return items[index];
  },

  delete(id) {
    const numId = Number(id);
    const items = getStored();
    const filtered = items.filter((t) => t.id !== numId);
    saveStored(filtered);
    return true;
  },
};

