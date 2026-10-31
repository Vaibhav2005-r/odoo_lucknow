const STORAGE_KEY = 'loopbill_mock_subscriptions_v2';

const INITIAL_SUBSCRIPTIONS = [
  {
    id: 1,
    number: 'SUB/2026/00001',
    customerId: 1,
    customerName: 'Riya Sharma',
    customerCompany: 'Sharma Retailers Pvt Ltd',
    customerEmail: 'riya@sharmaretail.in',
    customerPhone: '+91 98765 43210',
    customerGstin: '09AAACS1429B1ZB',
    customerAddress: 'Plot 42, Gomti Nagar, Lucknow, UP 226010',
    planId: 1,
    planName: 'ERP Professional Monthly',
    productName: 'Enterprise Cloud ERP Suite',
    billingPeriod: 'MONTHLY',
    status: 'ACTIVE',
    startDate: '2026-01-15',
    expiryDate: '2027-01-14',
    nextBillingDate: '2026-11-15',
    paymentTermId: 2,
    paymentTermName: '15 Days',
    discountId: 1,
    discountName: 'New Customer Welcome (5%)',
    notes: 'Primary enterprise tenant for Lucknow retail flagship stores.',
    isPaused: false,
    pausedAt: null,
    basePlanPrice: 45000,
    addonsAmount: 7000,
    discountAmount: 2600,
    taxAmount: 8892,
    recurringAmount: 58292,
    lines: [
      {
        id: 101,
        productId: 1,
        name: 'Enterprise Cloud ERP Suite (10 Users)',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: 45000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: true,
      },
      {
        id: 102,
        productId: 5,
        name: 'Priority 24/7 SLA Support',
        type: 'ADDON',
        quantity: 1,
        unitPrice: 5000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: false,
      },
      {
        id: 103,
        productId: 6,
        name: 'Automated Daily Cloud Backup (30-Day)',
        type: 'ADDON',
        quantity: 1,
        unitPrice: 2000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: false,
      },
    ],
    invoices: [
      {
        id: 11,
        number: 'INV/2026/00012',
        invoiceDate: '2026-10-15',
        dueDate: '2026-10-30',
        amount: 58292,
        status: 'PAID',
        period: '15 Oct 2026 - 14 Nov 2026',
      },
      {
        id: 8,
        number: 'INV/2026/00008',
        invoiceDate: '2026-09-15',
        dueDate: '2026-09-30',
        amount: 58292,
        status: 'PAID',
        period: '15 Sep 2026 - 14 Oct 2026',
      },
      {
        id: 4,
        number: 'INV/2026/00004',
        invoiceDate: '2026-08-15',
        dueDate: '2026-08-30',
        amount: 58292,
        status: 'PAID',
        period: '15 Aug 2026 - 14 Sep 2026',
      },
    ],
    activityLog: [
      {
        id: 1,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        user: 'Asha Admin',
        note: 'Subscription initialized via Standard ERP Enterprise Deployment template.',
        timestamp: '2026-01-15T09:00:00Z',
      },
      {
        id: 2,
        action: 'QUOTATION_SENT',
        fromStatus: 'DRAFT',
        toStatus: 'QUOTATION',
        user: 'Sam Staff',
        note: 'Official quotation dispatch sent to riya@sharmaretail.in.',
        timestamp: '2026-01-15T10:15:00Z',
      },
      {
        id: 3,
        action: 'CONFIRMED',
        fromStatus: 'QUOTATION',
        toStatus: 'CONFIRMED',
        user: 'Riya Sharma',
        note: 'Quotation digitally approved by customer via self-service portal.',
        timestamp: '2026-01-16T14:20:00Z',
      },
      {
        id: 4,
        action: 'ACTIVATED',
        fromStatus: 'CONFIRMED',
        toStatus: 'ACTIVE',
        user: 'System Engine',
        note: 'Subscription active. Initial invoice INV/2026/00001 dispatched.',
        timestamp: '2026-01-16T14:25:00Z',
      },
    ],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 2,
    number: 'SUB/2026/00002',
    customerId: 2,
    customerName: 'Rahul Verma',
    customerCompany: 'Verma Tech Solutions LLP',
    customerEmail: 'rahul@vermatech.com',
    customerPhone: '+91 98111 22334',
    customerGstin: '09AABCV5544C1ZT',
    customerAddress: 'Tower B, Cyber Heights, Vibhuti Khand, Lucknow 226010',
    planId: 2,
    planName: 'ERP Enterprise Annual (15% Off)',
    productName: 'Enterprise Cloud ERP Suite',
    billingPeriod: 'YEARLY',
    status: 'ACTIVE',
    startDate: '2026-03-01',
    expiryDate: '2027-02-28',
    nextBillingDate: '2027-03-01',
    paymentTermId: 3,
    paymentTermName: '30 Days',
    discountId: 2,
    discountName: 'Annual Prepay Discount (10%)',
    notes: 'Multi-branch deployment with unlimited user licenses.',
    isPaused: false,
    pausedAt: null,
    basePlanPrice: 459000,
    addonsAmount: 35000,
    discountAmount: 49400,
    taxAmount: 79848,
    recurringAmount: 524448,
    lines: [
      {
        id: 201,
        productId: 1,
        name: 'Enterprise Cloud ERP Suite (Annual)',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: 459000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: true,
      },
      {
        id: 202,
        productId: 2,
        name: 'Dedicated Cloud Compute Node (32GB)',
        type: 'SERVICE',
        quantity: 2,
        unitPrice: 16000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: false,
      },
      {
        id: 203,
        productId: 7,
        name: 'Custom BI Report Builder Engine',
        type: 'ADDON',
        quantity: 1,
        unitPrice: 3000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: false,
      },
    ],
    invoices: [
      {
        id: 3,
        number: 'INV/2026/00003',
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-31',
        amount: 524448,
        status: 'PAID',
        period: '01 Mar 2026 - 28 Feb 2027',
      },
    ],
    activityLog: [
      {
        id: 1,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        user: 'Asha Admin',
        note: 'Contract quotation generated for annual terms.',
        timestamp: '2026-02-25T11:00:00Z',
      },
      {
        id: 2,
        action: 'QUOTATION_SENT',
        fromStatus: 'DRAFT',
        toStatus: 'QUOTATION',
        user: 'Sam Staff',
        note: 'Quotation sent to rahul@vermatech.com.',
        timestamp: '2026-02-26T10:00:00Z',
      },
      {
        id: 3,
        action: 'CONFIRMED',
        fromStatus: 'QUOTATION',
        toStatus: 'CONFIRMED',
        user: 'Rahul Verma',
        note: 'PO received and confirmed.',
        timestamp: '2026-02-28T16:00:00Z',
      },
      {
        id: 4,
        action: 'ACTIVATED',
        fromStatus: 'CONFIRMED',
        toStatus: 'ACTIVE',
        user: 'Asha Admin',
        note: 'Annual instance activated.',
        timestamp: '2026-03-01T00:01:00Z',
      },
    ],
    createdAt: '2026-02-25T11:00:00Z',
    updatedAt: '2026-03-01T00:01:00Z',
  },
  {
    id: 3,
    number: 'SUB/2026/00003',
    customerId: 3,
    customerName: 'Priya Nair',
    customerCompany: 'GreenLeaf Organics Ltd',
    customerEmail: 'priya@greenleaf.in',
    customerPhone: '+91 97222 33445',
    customerGstin: '09AAACG9988D1Z8',
    customerAddress: '14/3 Hazratganj Commercial Complex, Lucknow 226001',
    planId: 3,
    planName: 'Cloud Infrastructure Sprint Weekly',
    productName: 'Dedicated Cloud Compute Node',
    billingPeriod: 'WEEKLY',
    status: 'QUOTATION',
    startDate: '2026-11-01',
    expiryDate: '2027-10-31',
    nextBillingDate: '2026-11-01',
    paymentTermId: 2,
    paymentTermName: '15 Days',
    discountId: null,
    discountName: null,
    notes: 'Staging environment trial sprint for Diwali e-commerce load.',
    isPaused: false,
    pausedAt: null,
    basePlanPrice: 3200,
    addonsAmount: 0,
    discountAmount: 0,
    taxAmount: 576,
    recurringAmount: 3776,
    lines: [
      {
        id: 301,
        productId: 2,
        name: 'Dedicated Cloud Compute Node',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: 3200,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: true,
      },
    ],
    invoices: [],
    activityLog: [
      {
        id: 1,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        user: 'Sam Staff',
        note: 'Sprint quote created.',
        timestamp: '2026-10-28T14:00:00Z',
      },
      {
        id: 2,
        action: 'QUOTATION_SENT',
        fromStatus: 'DRAFT',
        toStatus: 'QUOTATION',
        user: 'Sam Staff',
        note: 'Proposal sent to priya@greenleaf.in.',
        timestamp: '2026-10-29T09:30:00Z',
      },
    ],
    createdAt: '2026-10-28T14:00:00Z',
    updatedAt: '2026-10-29T09:30:00Z',
  },
  {
    id: 4,
    number: 'SUB/2026/00004',
    customerId: 4,
    customerName: 'Amit Patel',
    customerCompany: 'Apex Cloud Systems',
    customerEmail: 'amit@apexcloud.io',
    customerPhone: '+91 96333 44556',
    customerGstin: '09AABCA1234E1ZP',
    customerAddress: '77 Industrial Estate, Transport Nagar, Lucknow 226012',
    planId: 1,
    planName: 'ERP Professional Monthly',
    productName: 'Enterprise Cloud ERP Suite',
    billingPeriod: 'MONTHLY',
    status: 'DRAFT',
    startDate: '2026-11-05',
    expiryDate: '2027-11-04',
    nextBillingDate: '2026-11-05',
    paymentTermId: 1,
    paymentTermName: 'Immediate',
    discountId: 1,
    discountName: 'New Customer Welcome (5%)',
    notes: 'Draft proposal pending line-item approval with client CTO.',
    isPaused: false,
    pausedAt: null,
    basePlanPrice: 45000,
    addonsAmount: 5000,
    discountAmount: 2500,
    taxAmount: 8550,
    recurringAmount: 56050,
    lines: [
      {
        id: 401,
        productId: 1,
        name: 'Enterprise Cloud ERP Suite',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: 45000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: true,
      },
      {
        id: 402,
        productId: 5,
        name: 'Priority 24/7 SLA Support',
        type: 'ADDON',
        quantity: 1,
        unitPrice: 5000,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: false,
      },
    ],
    invoices: [],
    activityLog: [
      {
        id: 1,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        user: 'Asha Admin',
        note: 'Draft quotation prepared.',
        timestamp: '2026-10-30T16:45:00Z',
      },
    ],
    createdAt: '2026-10-30T16:45:00Z',
    updatedAt: '2026-10-30T16:45:00Z',
  },
  {
    id: 5,
    number: 'SUB/2026/00005',
    customerId: 2,
    customerName: 'Rahul Verma',
    customerCompany: 'Verma Tech Solutions LLP',
    customerEmail: 'rahul@vermatech.com',
    customerPhone: '+91 98111 22334',
    customerGstin: '09AABCV5544C1ZT',
    customerAddress: 'Tower B, Cyber Heights, Vibhuti Khand, Lucknow 226010',
    planId: 4,
    planName: 'Single Outlet POS Annual Lease',
    productName: 'Smart Retail POS Terminal',
    billingPeriod: 'YEARLY',
    status: 'CLOSED',
    startDate: '2025-06-01',
    expiryDate: '2026-05-31',
    nextBillingDate: null,
    paymentTermId: 1,
    paymentTermName: 'Immediate',
    discountId: null,
    discountName: null,
    notes: 'Replaced with Enterprise Cloud Suite bundle on renewal.',
    isPaused: false,
    pausedAt: null,
    basePlanPrice: 24999,
    addonsAmount: 0,
    discountAmount: 0,
    taxAmount: 4499.82,
    recurringAmount: 29498.82,
    lines: [
      {
        id: 501,
        productId: 3,
        name: 'Smart Retail POS Terminal',
        type: 'GOODS',
        quantity: 1,
        unitPrice: 24999,
        taxRate: 18,
        taxName: 'GST 18%',
        isActive: true,
        isBasePlan: true,
      },
    ],
    invoices: [
      {
        id: 1,
        number: 'INV/2025/00045',
        invoiceDate: '2025-06-01',
        dueDate: '2025-06-01',
        amount: 29498.82,
        status: 'PAID',
        period: '01 Jun 2025 - 31 May 2026',
      },
    ],
    activityLog: [
      {
        id: 1,
        action: 'ACTIVATED',
        fromStatus: 'CONFIRMED',
        toStatus: 'ACTIVE',
        user: 'System Engine',
        note: 'Lease commenced.',
        timestamp: '2025-06-01T09:00:00Z',
      },
      {
        id: 2,
        action: 'CLOSED',
        fromStatus: 'ACTIVE',
        toStatus: 'CLOSED',
        user: 'Rahul Verma',
        note: 'Contract term fulfilled and migrated to Cloud ERP.',
        timestamp: '2026-05-31T23:59:59Z',
      },
    ],
    createdAt: '2025-05-25T10:00:00Z',
    updatedAt: '2026-05-31T23:59:59Z',
  },
];

