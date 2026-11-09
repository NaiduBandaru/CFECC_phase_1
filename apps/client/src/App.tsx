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

// Role-Based Route Guard (Super Admin has universal access to ALL managing things)
const RoleRoute: React.FC<{
  allowedRoles: string[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin has universal access
  if (user.roleCode === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  if (!allowedRoles.includes(user.roleCode)) {
    // If cashier, send to POS Terminal; otherwise Dashboard
    if (user.roleCode === 'CASHIER') {
      return <Navigate to="/pos" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Root Redirector based on user role
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.roleCode === 'CASHIER') {
    return <Navigate to="/pos" replace />;
  }
  return <Navigate to="/dashboard" replace />;
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
            <Route index element={<RootRedirect />} />
            <Route
              path="dashboard"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER', 'HR_PAYROLL']}>
                  <DashboardPage />
                </RoleRoute>
              }
            />
            <Route
              path="employees"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'HR_PAYROLL']}>
                  <EmployeeDirectoryPage />
                </RoleRoute>
              }
            />
            <Route
              path="employees/:id"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'HR_PAYROLL']}>
                  <EmployeeProfilePage />
                </RoleRoute>
              }
            />
            <Route
              path="items"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <ItemsMasterPage />
                </RoleRoute>
              }
            />
            <Route
              path="pricing"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <ItemPricingPage />
                </RoleRoute>
              }
            />
            <Route
              path="vendors"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <VendorsPage />
                </RoleRoute>
              }
            />
            <Route
              path="sales"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER']}>
                  <SalesRegisterPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchasing"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <PurchasingPage />
                </RoleRoute>
              }
            />
            <Route
              path="purchase-invoices"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <PurchaseInvoicesPage />
                </RoleRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER']}>
                  <InventoryPage />
                </RoleRoute>
              }
            />
            <Route
              path="billing"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ACCOUNTS_OFFICER']}>
                  <BillingPage />
                </RoleRoute>
              }
            />
            <Route
              path="payroll"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL']}>
                  <PayrollPage initialTab="PAYROLL" />
                </RoleRoute>
              }
            />
            <Route
              path="recovery-records"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ACCOUNTS_OFFICER', 'HR_PAYROLL']}>
                  <PayrollPage initialTab="RECOVERY" />
                </RoleRoute>
              }
            />
            <Route
              path="reports"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'STORE_MANAGER', 'ACCOUNTS_OFFICER']}>
                  <ReportsPage />
                </RoleRoute>
              }
            />
            <Route
              path="settings"
              element={
                <RoleRoute allowedRoles={['SUPER_ADMIN']}>
                  <SettingsPage />
                </RoleRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

