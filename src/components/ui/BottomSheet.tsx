"use client";

import * as React from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

export interface BottomSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] flex flex-col rounded-t-[2.5rem] bg-zinc-950 border-t border-zinc-800/80 outline-none p-6 shadow-2xl",
            className
          )}
        >
          {/* Grab handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700/80 mb-6" />

          {(title || description) && (
            <div className="mb-6 space-y-1">
              {title && (
                <Drawer.Title className="text-xl font-heading font-black tracking-tight text-white uppercase">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="text-xs text-zinc-400">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}

          <div className="overflow-y-auto no-scrollbar flex-1">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
