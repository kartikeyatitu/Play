'use client';
import { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  accent?: 'emerald' | 'cyan' | 'violet' | 'rose' | 'amber';
}

const accentColors = {
  emerald: 'from-emerald-500/20 to-cyan-500/20',
  cyan: 'from-cyan-500/20 to-blue-500/20',
  violet: 'from-violet-500/20 to-purple-500/20',
  rose: 'from-rose-500/20 to-pink-500/20',
  amber: 'from-amber-500/20 to-orange-500/20',
};

const glowColors = {
  emerald: 'from-emerald-500/30 to-cyan-500/30',
  cyan: 'from-cyan-500/30 to-blue-500/30',
  violet: 'from-violet-500/30 to-purple-500/30',
  rose: 'from-rose-500/30 to-pink-500/30',
  amber: 'from-amber-500/30 to-orange-500/30',
};

export function GlowCard({ children, className = '', accent = 'emerald' }: GlowCardProps) {
  return (
    <div className={`group relative ${className}`}>
      {/* Glow effect - visible on hover */}
      <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-r ${glowColors[accent]} opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100`} />
      {/* Border gradient */}
      <div className={`relative rounded-2xl bg-gradient-to-r ${accentColors[accent]} p-[1px]`}>
        {/* Card content */}
        <div className="rounded-[15px] bg-zinc-900/90 backdrop-blur-sm h-full">
          {children}
        </div>
      </div>
    </div>
  );
}
