const placeholder = (name) => function Placeholder() {
  return <div className="p-6 text-slate-500">{name} — coming soon</div>;
};

// Auth
export { default as Login } from './auth/Login';
export { default as Signup } from './auth/Signup';
export { default as ForgotPassword } from './auth/ForgotPassword';
export { default as ResetPassword } from './auth/ResetPassword';

// Users & Configuration
export { default as Users } from './users/Users';
export { default as Taxes } from './config/Taxes';
export { default as PaymentTerms } from './config/PaymentTerms';
export { default as DiscountList } from './discounts/DiscountList';
export { default as DiscountForm } from './discounts/DiscountForm';

// Customers
export { default as CustomerList } from './customers/CustomerList';
export { default as CustomerDetail } from './customers/CustomerDetail';

// Catalog & Templates (Dev B)
export { default as Products } from './catalog/Products';
export { default as ProductList } from './catalog/Products';
export { default as ProductForm } from './catalog/Products';
export { default as Plans } from './catalog/Plans';
export { default as PlanList } from './catalog/Plans';
export { default as PlanForm } from './catalog/Plans';
export { default as Templates } from './catalog/Templates';
export { default as TemplateList } from './catalog/Templates';
export { default as TemplateForm } from './catalog/Templates';

// Subscriptions (Dev B)
export { default as SubscriptionList } from './subscriptions/SubscriptionList';
export { default as SubscriptionForm } from './subscriptions/SubscriptionForm';
export { default as SubscriptionDetail } from './subscriptions/SubscriptionDetail';

// Customer Portal (Dev A)
export { default as MySubscriptions } from './portal/MySubscriptions';
export { default as PortalSubscription } from './portal/PortalSubscription';
export { default as MyInvoices } from './portal/MyInvoices';
export { default as PortalInvoice } from './portal/PortalInvoice';
export { default as Profile } from './portal/Profile';

// Billing, Invoicing & Reports (Dev C)
export { default as Dashboard } from './dashboard/Dashboard';
export { default as BillingRun } from './billing/BillingRun';
export { default as InvoiceList } from './invoices/InvoiceList';
export { default as InvoiceDetail } from './invoices/InvoiceDetail';
export { default as PrintInvoice } from './invoices/PrintInvoice';
export { default as PaymentList } from './payments/PaymentList';
