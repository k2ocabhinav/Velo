import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, label, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <label className="ui-field">
      {label ? (
        <span className="ui-field-label">
          {label}
        </span>
      ) : null}
      <input
        ref={ref}
        {...props}
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={cn(
          "ui-control",
          className
        )}
      />
      {hint ? <span id={hintId} className="ui-field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="ui-field-error">{error}</span> : null}
    </label>
  );
});
