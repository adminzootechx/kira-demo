import { Skeleton } from "@/components/ui/feedback";

/**
 * The instant loading state shown while a route segment streams in. Its shape
 * deliberately traces the real page — header, then a KPI band, then two panels
 * — so the layout does not jump when the data arrives.
 *
 * It is announced politely rather than trapping focus: navigation in this
 * product is fast, and a loud "loading" on every click would be noise.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-10">
      <span className="sr-only">Loading page</span>

      {/* Page header ------------------------------------------------- */}
      <div className="space-y-4 border-b border-border pb-6" aria-hidden>
        <Skeleton className="h-2.5 w-52" />
        <Skeleton className="h-7 w-[26rem] max-w-full" />
        <Skeleton className="h-3 w-[34rem] max-w-full" />
      </div>

      {/* Metric band — first thing on screen, so first thing reserved -- */}
      <div className="surface grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x xl:grid-cols-4 xl:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-5 p-6" aria-hidden>
            <Skeleton className="h-2.5 w-24" />
            <div className="mt-auto space-y-2.5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Content panels ---------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="surface p-6 lg:col-span-2" aria-hidden>
          <div className="space-y-2.5 border-b border-border pb-5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-2.5 w-72 max-w-full" />
          </div>
          <Skeleton className="mt-6 h-[232px] w-full" />
        </div>

        <div className="surface p-6" aria-hidden>
          <div className="space-y-2.5 border-b border-border pb-5">
            <Skeleton className="h-3.5 w-36" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-2.5 flex-1" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
