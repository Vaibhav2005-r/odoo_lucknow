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
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3500,
              style: {
                background: 'rgba(29, 29, 31, 0.9)',
                color: '#fff',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                borderRadius: '999px',
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 500,
                boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
              },
              success: { iconTheme: { primary: '#34c759', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ff453a', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<P.Login />} />
            <Route path="/signup" element={<P.Signup />} />
            <Route path="/forgot-password" element={<P.ForgotPassword />} />
            <Route path="/reset-password" element={<P.ResetPassword />} />

            <Route path="/app" element={<RequireRole roles={IN}><AppLayout /></RequireRole>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<P.Dashboard />} />

              {/* Subscriptions Module */}
              <Route path="subscriptions" element={<P.SubscriptionList />} />
              <Route path="subscriptions/new" element={<P.SubscriptionForm />} />
              <Route path="subscriptions/:id" element={<P.SubscriptionDetail />} />

              {/* Quotation Templates */}
              <Route path="templates" element={<P.Templates />} />
              <Route path="templates/:id" element={<P.Templates />} />
              <Route path="quotation-templates" element={<Navigate to="/app/templates" replace />} />
              <Route path="quotation-templates/:id" element={<Navigate to="/app/templates" replace />} />

              {/* Catalog Module */}
              <Route path="products" element={<P.Products />} />
              <Route path="products/:id" element={<P.Products />} />
              <Route path="plans" element={<P.Plans />} />
              <Route path="plans/:id" element={<P.Plans />} />

              {/* Customers */}
              <Route path="customers" element={<P.CustomerList />} />
              <Route path="customers/:id" element={<P.CustomerDetail />} />

              {/* Billing & Invoices */}
              <Route path="invoices" element={<P.InvoiceList />} />
              <Route path="invoices/:id" element={<P.InvoiceDetail />} />
              <Route path="payments" element={<P.PaymentList />} />
              <Route path="billing" element={<RequireRole roles={['ADMIN']}><P.BillingRun /></RequireRole>} />

              {/* Configuration */}
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
