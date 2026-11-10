import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Tag, Boxes, History } from 'lucide-react';
import { ItemsMasterPage } from './ItemsMasterPage.js';
import { ItemPricingPage } from './ItemPricingPage.js';
import { InventoryPage } from '../inventory/InventoryPage.js';

export type HubTab = 'catalog' | 'pricing' | 'stock' | 'movements';

interface ItemsInventoryHubPageProps {
  defaultTab?: HubTab;
}

export const ItemsInventoryHubPage: React.FC<ItemsInventoryHubPageProps> = ({ defaultTab = 'catalog' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine initial tab from search param, pathname, or defaultTab
  const getInitialTab = (): HubTab => {
    const tabParam = searchParams.get('tab') as HubTab;
    if (tabParam && ['catalog', 'pricing', 'stock', 'movements'].includes(tabParam)) {
      return tabParam;
    }
    if (location.pathname === '/pricing') return 'pricing';
    if (location.pathname === '/inventory') return 'stock';
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<HubTab>(getInitialTab);

  // Sync tab with URL search params or route changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as HubTab;
    if (tabParam && ['catalog', 'pricing', 'stock', 'movements'].includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (location.pathname === '/pricing') {
      setActiveTab('pricing');
    } else if (location.pathname === '/inventory') {
      setActiveTab('stock');
    } else if (location.pathname === '/items' && !tabParam) {
      setActiveTab(defaultTab);
    }
  }, [location.pathname, searchParams, defaultTab]);

  const handleTabChange = (tab: HubTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Unified Hub Executive Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl font-bold text-navy-800">Items, Pricing & Inventory Hub</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Unified commodity master catalog, dual-tier pricing governance, live stock balances & FIFO movement ledger
          </p>
        </div>

        {/* Status / Active Info Pill */}
        <div className="flex items-center space-x-2 text-xs text-textSecondary">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Live Sync Active
          </span>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-borderLine pb-2">
        <button
          onClick={() => handleTabChange('catalog')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'catalog'
              ? 'bg-navy-900 text-white shadow-sm ring-1 ring-navy-700'
              : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4 text-blue-400" />
          <span>Products Catalog</span>
        </button>

        <button
          onClick={() => handleTabChange('pricing')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'pricing'
              ? 'bg-navy-900 text-white shadow-sm ring-1 ring-navy-700'
              : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-4 h-4 text-amber-400" />
          <span>Price Management</span>
        </button>

        <button
          onClick={() => handleTabChange('stock')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'stock'
              ? 'bg-navy-900 text-white shadow-sm ring-1 ring-navy-700'
              : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          <span>Stock Balances & Valuation</span>
        </button>

        <button
          onClick={() => handleTabChange('movements')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'movements'
              ? 'bg-navy-900 text-white shadow-sm ring-1 ring-navy-700'
              : 'text-textSecondary hover:text-navy-800 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4 text-purple-400" />
          <span>Stock Movement Ledger</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="transition-opacity duration-200">
        {activeTab === 'catalog' && (
          <ItemsMasterPage hideHeader={true} />
        )}

        {activeTab === 'pricing' && (
          <ItemPricingPage hideHeader={true} />
        )}

        {activeTab === 'stock' && (
          <InventoryPage hideHeader={true} hideTabs={true} initialTab="stock" />
        )}

        {activeTab === 'movements' && (
          <InventoryPage hideHeader={true} hideTabs={true} initialTab="movements" />
        )}
      </div>
    </div>
  );
};

