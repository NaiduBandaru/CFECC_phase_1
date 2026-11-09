import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { user } = useAuth();

  // Cashiers are restricted entirely to the Fullscreen POS Terminal - no back-office shell
  if (user?.roleCode === 'CASHIER') {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="min-h-screen bg-appBg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header collapsed={collapsed} />

      <main
        className={`pt-20 pb-12 px-4 sm:px-6 transition-all duration-300 min-h-screen ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

