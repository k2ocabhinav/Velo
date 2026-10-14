import type { Key, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Skeleton as GenericSkeleton } from "../feedback/skeleton";
import { Menu, type MenuItem } from "./interaction";

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
  ariaLabel?: string;
  className?: string;
  rowActions?: (row: T) => MenuItem[];
  rowActionsLabel?: (row: T) => string;
}

/** Responsive data table with optional overflow actions on each row. */
export const DataTable = Object.assign(function DataTable<T>({
  caption,
  className,
  columns,
  data,
  emptyState = "No data yet.",
  getRowKey,
  rowActions,
  rowActionsLabel,
  ariaLabel = "Results",
}: DataTableProps<T>) {
  return (
    <div className={cn("data-table-wrap", className)}>
      <table className="data-table" aria-label={caption ? undefined : ariaLabel}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  column.align === "center" && "align-center",
                  column.align === "right" && "align-right",
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
            {rowActions ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (rowActions ? 1 : 0)}
                className="data-table-empty"
              >
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex)}>
                {columns.map((column, columnIndex) => {
                  const content =
                    column.cell?.(row) ??
                    (column.accessorKey ? String(row[column.accessorKey] ?? "") : null);

                  return (
                    <td
                      key={columnIndex}
                      className={cn(
                        column.align === "center" && "align-center",
                        column.align === "right" && "align-right",
                        column.className
                      )}
                    >
                      {content}
                    </td>
                  );
                })}
                {rowActions ? (
                  <td className="data-table-actions">
                    <Menu
                      items={rowActions(row)}
                      triggerLabel={rowActionsLabel?.(row) ?? "More row actions"}
                    />
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}, { Skeleton: DataTableSkeleton });

function DataTableSkeleton({ rows = 5, columns = 4, label = "Loading results" }: { rows?: number; columns?: number; label?: string }) {
  return (
    <div className="data-table-wrap data-table-skeleton" role="status" aria-label={label} aria-busy="true">
      <table aria-hidden="true">
        <thead><tr>{Array.from({ length: columns }, (_, index) => <th key={index}><GenericSkeleton className="data-table-skeleton-cell" /></th>)}</tr></thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>{Array.from({ length: columns }, (_, column) => <td key={column}><GenericSkeleton className="data-table-skeleton-cell" /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
