import React from 'react';
import { ItemsMasterPage } from './ItemsMasterPage.js';

export type HubTab = 'catalog';

interface ItemsInventoryHubPageProps {
  defaultTab?: string;
}

export const ItemsInventoryHubPage: React.FC<ItemsInventoryHubPageProps> = () => {
  return (
    <div className="space-y-4">
      <ItemsMasterPage hideHeader={false} />
    </div>
  );
};