function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SUBSCRIPTIONS));
      return INITIAL_SUBSCRIPTIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SUBSCRIPTIONS;
  }
}

function saveStored(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save subscriptions in localStorage:', e);
  }
}

export function recalcSubscriptionTotals(sub) {
  const baseLine = sub.lines.find((l) => l.isBasePlan && l.isActive);
  const basePrice = baseLine ? Number(baseLine.unitPrice) * Number(baseLine.quantity) : 0;

  const addonLines = sub.lines.filter((l) => !l.isBasePlan && l.isActive);
  const addonsAmount = addonLines.reduce((acc, l) => acc + Number(l.unitPrice) * Number(l.quantity), 0);

  const subtotal = basePrice + addonsAmount;
  let discountAmount = 0;
  if (sub.discountRate) {
    discountAmount = subtotal * (sub.discountRate / 100);
  } else if (sub.discountFixed) {
    discountAmount = Math.min(subtotal, sub.discountFixed);
  } else if (sub.discountAmount) {
    discountAmount = Number(sub.discountAmount);
  }

  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxable * 0.18; // Default GST 18%
  const recurringAmount = Math.round((taxable + taxAmount) * 100) / 100;

  return {
    ...sub,
    basePlanPrice: basePrice,
    addonsAmount,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    recurringAmount,
  };
}

