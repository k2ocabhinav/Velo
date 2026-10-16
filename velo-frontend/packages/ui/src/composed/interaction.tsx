"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "../primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog";
import { useFocusTrap } from "../lib/use-focus-trap";
import { cn } from "../lib/cn";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

/** Compact overflow menu with menu-key navigation and focus return. */
export function Menu({
  ariaLabel = "Open actions",
  className,
  items,
  triggerLabel = "More actions",
}: {
  items: MenuItem[];
  ariaLabel?: string;
  triggerLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((item) => item && !item.disabled)?.focus();
    function onPointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const closeAndReturnFocus = (): void => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const enabledIndexes = items.flatMap((item, index) => item.disabled ? [] : [index]);
    const activeIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    let nextIndex: number | undefined;
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const currentPosition = enabledIndexes.indexOf(activeIndex);
      const nextPosition = (currentPosition + offset + enabledIndexes.length) % enabledIndexes.length;
      nextIndex = enabledIndexes[nextPosition];
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = enabledIndexes[0];
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = enabledIndexes.at(-1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
    if (nextIndex !== undefined) itemRefs.current[nextIndex]?.focus();
  }

  return (
    <div className={cn("menu-root", className)} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="menu-trigger"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div className="menu-popover" role="menu" aria-label={ariaLabel} onKeyDown={onMenuKeyDown}>
          {items.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              role="menuitem"
              className="menu-item"
              data-destructive={item.destructive || undefined}
              disabled={item.disabled}
              tabIndex={-1}
              onClick={() => {
                item.onSelect();
                closeAndReturnFocus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Confirm a consequential action with the action verb on the destructive button. */
export function ConfirmDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  children?: ReactNode;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  async function confirm(): Promise<void> {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children ? <div className="stack compact">{children}</div> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={() => void confirm()} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Top-level application bar with brand, current page, and actions. */
export function AppTopBar({
  actions,
  brand,
  className,
  status,
  title,
}: {
  brand?: ReactNode;
  title?: string;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("app-top-bar", className)}>
      <div className="app-top-bar-brand">
        {brand}
        {title ? <h1 className="app-top-bar-title">{title}</h1> : null}
      </div>
      <div className="app-top-bar-actions">
        {status}
        {actions}
      </div>
    </header>
  );
}

export interface BottomNavItem {
  href: string;
  label: string;
  icon?: BottomNavIconName;
  badgeCount?: number;
  current?: boolean;
}

export type BottomNavIconName = "book" | "trips" | "wallet" | "account" | "home" | "earnings";

function BottomNavIcon({ name }: { name: BottomNavIconName }) {
  return (
    <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {name === "book" ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.25" /></> : null}
      {name === "trips" ? <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v3a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v1" /></> : null}
      {name === "wallet" ? <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18" /><path d="M16 14h2" /></> : null}
      {name === "account" ? <><circle cx="12" cy="8" r="3.25" /><path d="M5 20a7 7 0 0 1 14 0" /></> : null}
      {name === "home" ? <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></> : null}
      {name === "earnings" ? <><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></> : null}
    </svg>
  );
}

/** Mobile tab navigation with safe-area spacing and current-page semantics. */
export function BottomNav({
  ariaLabel = "Main navigation",
  className,
  currentPath,
  items,
}: {
  items: BottomNavItem[];
  currentPath?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav
      className={cn("bottom-nav", className)}
      aria-label={ariaLabel}
      style={{ "--bottom-nav-count": items.length } as CSSProperties}
    >
      {items.map((item) => {
        const current = item.current || currentPath === item.href;
        return (
          <a key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            {item.icon ? <span className="bottom-nav-icon" aria-hidden="true"><BottomNavIcon name={item.icon} /></span> : null}
            <span>{item.label}</span>
            {item.badgeCount && item.badgeCount > 0 ? (
              <span className="bottom-nav-badge" aria-label={`${item.badgeCount} unread`}>
                {item.badgeCount > 99 ? "99+" : item.badgeCount}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

/** Responsive bottom sheet / side panel that takes focus. Modal sheets also trap Tab, lock background scrolling and dim the page. */
export function Sheet({
  children,
  description,
  modal = true,
  onOpenChange,
  open,
  side = "right",
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: "right" | "bottom";
  /** Non-modal sheets leave the page behind them interactive; use them when the sheet floats over a map. */
  modal?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useFocusTrap(panelRef, open, close, { modal });

  if (!open) return null;
  return (
    <div
      className="sheet-overlay"
      data-modal={modal}
      onMouseDown={(event) => {
        if (modal && event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        ref={panelRef}
        className="sheet-panel"
        data-side={side}
        role="dialog"
        aria-modal={modal ? "true" : undefined}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
          <button type="button" className="menu-trigger sheet-close" aria-label="Close panel" onClick={close}>×</button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
