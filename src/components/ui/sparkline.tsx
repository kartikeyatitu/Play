import React from 'react';

export function Sparkline({ data, width = 120, height = 32, color = '#10b981' }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  
  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * usableWidth;
    // Prevent divide by zero if all values are the same
    const y = range === 0 
      ? height / 2 
      : height - padding - ((value - min) / range) * usableHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
