import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';

export const AppShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-appBg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header collapsed={collapsed} />

      <main
        className={`pt-20 pb-12 px-6 transition-all duration-300 min-h-screen ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

