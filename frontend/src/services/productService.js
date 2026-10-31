const STORAGE_KEY = 'loopbill_mock_products_v2';

const INITIAL_PRODUCTS = [
  {
    id: 1,
    name: 'Enterprise Cloud ERP Suite',
    sku: 'PRD-ERP-001',
    type: 'SERVICE',
    salesPrice: 45000,
    costPrice: 20000,
    taxIds: [1], // GST 18%
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Comprehensive business management engine with multi-ledger financials, real-time inventory, CRM, and supply chain automation.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=60',
    isActive: true,
    variants: [
      { id: 101, attribute: 'User Capacity', value: '10 Named Users', extraPrice: 0, isActive: true },
      { id: 102, attribute: 'User Capacity', value: '25 Named Users', extraPrice: 15000, isActive: true },
      { id: 103, attribute: 'User Capacity', value: '50 Named Users', extraPrice: 30000, isActive: true },
      { id: 104, attribute: 'Storage', value: '100 GB NVMe', extraPrice: 2500, isActive: true },
    ],
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 2,
    name: 'Dedicated Cloud Compute Node',
    sku: 'PRD-SRV-002',
    type: 'SERVICE',
    salesPrice: 12000,
    costPrice: 6000,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Isolated high-frequency Xeon/EPYC compute node with dedicated memory channels and multi-zone failover.',
    imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&auto=format&fit=crop&q=60',
    isActive: true,
    variants: [
      { id: 201, attribute: 'RAM', value: '16 GB ECC', extraPrice: 0, isActive: true },
      { id: 202, attribute: 'RAM', value: '32 GB ECC', extraPrice: 4000, isActive: true },
      { id: 203, attribute: 'RAM', value: '64 GB ECC', extraPrice: 9000, isActive: true },
      { id: 204, attribute: 'Bandwidth', value: '10 Gbps Unmetered', extraPrice: 1500, isActive: true },
    ],
    createdAt: '2026-01-12T11:00:00Z',
    updatedAt: '2026-02-10T09:15:00Z',
  },
  {
    id: 3,
    name: 'Smart Retail POS Terminal',
    sku: 'PRD-POS-003',
    type: 'GOODS',
    salesPrice: 24999,
    costPrice: 16000,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Rugged dual-display touch billing terminal with integrated 80mm thermal receipt cutter, NFC contactless reader and battery backup.',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=400&auto=format&fit=crop&q=60',
    isActive: true,
    variants: [
      { id: 301, attribute: 'Color Finish', value: 'Matte Obsidian Black', extraPrice: 0, isActive: true },
      { id: 302, attribute: 'Color Finish', value: 'Pearl Alabaster White', extraPrice: 500, isActive: true },
      { id: 303, attribute: 'Integrated Module', value: '2D QR / Barcode Scanner', extraPrice: 2000, isActive: true },
    ],
    createdAt: '2026-01-14T08:30:00Z',
    updatedAt: '2026-02-18T16:45:00Z',
  },
  {
    id: 4,
    name: 'Wireless Barcode Gun Scanner',
    sku: 'PRD-SCN-004',
    type: 'GOODS',
    salesPrice: 4500,
    costPrice: 2500,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Ergonomic 2.4GHz + Bluetooth industrial barcode reader with 100m wireless range and 30,000 scans per charge.',
    imageUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=400&auto=format&fit=crop&q=60',
    isActive: true,
    variants: [
      { id: 401, attribute: 'Connectivity', value: 'Standard USB Dongle 2.4G', extraPrice: 0, isActive: true },
      { id: 402, attribute: 'Connectivity', value: 'Bluetooth 5.2 + Auto-Charging Cradle', extraPrice: 1200, isActive: true },
    ],
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-02-12T10:00:00Z',
  },
  {
    id: 5,
    name: 'Priority 24/7 SLA Support',
    sku: 'ADD-SLA-001',
    type: 'ADDON',
    salesPrice: 5000,
    costPrice: 1000,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Guaranteed 1-hour critical response SLA, assigned senior technical account manager, and direct phone escalation.',
    imageUrl: '',
    isActive: true,
    variants: [
      { id: 501, attribute: 'Coverage Window', value: 'Standard Business (9x5)', extraPrice: 0, isActive: true },
      { id: 502, attribute: 'Coverage Window', value: 'Mission Critical (24x7x365)', extraPrice: 3500, isActive: true },
    ],
    createdAt: '2026-01-18T14:00:00Z',
    updatedAt: '2026-02-01T11:20:00Z',
  },
  {
    id: 6,
    name: 'Automated Daily Cloud Backup',
    sku: 'ADD-BKP-002',
    type: 'ADDON',
    salesPrice: 2000,
    costPrice: 500,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Geo-redundant encrypted automated database snapshots with point-in-time recovery and ransomware vault isolation.',
    imageUrl: '',
    isActive: true,
    variants: [
      { id: 601, attribute: 'Retention Policy', value: '30-Day Snapshot Retention', extraPrice: 0, isActive: true },
      { id: 602, attribute: 'Retention Policy', value: '90-Day Extended Compliance', extraPrice: 1500, isActive: true },
      { id: 603, attribute: 'Retention Policy', value: '365-Day Long-term Vault', extraPrice: 4000, isActive: true },
    ],
    createdAt: '2026-01-19T15:30:00Z',
    updatedAt: '2026-02-05T13:40:00Z',
  },
  {
    id: 7,
    name: 'Custom BI Report Builder Engine',
    sku: 'ADD-RPT-003',
    type: 'ADDON',
    salesPrice: 3500,
    costPrice: 800,
    taxIds: [1],
    taxes: [{ id: 1, name: 'GST 18%', rate: 18 }],
    description: 'Self-service analytics drag-and-drop dashboard builder, scheduled PDF email reports, and direct SQL read-replica connection.',
    imageUrl: '',
    isActive: true,
    variants: [
      { id: 701, attribute: 'Dashboard Limit', value: 'Up to 5 Dashboards', extraPrice: 0, isActive: true },
      { id: 702, attribute: 'Dashboard Limit', value: 'Unlimited Dashboards + REST API', extraPrice: 2500, isActive: true },
    ],
    createdAt: '2026-01-20T16:00:00Z',
    updatedAt: '2026-02-08T15:10:00Z',
  },
  {
    id: 8,
    name: 'BPA-Free Thermal Paper Rolls (50-Pack)',
    sku: 'PRD-PPR-005',
    type: 'GOODS',
    salesPrice: 1200,
    costPrice: 700,
    taxIds: [2], // GST 12%
    taxes: [{ id: 2, name: 'GST 12%', rate: 12 }],
    description: 'Premium 80mm x 70m high-contrast thermal receipt paper rolls with 10-year print life guarantee.',
    imageUrl: '',
    isActive: false,
    variants: [],
    createdAt: '2026-01-22T09:00:00Z',
    updatedAt: '2026-02-14T17:00:00Z',
  },
];

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PRODUCTS;
  }
}

