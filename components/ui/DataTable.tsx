"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Table, Td, Th } from "./primitives";

/**
 * One table behaviour for every list in the product: search, faceted filters,
 * sortable column headers, pagination and row navigation.
 *
 * Pagination matters more than it looks — the customer book is several hundred
 * rows, and rendering all of them puts thousands of nodes in the DOM and makes
 * every keystroke in the search box feel slow.
 */

export type Column<T> = {
  key: string;
  header: string;
  /** How the cell renders. */
  cell: (row: T) => React.ReactNode;
  /** Return a comparable value to make the column sortable. */
  sortValue?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  /** Hide below the given breakpoint to keep narrow screens readable. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

export type Facet<T> = {
  label: string;
  /** Distinct values, derived from the rows themselves. */
  options: (rows: T[]) => string[];
  matches: (row: T, value: string) => boolean;
};

const hideClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

export default function DataTable<T>({
  rows,
  columns,
  getKey,
  searchIn,
  facets = [],
  initialSort,
  rowHref,
  pageSize = 25,
  searchPlaceholder = "Search…",
  emptyMessage = "Nothing matches these filters.",
  minWidth = 900,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  /** Text built per row that the search box matches against. */
  searchIn: (row: T) => string;
  facets?: Facet<T>[];
  initialSort?: { key: string; direction?: "asc" | "desc" };
  /** Makes the whole row navigate. */
  rowHref?: (row: T) => string;
  pageSize?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  minWidth?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState(initialSort?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">(initialSort?.direction ?? "desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;

    for (const facet of facets) {
      const value = facetValues[facet.label];
      if (value && value !== "All") out = out.filter((r) => facet.matches(r, value));
    }
    if (q) out = out.filter((r) => searchIn(r).toLowerCase().includes(q));

    const column = columns.find((c) => c.key === sortKey && c.sortValue);
    if (column?.sortValue) {
      const sortValue = column.sortValue;
      out = [...out].sort((a, b) => {
        const av = sortValue(a);
        const bv = sortValue(b);
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        // Tie-break on the stable key so ordering never depends on sort stability.
        return (direction === "asc" ? cmp : -cmp) || getKey(a).localeCompare(getKey(b));
      });
    }
    return out;
  }, [rows, columns, facets, facetValues, query, searchIn, sortKey, direction, getKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    if (sortKey === key) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  };

  const activeFilters =
    Object.values(facetValues).filter((v) => v && v !== "All").length + (query.trim() ? 1 : 0);

  return (
    <>
      {/* Controls -------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-[10px] border border-border bg-card pl-9 pr-3 text-[13.5px] text-navy outline-none transition-colors placeholder:text-muted-foreground hover:border-[#d8dfeb] focus:border-accent"
          />
        </div>

        {facets.map((facet) => {
          const options = ["All", ...facet.options(rows)];
          return (
            <label key={facet.label} className="flex items-center gap-2">
              <span className="sr-only">{facet.label}</span>
              <select
                value={facetValues[facet.label] ?? "All"}
                onChange={(e) => {
                  setFacetValues((f) => ({ ...f, [facet.label]: e.target.value }));
                  setPage(0);
                }}
                className="h-9 cursor-pointer rounded-[10px] border border-border bg-card px-2.5 pr-7 text-[13px] text-navy outline-none transition-colors hover:border-[#d8dfeb] focus:border-accent"
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o === "All" ? facet.label : o}
                  </option>
                ))}
              </select>
            </label>
          );
        })}

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFacetValues({});
              setPage(0);
            }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-dark transition-colors hover:text-navy"
          >
            <X size={13} />
            Clear
          </button>
        )}

        <span className="ml-auto whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">
          {filtered.length.toLocaleString()}
          {filtered.length !== rows.length && ` of ${rows.length.toLocaleString()}`} rows
        </span>
      </div>

      {/* Rows ------------------------------------------------------ */}
      <Table minWidth={minWidth}>
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = Boolean(col.sortValue);
              const active = sortKey === col.key;
              const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
              return (
                <Th
                  key={col.key}
                  align={col.align}
                  ariaSort={
                    sortable
                      ? active
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={col.hideBelow ? hideClass[col.hideBelow] : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1.5 transition-colors hover:text-navy ${
                        active ? "text-navy" : ""
                      } ${col.align === "right" ? "flex-row-reverse" : ""}`}
                    >
                      {col.header}
                      <Icon size={12} className={active ? "text-accent" : "opacity-40"} aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={getKey(row)}
                onClick={
                  href
                    ? (e) => {
                        if ((e.target as HTMLElement).closest("a")) return;
                        router.push(href);
                      }
                    : undefined
                }
                onKeyDown={
                  href
                    ? (e) => {
                        if (e.key === "Enter") router.push(href);
                      }
                    : undefined
                }
                tabIndex={href ? 0 : undefined}
                role={href ? "link" : undefined}
                className={`transition-colors ${
                  href ? "cursor-pointer hover:bg-secondary/50 focus-visible:bg-secondary/50" : ""
                }`}
              >
                {columns.map((col) => (
                  <Td
                    key={col.key}
                    align={col.align}
                    className={`${col.hideBelow ? hideClass[col.hideBelow] : ""} ${col.className ?? ""}`}
                  >
                    {col.cell(row)}
                  </Td>
                ))}
              </tr>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <Td colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                {emptyMessage}
              </Td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Pagination ------------------------------------------------ */}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <p className="text-[12.5px] tabular-nums text-muted-foreground">
            Showing {current * pageSize + 1}–{Math.min((current + 1) * pageSize, filtered.length)} of{" "}
            {filtered.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="btn btn-secondary h-8 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 text-[12.5px] tabular-nums text-muted-foreground">
              {current + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="btn btn-secondary h-8 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
