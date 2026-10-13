import React from 'react';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  accent?: 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo' | 'zinc';
  children?: React.ReactNode;
}

export function StatCard({ title, value, trend, trendValue, icon, accent = 'emerald', children }: StatCardProps) {
  const accentColors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
    zinc: 'text-zinc-400',
  };

  return (
    <div className="group relative p-4 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{title}</span>
        {icon && <span className={accentColors[accent]}>{icon}</span>}
      </div>
      <div className="mt-2 text-3xl font-light text-zinc-100 tabular-nums">{value}</div>
      {trend && (
        <div className={`mt-1 text-xs ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-zinc-400'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '−'} {trendValue}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
