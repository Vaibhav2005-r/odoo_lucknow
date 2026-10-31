// Default mock datasets for shared dropdowns (customers, taxes, payment terms, discounts)
// Used across Catalog & Subscriptions creation and editing

export const DEFAULT_CUSTOMERS = [
  {
    id: 1,
    name: 'Riya Sharma',
    company: 'Sharma Retailers Pvt Ltd',
    email: 'riya@sharmaretail.in',
    phone: '+91 98765 43210',
    address: 'Plot 42, Gomti Nagar, Lucknow, UP 226010',
    gstin: '09AAACS1429B1ZB',
  },
  {
    id: 2,
    name: 'Rahul Verma',
    company: 'Verma Tech Solutions LLP',
    email: 'rahul@vermatech.com',
    phone: '+91 98111 22334',
    address: 'Tower B, Cyber Heights, Vibhuti Khand, Lucknow 226010',
    gstin: '09AABCV5544C1ZT',
  },
  {
    id: 3,
    name: 'Priya Nair',
    company: 'GreenLeaf Organics Ltd',
    email: 'priya@greenleaf.in',
    phone: '+91 97222 33445',
    address: '14/3 Hazratganj Commercial Complex, Lucknow 226001',
    gstin: '09AAACG9988D1Z8',
  },
  {
    id: 4,
    name: 'Amit Patel',
    company: 'Apex Cloud Systems',
    email: 'amit@apexcloud.io',
    phone: '+91 96333 44556',
    address: '77 Industrial Estate, Transport Nagar, Lucknow 226012',
    gstin: '09AABCA1234E1ZP',
  },
];

export const DEFAULT_TAXES = [
  { id: 1, name: 'GST 18%', rate: 18.0, isActive: true },
  { id: 2, name: 'GST 12%', rate: 12.0, isActive: true },
  { id: 3, name: 'GST 5%', rate: 5.0, isActive: true },
  { id: 4, name: 'Zero Tax 0%', rate: 0.0, isActive: true },
];

export const DEFAULT_PAYMENT_TERMS = [
  { id: 1, name: 'Immediate', dueDays: 0, isActive: true },
  { id: 2, name: '15 Days', dueDays: 15, isActive: true },
  { id: 3, name: '30 Days', dueDays: 30, isActive: true },
  { id: 4, name: '45 Days', dueDays: 45, isActive: true },
];

export const DEFAULT_DISCOUNTS = [
  { id: 1, name: 'New Customer Welcome (5%)', type: 'PERCENTAGE', value: 5.0, scope: 'SUBSCRIPTION', isActive: true },
  { id: 2, name: 'Annual Prepay Discount (10%)', type: 'PERCENTAGE', value: 10.0, scope: 'SUBSCRIPTION', isActive: true },
  { id: 3, name: 'Startup Flat Waiver (₹2,500)', type: 'FIXED', value: 2500.0, scope: 'SUBSCRIPTION', isActive: true },
  { id: 4, name: 'Product Hardware Rebate (₹1,000)', type: 'FIXED', value: 1000.0, scope: 'PRODUCT', isActive: true },
];

