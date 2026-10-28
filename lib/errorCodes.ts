/**
 * The stable, documented set of error codes shown to users and looked up on
 * the Help page — grounded in the app's actual failure paths (grepped from
 * every route handler and the Trade Data API client), not invented ahead of
 * a real case. A code's text can be reworded freely; the code itself, once
 * shipped, should not change or be reused for a different meaning.
 */
export type ErrorCode = {
  code: string;
  title: string;
  description: string;
  resolution: string;
};

export const errorCodes: ErrorCode[] = [
  {
    code: "LUSTRE-AUTH-1",
    title: "Not signed in",
    description: "The page needs a signed-in session, and none was found — usually because the session expired.",
    resolution: "Sign in again. If this keeps happening right after signing in, clear cookies for this site and retry.",
  },
  {
    code: "LUSTRE-AUTH-2",
    title: "Not authorized",
    description: "Your account doesn't have permission to view this page or perform this action.",
    resolution: "Ask an administrator to grant the relevant permission from Administration → Users, or switch to an account that already has it.",
  },
  {
    code: "LUSTRE-AUTH-3",
    title: "Too many sign-in attempts",
    description: "This account was temporarily locked after several failed password attempts in a row.",
    resolution: "Wait for the lockout window shown on screen, then try again with the correct password, or use \"Forgot your password?\".",
  },
  {
    code: "LUSTRE-DATA-1",
    title: "Database unavailable",
    description: "The application couldn't reach its database. Pages that depend on live data show an empty state until it is back.",
    resolution: "Usually resolves itself within a minute. If it persists, check the database provider's status page, or contact support with this code.",
  },
  {
    code: "LUSTRE-DATA-2",
    title: "Invalid input",
    description: "A required field was missing, or a value didn't pass validation (for example, an empty name or a badly-formed date).",
    resolution: "Check the highlighted field and re-submit. The message on screen names the specific field.",
  },
  {
    code: "LUSTRE-DATA-3",
    title: "Not found",
    description: "The record being edited or deleted no longer exists — typically because someone else already removed it.",
    resolution: "Refresh the page to see the current list, then retry.",
  },
  {
    code: "LUSTRE-SYNC-1",
    title: "Trade Data API sign-in failed",
    description: "The scheduled or manual sync couldn't authenticate with the Trade Data API. The API password rotates nightly and needs updating.",
    resolution: "Confirm today's API password is current in the server configuration, then retry the sync.",
  },
  {
    code: "LUSTRE-SYNC-2",
    title: "Trade Data API request failed",
    description: "A sync request to the Trade Data API didn't succeed — a timeout, a rate-limit, or an error response from the API itself.",
    resolution: "Retrying usually succeeds, since most of these are transient. If a specific sync keeps failing, check the API's own status or reduce the date range being requested.",
  },
  {
    code: "LUSTRE-IMPORT-1",
    title: "Import failed",
    description: "A CSV/XLSX file or API sync couldn't be processed — the file had no usable rows, or the data couldn't be written to the database.",
    resolution: "Check the file matches the expected export format, or retry the sync. The specific reason is shown on screen.",
  },
  {
    code: "LUSTRE-APP-1",
    title: "Unexpected application error",
    description: "A page or the whole application failed to render because of an unhandled error. Your data was not changed by this.",
    resolution: "Try again — most render errors are transient. If it repeats, note the reference shown on screen and contact support.",
  },
  {
    code: "LUSTRE-APP-2",
    title: "Page not found",
    description: "The address doesn't match any page in the platform — often an old bookmark or a mistyped link.",
    resolution: "Use the navigation to get back to a known page. If you followed a link from inside LUSTRE to get here, let support know which one.",
  },
];

export function findErrorCode(code: string): ErrorCode | undefined {
  return errorCodes.find((e) => e.code.toLowerCase() === code.toLowerCase());
}

/**
 * Every failure path that has a stable code should log through this instead
 * of a bare `console.error`, so the code is greppable in the platform's logs
 * (Vercel's own log viewer, since no separate logging service exists) —
 * that's what makes a failure diagnosable after the fact rather than only
 * while someone is watching it happen live.
 */
export function logError(code: string, context: string, error?: unknown): void {
  console.error(`[${code}] ${context}`, error ?? "");
}
