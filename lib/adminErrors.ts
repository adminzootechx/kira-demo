import { logError } from "./errorCodes";

/**
 * Every deliberate rejection in the admin API throws this, never a bare
 * `Error`. Route handlers check `instanceof AdminError` before returning
 * `error.message` to the client — anything else (a raw Postgres exception,
 * which carries the failing SQL and parameters in its message) is logged
 * server-side and replaced with a generic message, so a client never sees
 * more than an admin deliberately chose to tell it.
 */
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "AdminError";
  }
}

/** Postgres error codes this file's callers actually hit. */
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Maps a Postgres driver error to a clean AdminError when it's one of the
 * shapes admin-panel routes can trigger (a duplicate name, a reference to a
 * row that no longer exists); rethrows anything else unchanged so it hits
 * the route's generic fallback instead of leaking to the client.
 */
export function mapDbError(error: unknown, context: { duplicate?: string; missingRef?: string }): never {
  const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
  if (code === UNIQUE_VIOLATION && context.duplicate) {
    throw new AdminError(context.duplicate, 409);
  }
  if (code === FOREIGN_KEY_VIOLATION && context.missingRef) {
    throw new AdminError(context.missingRef, 400);
  }
  throw error;
}

/**
 * Every /api/admin/* route's catch block should call this and return its
 * result, never `error.message` directly — an AdminError's message was
 * written for a client to read, but anything else (a raw driver exception,
 * a programming mistake) carries details — SQL, parameters, stack frames —
 * that must never leave the server. Unexpected errors are logged here, with
 * `context` naming the route, so the failure is still diagnosable.
 */
export function adminErrorResponse(error: unknown, context: string): { body: { error: string }; status: number } {
  if (error instanceof AdminError) {
    return { body: { error: error.message }, status: error.status };
  }
  logError("LUSTRE-APP-1", context, error);
  return { body: { error: "Something went wrong. Try again. (LUSTRE-APP-1)" }, status: 500 };
}
