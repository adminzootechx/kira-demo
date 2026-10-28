import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import SessionProviderWrapper from "@/components/shell/SessionProviderWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

/**
 * One family across the whole product. Plus Jakarta Sans is geometric enough
 * to carry the soft, large-radius surfaces without feeling corporate, keeps
 * double-storey `a` and `g` so it stays legible at the 11–13px UI sizes this
 * dashboard leans on, and ships real tabular figures so money columns align.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Used for exactly one string in the product: the LUSTRE wordmark. A display
 * serif is identity, not interface — the moment it appears on a heading or a
 * figure it stops reading as a mark and starts competing with the data.
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LUSTRE Sales Intelligence — Diamond Trade Command Centre",
  description:
    "Sales analytics and decision support for the diamond trade — every screen worked out from LUSTRE's own sales records.",
};

/**
 * The root layout deliberately holds nothing but the document, the typeface and
 * the two providers that outlive a single screen.
 *
 * The dashboard chrome — sidebar, topbar, content column — lives one level
 * down in `app/(app)/layout.tsx`, because the signed-out surfaces in
 * `app/(auth)` must not render inside it: a sidebar full of links you cannot
 * follow yet is not a frame for a sign-in form. Route groups do not appear in
 * the URL, so every existing route is unchanged by that split.
 *
 * Keeping the providers *here* rather than in each group is what makes signing
 * in feel continuous: `SessionProviderWrapper` holds the Auth.js session, and
 * because this layout is shared by both groups, the session survives the
 * client-side navigation from `/login` into the product instead of being torn
 * down and rebuilt at the boundary.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <SessionProviderWrapper>
          <ToastProvider>{children}</ToastProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
