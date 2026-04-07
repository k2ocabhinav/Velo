export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean>;

function appendClassValue(target: string[], value: ClassValue): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendClassValue(target, item);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) {
        target.push(key);
      }
    }
    return;
  }

  target.push(String(value));
}

export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];

  for (const value of values) {
    appendClassValue(classes, value);
  }

  return classes.join(" ");
}
