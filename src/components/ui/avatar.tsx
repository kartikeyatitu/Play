import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
  statusColor?: string; // e.g. "bg-emerald-400"
}

export function Avatar({
  src,
  alt = "Avatar",
  fallback = "SO",
  size = "md",
  statusColor,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
    xl: "w-16 h-16 text-base",
  }[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/80 font-bold text-zinc-300 select-none",
        sizeClasses,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-mono uppercase font-black">{fallback}</span>
      )}
      {statusColor && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950",
            statusColor
          )}
        />
      )}
    </div>
  );
}
