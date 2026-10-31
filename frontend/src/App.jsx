import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { RequireRole } from './components/layout/RequireRole';
import AppLayout from './components/layout/AppLayout';
import PortalLayout from './components/layout/PortalLayout';
import * as P from './pages';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
const IN = ['ADMIN', 'STAFF'];

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<P.Login />} />
            <Route path="/signup" element={<P.Signup />} />
            <Route path="/forgot-password" element={<P.ForgotPassword />} />
            <Route path="/reset-password" element={<P.ResetPassword />} />

            <Route path="/app" element={<RequireRole roles={IN}><AppLayout /></RequireRole>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<P.Dashboard />} />
              <Route path="subscriptions" element={<P.SubscriptionList />} />
              <Route path="subscriptions/new" element={<P.SubscriptionForm />} />
              <Route path="subscriptions/:id" element={<P.SubscriptionDetail />} />
              <Route path="quotation-templates" element={<P.TemplateList />} />
              <Route path="quotation-templates/:id" element={<P.TemplateForm />} />
              <Route path="customers" element={<P.CustomerList />} />
              <Route path="customers/:id" element={<P.CustomerDetail />} />
              <Route path="invoices" element={<P.InvoiceList />} />
              <Route path="invoices/:id" element={<P.InvoiceDetail />} />
              <Route path="payments" element={<P.PaymentList />} />
              <Route path="billing" element={<RequireRole roles={['ADMIN']}><P.BillingRun /></RequireRole>} />
              <Route path="products" element={<P.ProductList />} />
              <Route path="products/:id" element={<P.ProductForm />} />
              <Route path="plans" element={<P.PlanList />} />
              <Route path="plans/:id" element={<P.PlanForm />} />
              <Route path="discounts" element={<P.DiscountList />} />
              <Route path="discounts/:id" element={<P.DiscountForm />} />
              <Route path="taxes" element={<RequireRole roles={['ADMIN']}><P.Taxes /></RequireRole>} />
              <Route path="payment-terms" element={<RequireRole roles={['ADMIN']}><P.PaymentTerms /></RequireRole>} />
              <Route path="users" element={<RequireRole roles={['ADMIN']}><P.Users /></RequireRole>} />
            </Route>
            <Route path="/app/invoices/:id/print" element={<RequireRole roles={IN}><P.PrintInvoice /></RequireRole>} />

            <Route path="/portal" element={<RequireRole roles={['CUSTOMER']}><PortalLayout /></RequireRole>}>
              <Route index element={<P.MySubscriptions />} />
              <Route path="subscriptions/:id" element={<P.PortalSubscription />} />
              <Route path="invoices" element={<P.MyInvoices />} />
              <Route path="invoices/:id" element={<P.PortalInvoice />} />
              <Route path="profile" element={<P.Profile />} />
            </Route>
            <Route path="/portal/invoices/:id/print" element={<RequireRole roles={['CUSTOMER']}><P.PrintInvoice /></RequireRole>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
