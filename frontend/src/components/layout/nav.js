const IN = ['ADMIN', 'STAFF'];
const AD = ['ADMIN'];

export const NAV = [
  {
    group: 'Overview',
    items: [{ to: '/app/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: IN }],
  },
  {
    group: 'Sales',
    items: [
      { to: '/app/subscriptions', label: 'Subscriptions', icon: 'Repeat', roles: IN },
      { to: '/app/templates', label: 'Quotation Templates', icon: 'FileStack', roles: IN },
      { to: '/app/customers', label: 'Customers', icon: 'Users', roles: IN },
    ],
  },
  {
    group: 'Billing',
    items: [
      { to: '/app/invoices', label: 'Invoices', icon: 'Receipt', roles: IN },
      { to: '/app/payments', label: 'Payments', icon: 'Wallet', roles: IN },
      { to: '/app/billing', label: 'Run Billing', icon: 'PlayCircle', roles: AD },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { to: '/app/products', label: 'Products', icon: 'Package', roles: IN },
      { to: '/app/plans', label: 'Plans', icon: 'CalendarClock', roles: IN },
      { to: '/app/discounts', label: 'Discounts', icon: 'BadgePercent', roles: IN },
    ],
  },
  {
    group: 'Configuration',
    items: [
      { to: '/app/taxes', label: 'Taxes', icon: 'Percent', roles: AD },
      { to: '/app/payment-terms', label: 'Payment Terms', icon: 'Clock', roles: AD },
      { to: '/app/users', label: 'Staff Users', icon: 'ShieldCheck', roles: AD },
    ],
  },
];
