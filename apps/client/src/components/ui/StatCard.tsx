import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
}) => {
  const iconColor = {
    default: 'text-primary bg-primary-light',
    primary: 'text-primary bg-blue-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-red-600 bg-red-50',
    success: 'text-emerald-600 bg-emerald-50',
  }[variant];

  return (
    <div className="bg-surface rounded-cfecc border border-borderLine p-5 shadow-subtle hover:shadow-elevated transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">{title}</span>
        <div className={clsx('p-2.5 rounded-lg', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-navy-800 tracking-tight tabular-nums">{value}</div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center text-xs text-textSecondary space-x-1.5">
            {trend && (
              <span className={clsx('font-semibold', trend.isPositive ? 'text-status-success' : 'text-status-danger')}>
                {trend.value}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
