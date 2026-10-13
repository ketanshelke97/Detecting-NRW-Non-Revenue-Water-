import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'default';

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  const variantStyles = {
    success: 'bg-scada-success/20 text-scada-success border-scada-success/30',
    warning: 'bg-scada-warning/20 text-scada-warning border-scada-warning/30',
    danger: 'bg-scada-danger/20 text-scada-danger border-scada-danger/30',
    default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
