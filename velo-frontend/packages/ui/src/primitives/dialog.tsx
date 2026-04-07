"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useId, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

interface DialogContextValue {
  open: boolean;
  setOpen: (value: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export interface DialogProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({ children, defaultOpen = false, onOpenChange, open }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const titleId = useId();
  const descriptionId = useId();
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const value = useMemo<DialogContextValue>(
    () => ({ open: Boolean(currentOpen), setOpen, titleId, descriptionId }),
    [currentOpen, descriptionId, titleId]
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  children,
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const context = useDialogContext("DialogTrigger");

  return (
    <button
      {...props}
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-3 py-2 text-sm font-medium text-[hsl(var(--color-foreground))] transition-colors hover:bg-[hsl(var(--color-surface-hover))]",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.setOpen(true);
        }
      }}
    >
      {children}
    </button>
  );
}

export function DialogContent({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useDialogContext("DialogContent");

  if (!context.open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--color-overlay))] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={context.titleId}
        aria-describedby={context.descriptionId}
        className={cn(
          "w-full max-w-lg rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-elevated))] p-6 shadow-lg",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mb-4 space-y-1", className)} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const context = useDialogContext("DialogTitle");
  return (
    <h2
      {...props}
      id={context.titleId}
      className={cn("text-lg font-semibold text-[hsl(var(--color-foreground))]", className)}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  const context = useDialogContext("DialogDescription");
  return (
    <p
      {...props}
      id={context.descriptionId}
      className={cn("text-sm text-[hsl(var(--color-muted))]", className)}
    />
  );
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mt-6 flex items-center justify-end gap-3", className)} />;
}

export function DialogClose({
  children = "Close",
  className
}: {
  children?: ReactNode;
  className?: string;
}) {
  const context = useDialogContext("DialogClose");

  return (
    <Button
      variant="secondary"
      className={className}
      onClick={() => context.setOpen(false)}
    >
      {children}
    </Button>
  );
}

function useDialogContext(name: string): DialogContextValue {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error(`${name} must be used inside <Dialog>`);
  }

  return context;
}