function saveStored(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save products in localStorage:', e);
  }
}

export const productService = {
  getAll({ search = '', type = 'ALL', status = 'ALL' } = {}) {
    let items = getStored();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (type && type !== 'ALL') {
      items = items.filter((p) => p.type === type);
    }

    if (status && status !== 'ALL') {
      const wantActive = status === 'ACTIVE';
      items = items.filter((p) => p.isActive === wantActive);
    }

    return items;
  },

  getById(id) {
    const numId = Number(id);
    const items = getStored();
    return items.find((p) => p.id === numId) || null;
  },

  create(productData) {
    const items = getStored();
    const nextId = items.length ? Math.max(...items.map((p) => p.id)) + 1 : 1;
    const now = new Date().toISOString();

    const newProduct = {
      id: nextId,
      name: productData.name?.trim() || 'Untitled Product',
      sku: productData.sku?.trim() || `PRD-${String(nextId).padStart(3, '0')}`,
      type: productData.type || 'SERVICE',
      salesPrice: Number(productData.salesPrice) || 0,
      costPrice: Number(productData.costPrice) || 0,
      description: productData.description?.trim() || '',
      taxIds: productData.taxIds || [1],
      taxes: productData.taxes || [{ id: 1, name: 'GST 18%', rate: 18 }],
      imageUrl: productData.imageUrl || '',
      isActive: productData.isActive !== false,
      variants: Array.isArray(productData.variants)
        ? productData.variants.map((v, idx) => ({
            id: v.id || nextId * 100 + idx + 1,
            attribute: v.attribute?.trim() || 'Attribute',
            value: v.value?.trim() || 'Value',
            extraPrice: Number(v.extraPrice) || 0,
            isActive: v.isActive !== false,
          }))
        : [],
      createdAt: now,
      updatedAt: now,
    };

    items.unshift(newProduct);
    saveStored(items);
    return newProduct;
  },

  update(id, productData) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((p) => p.id === numId);
    if (index === -1) throw new Error('Product not found');

    const existing = items[index];
    const updated = {
      ...existing,
      ...productData,
      salesPrice: productData.salesPrice !== undefined ? Number(productData.salesPrice) : existing.salesPrice,
      costPrice: productData.costPrice !== undefined ? Number(productData.costPrice) : existing.costPrice,
      taxIds: productData.taxIds || existing.taxIds,
      taxes: productData.taxes || existing.taxes,
      variants: Array.isArray(productData.variants) ? productData.variants : existing.variants,
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
    if (index === -1) throw new Error('Product not found');

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
      services: items.filter((p) => p.type === 'SERVICE').length,
      goods: items.filter((p) => p.type === 'GOODS').length,
      addons: items.filter((p) => p.type === 'ADDON').length,
    };
  },
};

