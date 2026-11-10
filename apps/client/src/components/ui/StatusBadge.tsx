import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  const getVariant = (): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
    if (variant) return variant;
    const s = status.toUpperCase();
    if (['ACTIVE', 'COMPLETED', 'PAID', 'APPROVED', 'FINALIZED', 'DELIVERED', 'RECEIVED', 'SENT', 'RECOVERED'].includes(s)) {
      return 'success';
    }
    if (['PENDING', 'DRAFT', 'PARTIAL', 'PARTIALLY_PAID', 'ON_LEAVE', 'CALCULATED', 'UNPAID'].includes(s)) {
      return 'warning';
    }
    if (['INACTIVE', 'SUSPENDED', 'RESIGNED', 'CANCELLED', 'REJECTED', 'FAILED', 'LOW_STOCK'].includes(s)) {
      return 'danger';
    }
    return 'neutral';
  };

  const v = getVariant();

  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  }[v];

  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize', styles)}>
      <span className={clsx('w-1.5 h-1.5 mr-1.5 rounded-full', {
        'bg-emerald-500': v === 'success',
        'bg-amber-500': v === 'warning',
        'bg-rose-500': v === 'danger',
        'bg-blue-500': v === 'info',
        'bg-slate-400': v === 'neutral',
      })} />
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
};

