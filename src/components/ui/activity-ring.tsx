import React from 'react';

export function ActivityRing({ percentage, size = 120, label, sublabel }: {
  percentage: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{width: size, height: size}}>
        <span className="text-2xl font-bold text-zinc-100">{percentage}%</span>
        {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
      </div>
      {label && <span className="text-xs text-zinc-400 mt-2">{label}</span>}
    </div>
  );
}
