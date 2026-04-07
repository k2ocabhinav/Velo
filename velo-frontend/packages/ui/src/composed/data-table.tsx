import type { Key, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface DataTableColumn<T> {
  header: ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  data: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T, index: number) => Key;
  emptyState?: ReactNode;
  caption?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  caption,
  className,
  columns,
  data,
  emptyState = "No data yet.",
  getRowKey
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))]", className)}>
      <table className="w-full border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-[hsl(var(--color-surface-hover))]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  "border-b border-[hsl(var(--color-border))] px-4 py-3 font-medium text-[hsl(var(--color-muted))]",
                  column.align === "center" && "text-center",
                  column.align === "right" && "text-right",
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-[hsl(var(--color-muted))]"
              >
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex)} className="hover:bg-[hsl(var(--color-surface-hover))]">
                {columns.map((column, columnIndex) => {
                  const content =
                    column.cell?.(row) ??
                    (column.accessorKey ? String(row[column.accessorKey] ?? "") : null);

                  return (
                    <td
                      key={columnIndex}
                      className={cn(
                        "border-b border-[hsl(var(--color-border))] px-4 py-3 text-[hsl(var(--color-foreground))]",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        column.className
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
