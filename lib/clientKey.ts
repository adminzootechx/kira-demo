/** Stable key for a client across imports. The book's own `id` ends in a
 *  position number that changes every import, so assignments use the name. */
export const clientKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown";
