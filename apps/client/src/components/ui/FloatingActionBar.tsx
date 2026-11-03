import React, { useEffect } from 'react';
import { CheckSquare, X } from 'lucide-react';

export interface FloatingActionBarProps {
  selectedCount: number;
  totalCount?: number;
  itemLabel?: string;
  onClear: () => void;
  children: React.ReactNode;
}

/**
 * Standard enterprise floating action bar that stays pinned to the bottom of the screen
 * when one or more rows are selected in any table.
 */
export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  selectedCount,
  totalCount,
  itemLabel = 'records',
  onClear,
  children,
}) => {
  // Support Escape key to dismiss selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCount > 0) {
        onClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, onClear]);

  if (selectedCount === 0) return null;

  return (
    <aside
      aria-label="Bulk actions bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] w-auto bg-navy-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-navy-700/80 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-4 fade-in duration-200 select-none ring-1 ring-white/10"
    >
      {/* Selected Indicator */}
      <div className="flex items-center space-x-2.5 pr-3 border-r border-navy-700/80 shrink-0">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <div className="flex items-center space-x-1.5 font-bold">
          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono text-emerald-300 font-black">{selectedCount}</span>
          <span className="text-slate-300 font-medium hidden sm:inline">
            {totalCount ? `of ${totalCount}` : ''} {itemLabel} selected
          </span>
          <span className="text-slate-300 font-medium sm:hidden">selected</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 flex-wrap">
        {children}
      </div>

      {/* Deselect / Close */}
      <button
        type="button"
        onClick={onClear}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors ml-1 shrink-0"
        title="Clear selection [Esc]"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
};
