import { Button } from "../primitives/button";
import { cn } from "../lib/cn";

/** Return whether a page control is useful for the current result set. */
export function shouldShowPagination(totalPages: number): boolean {
  return totalPages > 1;
}

/** Render accessible page controls only when more than one page exists. */
export function Pagination({
  className,
  onPageChange,
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (!shouldShowPagination(totalPages)) return null;
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return (
    <nav className={cn("pager", className)} aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
        Previous
      </Button>
      <span aria-live="polite">Page {currentPage} of {totalPages}</span>
      <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
        Next
      </Button>
    </nav>
  );
}
