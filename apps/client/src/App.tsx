import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import { DashboardPage } from './pages/dashboard/DashboardPage.js';
import { EmployeeDirectoryPage } from './pages/employees/EmployeeDirectoryPage.js';
import { EmployeeProfilePage } from './pages/employees/EmployeeProfilePage.js';
import { ItemsMasterPage } from './pages/items/ItemsMasterPage.js';
import { ItemPricingPage } from './pages/items/ItemPricingPage.js';
import { VendorsPage } from './pages/vendors/VendorsPage.js';
import { POSTerminalPage } from './pages/pos/POSTerminalPage.js';
import { SalesRegisterPage } from './pages/sales/SalesRegisterPage.js';
import { PurchasingPage } from './pages/purchasing/PurchasingPage.js';
import { PurchaseInvoicesPage } from './pages/purchasing/PurchaseInvoicesPage.js';
import { InventoryPage } from './pages/inventory/InventoryPage.js';
import { BillingPage } from './pages/billing/BillingPage.js';
import { PayrollPage } from './pages/payroll/PayrollPage.js';
import { ReportsPage } from './pages/reports/ReportsPage.js';
import { SettingsPage } from './pages/settings/SettingsPage.js';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-appBg">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Dedicated Fullscreen POS Terminal Route (No distracting sidebars or ERP headers) */}
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <POSTerminalPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Application Routes inside Back-Office Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="employees" element={<EmployeeDirectoryPage />} />
            <Route path="employees/:id" element={<EmployeeProfilePage />} />
            <Route path="items" element={<ItemsMasterPage />} />
            <Route path="pricing" element={<ItemPricingPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="sales" element={<SalesRegisterPage />} />
            <Route path="purchasing" element={<PurchasingPage />} />
            <Route path="purchase-invoices" element={<PurchaseInvoicesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="payroll" element={<PayrollPage initialTab="PAYROLL" />} />
            <Route path="recovery-records" element={<PayrollPage initialTab="RECOVERY" />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

