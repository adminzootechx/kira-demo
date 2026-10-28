export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureFresh } = await import("@/lib/tradeapi/autoSync");
  void ensureFresh();
}
