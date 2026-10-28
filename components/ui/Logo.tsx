/**
 * The LUSTRE wordmark, set in the wordmark serif. `h` is the cap height in px —
 * `md` sits in the header, `lg` on sign-in.
 */
const heights = { sm: 18, md: 24, lg: 38 } as const;

export default function Logo({
  size = "md",
  descriptor = false,
  className = "",
}: {
  size?: keyof typeof heights;
  /** Adds the "Sales Intelligence" line beneath. Not part of the mark. */
  descriptor?: boolean;
  className?: string;
}) {
  const h = heights[size];

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <span
        className="font-semibold uppercase leading-none"
        style={{
          fontFamily: "var(--font-wordmark)",
          fontSize: `${Math.round(h * 1.38)}px`,
          letterSpacing: "0.08em",
          color: "var(--color-brand)",
        }}
      >
        Lustre
      </span>
      {descriptor && (
        <span
          className="mt-2 font-bold uppercase leading-none text-muted-foreground"
          style={{ fontSize: `${Math.min(11, Math.max(8, h * 0.34))}px`, letterSpacing: "0.2em" }}
        >
          Sales Intelligence
        </span>
      )}
    </span>
  );
}
