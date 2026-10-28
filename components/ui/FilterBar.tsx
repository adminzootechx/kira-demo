"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Search, X } from "lucide-react";

/**
 * Search, faceted filtering and sorting for lists that are not tables.
 *
 * The exception queue and the priority list are card layouts — each row
 * carries a headline, an explanation and an action — so pushing them into a
 * grid would cost more than the filtering gains. This gives them the same
 * controls without changing how they read.
 */

export type ListFacet<T> = {
  label: string;
  get: (row: T) => string;
  /** Fixed order where the values have a natural one, e.g. High/Medium/Low. */
  order?: string[];
};

export type ListSort<T> = {
  key: string;
  label: string;
  value: (row: T) => number | string;
};

export type FilterConfig<T> = {
  searchIn: (row: T) => string;
  facets?: ListFacet<T>[];
  sorts?: ListSort<T>[];
  initialSort?: string;
  placeholder?: string;
};

export function useListFilter<T>(rows: T[], config: FilterConfig<T>) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState(config.initialSort ?? config.sorts?.[0]?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const facets = useMemo(() => config.facets ?? [], [config.facets]);
  const sorts = useMemo(() => config.sorts ?? [], [config.sorts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;

    for (const facet of facets) {
      const value = values[facet.label];
      if (value && value !== "All") out = out.filter((r) => facet.get(r) === value);
    }
    if (q) out = out.filter((r) => config.searchIn(r).toLowerCase().includes(q));

    const sort = sorts.find((s) => s.key === sortKey);
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = sort.value(a);
        const bv = sort.value(b);
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return direction === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, facets, sorts, values, query, sortKey, direction, config]);

  const options = useMemo(
    () =>
      facets.map((facet) => {
        const distinct = Array.from(new Set(rows.map(facet.get))).filter(Boolean);
        const sorted = facet.order
          ? distinct.sort((a, b) => facet.order!.indexOf(a) - facet.order!.indexOf(b))
          : distinct.sort();
        return { label: facet.label, values: sorted };
      }),
    [facets, rows],
  );

  return {
    rows: filtered,
    bind: {
      query,
      setQuery,
      values,
      setValues,
      options,
      sorts,
      sortKey,
      setSortKey,
      direction,
      setDirection,
      total: rows.length,
      shown: filtered.length,
      placeholder: config.placeholder ?? "Search…",
    },
  };
}

export type FilterBind = ReturnType<typeof useListFilter<never>>["bind"];

export function FilterBar(bind: FilterBind) {
  const {
    query, setQuery, values, setValues, options, sorts, sortKey, setSortKey,
    direction, setDirection, total, shown, placeholder,
  } = bind;

  const active = Object.values(values).filter((v) => v && v !== "All").length + (query.trim() ? 1 : 0);
  const control =
    "h-9 cursor-pointer rounded-[10px] border border-border bg-card px-2.5 pr-7 text-[13px] text-navy outline-none transition-colors hover:border-[#d8dfeb] focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
      <div className="relative min-w-[220px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-[10px] border border-border bg-card pl-9 pr-3 text-[13.5px] text-navy outline-none transition-colors placeholder:text-muted-foreground hover:border-[#d8dfeb] focus:border-accent"
        />
      </div>

      {options.map((facet) => (
        <label key={facet.label}>
          <span className="sr-only">{facet.label}</span>
          <select
            value={values[facet.label] ?? "All"}
            onChange={(e) => setValues((v) => ({ ...v, [facet.label]: e.target.value }))}
            className={control}
          >
            <option value="All">{facet.label}</option>
            {facet.values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ))}

      {sorts.length > 0 && (
        <div className="flex items-center gap-1.5">
          <label>
            <span className="sr-only">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className={control}
            >
              {sorts.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
            aria-label={direction === "asc" ? "Sort descending" : "Sort ascending"}
            title={direction === "asc" ? "Ascending" : "Descending"}
            className="icon-btn size-9 border border-border"
          >
            <ArrowDownUp size={14} className={direction === "asc" ? "text-accent" : ""} />
          </button>
        </div>
      )}

      {active > 0 && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setValues({});
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-dark transition-colors hover:text-navy"
        >
          <X size={13} />
          Clear
        </button>
      )}

      <span className="ml-auto whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">
        {shown.toLocaleString()}
        {shown !== total && ` of ${total.toLocaleString()}`} in the list
      </span>
    </div>
  );
}
