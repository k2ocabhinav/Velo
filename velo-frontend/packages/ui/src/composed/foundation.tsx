"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { formatDateTime, formatMoney } from "@velo/app-core/formatters";
import { useTenantBrandingOrDefault } from "../theme/tenant-branding-provider";
import { cn } from "../lib/cn";
import { Skeleton as GenericSkeleton } from "../feedback/skeleton";

/** A page title, purpose line, and optional primary action area. */
export function PageHeader({
  actions,
  className,
  description,
  title,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("page-header", className)}>
      <div className="stack compact">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </header>
  );
}

/** A titled content section with optional actions. */
export const Section = Object.assign(function Section({
  actions,
  children,
  className,
  title,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section className={cn("section", className)} aria-labelledby={title ? titleId : undefined}>
      {title || actions ? (
        <div className="section-header split-row">
          {title ? <h2 className="section-title" id={titleId}>{title}</h2> : <span />}
          {actions ? <div className="row-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="section-body">{children}</div>
    </section>
  );
}, { Skeleton: SectionSkeleton });

function SectionSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <section className={cn("section section-skeleton", className)} role="status" aria-label="Loading section" aria-busy="true">
      <div className="section-header"><GenericSkeleton className="section-skeleton-title" /></div>
      <div className="section-body stack compact">
        {Array.from({ length: rows }, (_, index) => <GenericSkeleton className="section-skeleton-row" key={index} />)}
      </div>
    </section>
  );
}

type DescribedControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Label and helper text wrapper that wires description and validation to its control. */
export function Field({
  children,
  className,
  error,
  hint,
  id,
  label,
}: {
  label: string;
  children: ReactNode;
  id?: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const generatedId = useId();
  const childId = isValidElement(children)
    ? (children.props as DescribedControlProps).id
    : undefined;
  const controlId = id ?? childId ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const wireControl = (child: ReactNode): ReactNode => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<DescribedControlProps>;
    const describedBy = [element.props["aria-describedby"], hintId, errorId]
      .filter(Boolean)
      .join(" ") || undefined;
    const controlProps: Partial<DescribedControlProps> = {
      id: element.props.id ?? controlId,
      className: cn(element.props.className, "ui-control"),
    };
    if (describedBy) controlProps["aria-describedby"] = describedBy;
    if (error) controlProps["aria-invalid"] = true;
    else if (element.props["aria-invalid"] !== undefined) {
      controlProps["aria-invalid"] = element.props["aria-invalid"];
    }
    return cloneElement(element, controlProps);
  };

  return (
    <div className={cn("ui-field", className)}>
      <label className="ui-field-label" htmlFor={controlId}>{label}</label>
      {wireControl(children)}
      {hint ? <p id={hintId} className="ui-field-hint">{hint}</p> : null}
      {error ? <p id={errorId} className="ui-field-error">{error}</p> : null}
    </div>
  );
}

/** Native select styled for light and dark themes. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("ui-control", className)} />;
}

/** Multiline text control styled for light and dark themes. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("ui-control", className)} />;
}

export interface SegmentedOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

/** Single-select filter or tab group with arrow-key navigation. */
export function SegmentedControl({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledOptions = options.filter((option) => !option.disabled);

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, currentValue: string): void {
    const key = event.key;
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const currentIndex = enabledOptions.findIndex((option) => option.value === currentValue);
    const nextIndex = key === "Home"
      ? 0
      : key === "End"
        ? enabledOptions.length - 1
        : (currentIndex + (key === "ArrowRight" || key === "ArrowDown" ? 1 : -1) + enabledOptions.length) % enabledOptions.length;
    const next = enabledOptions[nextIndex];
    if (next) {
      onValueChange(next.value);
      buttons.current[options.findIndex((option) => option.value === next.value)]?.focus();
    }
  }

  return (
    <div className={cn("segmented-control", className)} role="radiogroup" aria-label={ariaLabel} aria-orientation="horizontal">
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => { buttons.current[index] = node; }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
          disabled={option.disabled}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, option.value)}
        >
          <span>{option.label}</span>
          {option.count !== undefined ? <span className="segmented-count" aria-hidden="true">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export interface DefinitionItem {
  label: ReactNode;
  value: ReactNode;
}

/** Label and value rows for readable detail panels. */
export function DefinitionList({
  className,
  items,
}: {
  items: DefinitionItem[];
  className?: string;
}) {
  return (
    <dl className={cn("definition-list", className)}>
      {items.map((item, index) => (
        <div className="definition-list-row" key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Format and display a money amount using the app-core formatter. */
export function Money({
  amount,
  className,
  currency,
  emphasis = false,
  locale,
}: {
  amount: number | string | null | undefined;
  currency?: string;
  locale?: string;
  emphasis?: boolean;
  className?: string;
}) {
  const tenantBranding = useTenantBrandingOrDefault();
  return (
    <data className={cn("money", className)} data-emphasis={emphasis || undefined} value={amount ?? ""}>
      {formatMoney(amount, currency ?? tenantBranding.currency, locale)}
    </data>
  );
}

/** Format and display a date using the app-core relative and absolute formats. */
export function DateTime({
  className,
  locale,
  now,
  timeZone,
  value,
}: {
  value: Date | string | number | null | undefined;
  now?: Date;
  locale?: string;
  timeZone?: string;
  className?: string;
}) {
  const text = formatDateTime(value, now, locale, timeZone);
  const date = value instanceof Date ? value : value === null || value === undefined ? undefined : new Date(value);
  return (
    <time className={className} dateTime={date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined}>
      {text}
    </time>
  );
}

/** Explain an empty view and offer its next useful action. */
export function EmptyState({
  action,
  className,
  description,
  title,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("empty-state", className)}>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="row-actions">{action}</div> : null}
    </div>
  );
}

/** Describe a failed task and provide a nearby retry action. */
export function ErrorState({
  className,
  description,
  onRetry,
  retryLabel = "Retry",
  title,
}: {
  title: string;
  description?: string;
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("error-state", className)} role="alert">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      <button type="button" className="secondary-button" onClick={onRetry}>{retryLabel}</button>
    </div>
  );
}

