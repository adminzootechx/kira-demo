/** Words that only say what legal form a company has, so "Iconic Jewels LLC"
 *  and "Iconic Jewels" count as the same company. */
const LEGAL = new Set([
  "llc", "ltd", "limited", "inc", "incorporated", "pvt", "private", "co", "company", "corp", "corporation",
  "llp", "sa", "nv", "bv", "gmbh", "fze", "fzc", "fzco", "dmcc", "pte", "plc", "lp",
]);

/** Stable identity for a company name, used to stop one company belonging to two salespeople. */
export function companyKey(name: string): string {
  const words = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (words.length > 1 && LEGAL.has(words[words.length - 1])) words.pop();
  return words.join("-").slice(0, 120);
}

/** Salesperson names in the data carry stray whitespace and case differences. */
export const sameRep = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === (b ?? "").trim().replace(/\s+/g, " ").toLowerCase();
