import Topbar from "@/components/shell/Topbar";
import ConnectionStatus from "@/components/shell/ConnectionStatus";
import StaleDataNotice from "@/components/shell/StaleDataNotice";

/**
 * The signed-in shell. Everything the product renders behind a session — the
 * header and the scrolling content column — is assembled here rather than in
 * the root layout, so the sign-in surfaces under `app/(auth)` can own a bare
 * viewport without opting out of anything.
 *
 * The group adds no URL segment, so these are still `/`, `/customers`, and so
 * on; the boundary is organisational, not addressable.
 *
 * Structurally there are three planes: the canvas (the gradient sky, fixed to
 * the viewport), the header floating directly on it, and the sheet — the
 * near-white surface the product sits on.
 *
 * The sheet is inset on every side rather than only lifted at the top, so the
 * canvas reads as something the product rests on instead of a strip above it.
 * The inset is deliberately small and shrinks with the viewport: with no
 * navigation rail the dense tables want the width, and on a phone the gradient
 * is worth less than the columns it would cost.
 *
 * The inset lives on `main` rather than on the sheet, so the scroll container
 * owns the gutter and the sheet stays a plain block. `scrollbar-gutter` is
 * doing two jobs: `stable` keeps the gutter identical on pages that scroll and
 * pages that do not, so the sheet never jumps sideways as you move between
 * them; `both-edges` keeps the scroll container symmetric about the viewport
 * centre, which is what lets the header — which has no scrollbar of its own —
 * centre its content column on exactly the same axis as the sheet does.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <div className="canvas flex h-screen flex-col overflow-hidden">
        <Topbar />
        {/* Sits under the header so a stale-data warning is impossible to
            read past on the way to the figures below it. */}
        <ConnectionStatus />
        <StaleDataNotice />
        {/* The page scrolls vertically only. Anything that genuinely needs
            sideways movement — a wide table, the section rail — carries its
            own `overflow-x-auto`, so a horizontal scrollbar on the page
            itself is always a layout fault, and dragging it only ever
            revealed empty background beside the content.

            `overflow-x: clip` is safe for the sticky elements inside: the
            section rail and the account save bar were both measured pinning
            correctly with and without it. It does mean an overflow is cut
            rather than scrolled to, so it hides the fault instead of
            announcing it — fix overflow at the source, and check with a
            browser rather than by comparing scrollWidth, which clip
            clamps. */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-clip overscroll-contain scroll-smooth px-2 pb-2 pt-4 [scrollbar-gutter:stable_both-edges] sm:px-3 sm:pb-3 sm:pt-5 lg:px-5 lg:pb-5 lg:pt-6 2xl:px-6 2xl:pb-6"
        >
          {/* `min-h-full` keeps the sheet filling the viewport on short pages,
              so a sparse screen never shows gradient below the content. Full
              height rather than a calc, because the band of canvas above the
              sheet is now `main`'s own padding. */}
          <div className="sheet relative min-h-full">
            {/* `relative` is load-bearing, not cosmetic. Tailwind's `sr-only`
                is `position: absolute`, so with no positioned ancestor every
                screen-reader label in the page resolved against the document
                instead of against this scroller. Each one sitting 3000px down
                the Command Centre stretched the document to match, which is
                why reaching the bottom of the dashboard started scrolling the
                whole shell up and off screen with empty background beneath it.
                Giving the content a containing block keeps those labels inside
                the scroller. `overscroll-contain` above is the second line of
                defence: it stops this scroller handing a scroll on to any
                ancestor. */}
            <div className="relative mx-auto min-w-0 max-w-[1600px] space-y-10 px-5 py-8 sm:px-6 lg:px-10 lg:py-10">
              {children}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
