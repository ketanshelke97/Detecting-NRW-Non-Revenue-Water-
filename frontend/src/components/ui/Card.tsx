import React from 'react';

export function Card({ 
  children, 
  className = '', 
  onClick, 
  title 
}: { 
  children: React.ReactNode; 
  className?: string; 
  onClick?: () => void; 
  title?: string; 
}) {
  return (
    <div 
      onClick={onClick}
      title={title}
      className={`bg-scada-panel border border-scada-border rounded-lg shadow-lg overflow-hidden backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 border-b border-scada-border bg-scada-panel/50 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg font-semibold text-slate-100 ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
}