export const subscriptionService = {
  getAll({ search = '', status = 'ALL', planId = 'ALL', page = 1, pageSize = 10 } = {}) {
    let items = getStored();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (s) =>
          s.number.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.customerCompany.toLowerCase().includes(q) ||
          s.planName.toLowerCase().includes(q)
      );
    }

    if (status && status !== 'ALL') {
      items = items.filter((s) => s.status === status);
    }

    if (planId && planId !== 'ALL') {
      items = items.filter((s) => s.planId === Number(planId));
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedItems,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  },

  getById(id) {
    const numId = Number(id);
    const items = getStored();
    return items.find((s) => s.id === numId) || null;
  },

  create(input, author = 'Asha Admin') {
    const items = getStored();
    const nextId = items.length ? Math.max(...items.map((s) => s.id)) + 1 : 1;
    const seq = String(nextId).padStart(5, '0');
    const number = `SUB/2026/${seq}`;
    const now = new Date().toISOString();

    const initialStatus = input.initialStatus || 'DRAFT';

    let sub = {
      id: nextId,
      number,
      customerId: Number(input.customerId),
      customerName: input.customerName || 'Customer',
      customerCompany: input.customerCompany || '',
      customerEmail: input.customerEmail || '',
      customerPhone: input.customerPhone || '',
      customerGstin: input.customerGstin || '',
      customerAddress: input.customerAddress || '',
      planId: Number(input.planId),
      planName: input.planName || 'Selected Plan',
      productName: input.productName || 'Main Product',
      billingPeriod: input.billingPeriod || 'MONTHLY',
      status: initialStatus,
      startDate: input.startDate || now.slice(0, 10),
      expiryDate: input.expiryDate || '2027-10-31',
      nextBillingDate: input.nextBillingDate || input.startDate || now.slice(0, 10),
      paymentTermId: Number(input.paymentTermId) || 1,
      paymentTermName: input.paymentTermName || 'Immediate',
      discountId: input.discountId ? Number(input.discountId) : null,
      discountName: input.discountName || null,
      discountRate: input.discountRate || 0,
      notes: input.notes || '',
      isPaused: false,
      pausedAt: null,
      lines: Array.isArray(input.lines)
        ? input.lines.map((l, idx) => ({
            id: l.id || nextId * 100 + idx + 1,
            productId: Number(l.productId),
            name: l.name || 'Line Item',
            type: l.type || (idx === 0 ? 'SERVICE' : 'ADDON'),
            quantity: Math.max(1, Number(l.quantity) || 1),
            unitPrice: Math.max(0, Number(l.unitPrice) || 0),
            taxRate: Number(l.taxRate) || 18,
            taxName: l.taxName || 'GST 18%',
            isActive: l.isActive !== false,
            isBasePlan: idx === 0,
          }))
        : [],
      invoices: [],
      activityLog: [
        {
          id: 1,
          action: 'CREATED',
          fromStatus: null,
          toStatus: initialStatus,
          user: author,
          note: `Subscription initialized as ${initialStatus}.`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    sub = recalcSubscriptionTotals(sub);

    items.unshift(sub);
    saveStored(items);
    return sub;
  },

  update(id, updates) {
    const numId = Number(id);
    const items = getStored();
    const index = items.findIndex((s) => s.id === numId);
    if (index === -1) throw new Error('Subscription not found');

    const updated = recalcSubscriptionTotals({
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    items[index] = updated;
    saveStored(items);
    return updated;
  },

  // State Transition Actions
  sendQuotation(id, author = 'Sam Staff') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'DRAFT') throw new Error('Only DRAFT subscriptions can be sent as Quotation');

    const now = new Date().toISOString();
    sub.status = 'QUOTATION';
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'QUOTATION_SENT',
      fromStatus: 'DRAFT',
      toStatus: 'QUOTATION',
      user: author,
      note: `Official quotation generated and emailed to ${sub.customerEmail}.`,
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  confirm(id, author = 'Riya Sharma') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'QUOTATION') throw new Error('Only QUOTATION subscriptions can be confirmed');

    const now = new Date().toISOString();
    sub.status = 'CONFIRMED';
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'CONFIRMED',
      fromStatus: 'QUOTATION',
      toStatus: 'CONFIRMED',
      user: author,
      note: 'Customer approved quotation terms and order specifications.',
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  activate(id, author = 'Asha Admin') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'CONFIRMED') throw new Error('Only CONFIRMED subscriptions can be activated');

    const now = new Date().toISOString();
    sub.status = 'ACTIVE';

    // Generate initial invoice
    const invNumber = `INV/2026/${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const invoice = {
      id: sub.invoices.length + 1,
      number: invNumber,
      invoiceDate: now.slice(0, 10),
      dueDate: now.slice(0, 10),
      amount: sub.recurringAmount,
      status: 'CONFIRMED',
      period: `${sub.startDate} - First Billing Cycle`,
    };
    sub.invoices.unshift(invoice);

    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'ACTIVATED',
      fromStatus: 'CONFIRMED',
      toStatus: 'ACTIVE',
      user: author,
      note: `Subscription activated. First cycle invoice ${invNumber} generated for ${sub.recurringAmount}.`,
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  pause(id, author = 'Sam Staff') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'ACTIVE') throw new Error('Only ACTIVE subscriptions can be paused');

    const now = new Date().toISOString();
    sub.status = 'PAUSED';
    sub.isPaused = true;
    sub.pausedAt = now.slice(0, 10);
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'PAUSED',
      fromStatus: 'ACTIVE',
      toStatus: 'PAUSED',
      user: author,
      note: 'Billing schedule temporarily paused on customer request.',
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  resume(id, author = 'Sam Staff') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'PAUSED') throw new Error('Only PAUSED subscriptions can be resumed');

    const now = new Date().toISOString();
    sub.status = 'ACTIVE';
    sub.isPaused = false;
    sub.pausedAt = null;
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'RESUMED',
      fromStatus: 'PAUSED',
      toStatus: 'ACTIVE',
      user: author,
      note: 'Subscription recurring schedule resumed.',
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  close(id, reason = 'Customer requested cancellation', author = 'Asha Admin') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status === 'CLOSED') throw new Error('Subscription is already closed');

    const now = new Date().toISOString();
    const prevStatus = sub.status;
    sub.status = 'CLOSED';
    sub.nextBillingDate = null;
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'CLOSED',
      fromStatus: prevStatus,
      toStatus: 'CLOSED',
      user: author,
      note: `Subscription closed. Reason: ${reason}`,
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  renew(id, newExpiryDate, author = 'Asha Admin') {
    const sub = this.getById(id);
    if (!sub) throw new Error('Subscription not found');
    if (sub.status !== 'ACTIVE') throw new Error('Only ACTIVE subscriptions can be renewed');

    const now = new Date().toISOString();
    const oldExpiry = sub.expiryDate;
    sub.expiryDate = newExpiryDate;
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'RENEWED',
      fromStatus: 'ACTIVE',
      toStatus: 'ACTIVE',
      user: author,
      note: `Contract extension renewed from ${oldExpiry} to ${newExpiryDate}.`,
      timestamp: now,
    });
    sub.updatedAt = now;

    return this.update(id, sub);
  },

  toggleAddon(subscriptionId, lineId, isActive) {
    const sub = this.getById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const line = sub.lines.find((l) => l.id === Number(lineId));
    if (!line) throw new Error('Line item not found');
    if (line.isBasePlan) throw new Error('Base plan item cannot be deactivated');

    line.isActive = isActive;
    const now = new Date().toISOString();
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: isActive ? 'ADDON_ENABLED' : 'ADDON_DISABLED',
      fromStatus: sub.status,
      toStatus: sub.status,
      user: 'Asha Admin',
      note: `Add-on "${line.name}" was ${isActive ? 'activated' : 'deactivated'}.`,
      timestamp: now,
    });

    return this.update(subscriptionId, sub);
  },

  addAddon(subscriptionId, addon) {
    const sub = this.getById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const newLineId = sub.lines.length ? Math.max(...sub.lines.map((l) => l.id)) + 1 : 101;
    const now = new Date().toISOString();

    const newLine = {
      id: newLineId,
      productId: Number(addon.productId),
      name: addon.name || 'Add-on Item',
      type: 'ADDON',
      quantity: Math.max(1, Number(addon.quantity) || 1),
      unitPrice: Math.max(0, Number(addon.unitPrice) || 0),
      taxRate: Number(addon.taxRate) || 18,
      taxName: addon.taxName || 'GST 18%',
      isActive: true,
      isBasePlan: false,
    };

    sub.lines.push(newLine);
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'ADDON_ADDED',
      fromStatus: sub.status,
      toStatus: sub.status,
      user: 'Asha Admin',
      note: `New add-on "${newLine.name}" added to subscription.`,
      timestamp: now,
    });

    return this.update(subscriptionId, sub);
  },

  removeAddon(subscriptionId, lineId) {
    const sub = this.getById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const line = sub.lines.find((l) => l.id === Number(lineId));
    if (!line) throw new Error('Line item not found');
    if (line.isBasePlan) throw new Error('Base plan item cannot be removed');

    sub.lines = sub.lines.filter((l) => l.id !== Number(lineId));
    const now = new Date().toISOString();
    sub.activityLog.unshift({
      id: sub.activityLog.length + 1,
      action: 'ADDON_REMOVED',
      fromStatus: sub.status,
      toStatus: sub.status,
      user: 'Asha Admin',
      note: `Add-on "${line.name}" was removed.`,
      timestamp: now,
    });

    return this.update(subscriptionId, sub);
  },

  getStats() {
    const items = getStored();
    return {
      total: items.length,
      active: items.filter((s) => s.status === 'ACTIVE').length,
      draft: items.filter((s) => s.status === 'DRAFT').length,
      quotation: items.filter((s) => s.status === 'QUOTATION').length,
      confirmed: items.filter((s) => s.status === 'CONFIRMED').length,
      paused: items.filter((s) => s.status === 'PAUSED').length,
      closed: items.filter((s) => s.status === 'CLOSED').length,
    };
  },
};

