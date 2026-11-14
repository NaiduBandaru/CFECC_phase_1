import React, { useState } from 'react';
import { ItemsMasterPage } from './ItemsMasterPage.js';
import { InventoryPage } from '../inventory/InventoryPage.js';
import { StockAdjustmentsRegister } from '../inventory/StockAdjustmentsRegister.js';
import { Package, Boxes, AlertOctagon } from 'lucide-react';

export type HubTab = 'catalog' | 'movements' | 'adjustments';

interface ItemsInventoryHubPageProps {
  defaultTab?: HubTab;
}

export const ItemsInventoryHubPage: React.FC<ItemsInventoryHubPageProps> = ({ defaultTab = 'catalog' }) => {
  const [activeTab, setActiveTab] = useState<HubTab>(defaultTab);

  return (
    <div className="space-y-4">
      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-borderLine bg-white px-4 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-bold transition ${
            activeTab === 'catalog'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Items Master & Catalog (1,852)</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-bold transition ${
            activeTab === 'movements'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Live Stock Levels & Movements</span>
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-bold transition ${
            activeTab === 'adjustments'
              ? 'border-primary text-primary'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-amber-500" />
          <span>Stock Adjustments & Damage Register</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'catalog' && <ItemsMasterPage hideHeader={false} />}
      {activeTab === 'movements' && <InventoryPage hideHeader={true} />}
      {activeTab === 'adjustments' && <StockAdjustmentsRegister />}
    </div>
  );
};
