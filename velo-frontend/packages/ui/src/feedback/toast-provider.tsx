"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { cn } from "../lib/cn";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

export interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastToneClasses: Record<ToastTone, string> = {
  neutral: "border-[hsl(var(--color-border))]",
  success: "border-[hsl(var(--color-success))]/40",
  warning: "border-[hsl(var(--color-warning))]/40",
  danger: "border-[hsl(var(--color-danger))]/40"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const toast = (input: ToastInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const duration = input.duration ?? 5000;

    setToasts((current) => [...current, { ...input, id }]);

    window.setTimeout(() => {
      dismiss(id);
    }, duration);

    return id;
  };

  const value: ToastContextValue = { dismiss, toast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col gap-3">
        {toasts.map((entry) => (
          <article
            key={entry.id}
            className={cn(
              "rounded-lg border bg-[hsl(var(--color-elevated))] p-4 shadow-lg",
              toastToneClasses[entry.tone ?? "neutral"]
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--color-foreground))]">
                  {entry.title}
                </p>
                {entry.description ? (
                  <p className="mt-1 text-sm text-[hsl(var(--color-muted))]">
                    {entry.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="text-sm text-[hsl(var(--color-muted))]"
                onClick={() => dismiss(entry.id)}
              >
                Close
              </button>
            </div>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  return context;
}
