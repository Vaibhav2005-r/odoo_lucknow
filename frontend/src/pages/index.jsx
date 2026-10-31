const placeholder = (name) => function Placeholder() {
  return <div className="p-6 text-slate-500">{name} — coming soon</div>;
};

export { default as Login } from './auth/Login';
export { default as Signup } from './auth/Signup';
export { default as ForgotPassword } from './auth/ForgotPassword';
export { default as ResetPassword } from './auth/ResetPassword';
export { default as Users } from './users/Users';
export { default as CustomerList } from './customers/CustomerList';
export { default as CustomerDetail } from './customers/CustomerDetail';
export { default as Taxes } from './config/Taxes';
export { default as PaymentTerms } from './config/PaymentTerms';
export const MySubscriptions = placeholder('My subscriptions');  // A
export const PortalSubscription = placeholder('Subscription');   // A
export const MyInvoices = placeholder('My invoices');            // A
export const PortalInvoice = placeholder('Invoice');             // A
export const Profile = placeholder('Profile');                   // A
export const ProductList = placeholder('Products');              // B
export const ProductForm = placeholder('Product');               // B
export const PlanList = placeholder('Plans');                    // B
export const PlanForm = placeholder('Plan');                     // B
export const TemplateList = placeholder('Quotation templates');  // B
export const TemplateForm = placeholder('Quotation template');   // B
export const SubscriptionList = placeholder('Subscriptions');    // B
export const SubscriptionForm = placeholder('New subscription'); // B
export const SubscriptionDetail = placeholder('Subscription');   // B
export const Dashboard = placeholder('Dashboard');               // C
export { default as DiscountList } from './discounts/DiscountList';
export { default as DiscountForm } from './discounts/DiscountForm';
export const BillingRun = placeholder('Run billing');            // C
export const InvoiceList = placeholder('Invoices');              // C
export const InvoiceDetail = placeholder('Invoice');             // C
export const PrintInvoice = placeholder('Print invoice');        // C
export const PaymentList = placeholder('Payments');              // C
