import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-800 text-zinc-300",
        lime:
          "border-lime-400/30 bg-lime-400/15 text-lime-400",
        emerald:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
        sky:
          "border-sky-500/30 bg-sky-500/15 text-sky-400",
        purple:
          "border-purple-500/30 bg-purple-500/15 text-purple-400",
        amber:
          "border-amber-500/30 bg-amber-500/15 text-amber-400",
        rose:
          "border-rose-500/30 bg-rose-500/15 text-rose-400",
        outline:
          "border-zinc-800 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
