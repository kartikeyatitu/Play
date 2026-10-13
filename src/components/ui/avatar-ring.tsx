'use client';

interface AvatarRingProps {
  name: string;
  percentage?: number; // 0-100 attendance
  size?: 'sm' | 'md' | 'lg'; // 32, 48, 64px
  showLabel?: boolean;
}

export function AvatarRing({ name, percentage = 0, size = 'md', showLabel = true }: AvatarRingProps) {
  const sizes = { sm: 32, md: 48, lg: 64 };
  const px = sizes[size];
  const radius = (px - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  // Gradient colors based on attendance
  const gradientId = `ring-${name.replace(/\s/g, '')}`;
  const colors = percentage >= 80 
    ? ['#10b981', '#06b6d4'] // emerald to cyan
    : percentage >= 60 
    ? ['#f59e0b', '#ef4444'] // amber to red
    : ['#6b7280', '#4b5563']; // gray

  // Get initials
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  
  // Background color from name hash
  const bgColors = ['bg-emerald-600', 'bg-cyan-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-blue-600', 'bg-pink-600', 'bg-teal-600'];
  const bgColor = bgColors[name.length % bgColors.length];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative hover-lift" style={{ width: px, height: px }}>
        {/* SVG Ring */}
        <svg width={px} height={px} className="absolute -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
          </defs>
          <circle cx={px/2} cy={px/2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3} />
          <circle cx={px/2} cy={px/2} r={radius} fill="none" stroke={`url(#${gradientId})`} strokeWidth={3}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700 ease-out animate-ring" 
            style={{ '--ring-circumference': circumference } as React.CSSProperties} />
        </svg>
        {/* Avatar Circle */}
        <div className={`absolute inset-1 rounded-full ${bgColor} flex items-center justify-center text-white font-semibold`}
          style={{ fontSize: px * 0.28 }}>
          {initials}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-zinc-400 truncate max-w-[60px] text-center">{name.split(' ')[0]}</span>
      )}
    </div>
  );
}
