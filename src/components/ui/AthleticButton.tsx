"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-heading tracking-wide uppercase font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none rounded-2xl",
  {
    variants: {
      variant: {
        primary:
          "bg-lime-400 text-zinc-950 hover:bg-lime-300 shadow-[0_0_24px_rgba(163,230,53,0.35)] hover:shadow-[0_0_32px_rgba(163,230,53,0.5)] border border-lime-300/40",
        secondary:
          "bg-zinc-900 text-zinc-100 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 shadow-sm",
        outline:
          "bg-transparent text-zinc-200 border border-zinc-700 hover:border-lime-400 hover:text-lime-400",
        ghost:
          "text-zinc-400 hover:text-white hover:bg-zinc-900/60",
        whatsapp:
          "bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/30",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50",
      },
      size: {
        sm: "h-9 px-3 text-xs rounded-xl",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-8 text-base tracking-wider rounded-2xl",
        icon: "h-10 w-10 p-0 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface AthleticButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const AthleticButton = React.forwardRef<HTMLButtonElement, AthleticButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
AthleticButton.displayName = "AthleticButton";
