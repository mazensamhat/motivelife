/** Map Prisma / database errors to short, actionable login messages. */
export function databaseErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const msg = error.message;
  if (msg.includes("AUTH_SECRET")) {
    return "Server auth is not configured. Set AUTH_SECRET in Vercel (Production).";
  }
  if (msg.includes("DATABASE_URL") || msg.includes("[forward/database]")) {
    return "Database is not configured. Set DATABASE_URL in Vercel (Production).";
  }
  if (msg.includes("P1001") || msg.includes("Can't reach database server")) {
    return "Cannot reach the database. Check that Supabase is active and DATABASE_URL on Vercel is correct.";
  }
  if (msg.includes("P1000") || msg.includes("Authentication failed")) {
    return "Database password is wrong. Copy a fresh connection string from Supabase into Vercel.";
  }
  if (msg.includes("P2021") || msg.includes("P2022") || msg.includes("does not exist")) {
    return "Database is updating — wait a minute and try signing in again. If it keeps failing, contact support.";
  }
  if (msg.includes("max_client_conn") || msg.includes("too many connections")) {
    return "Database connection limit reached. Wait a minute and try again.";
  }
  if (msg.includes("is not a function") || msg.includes("Cannot read properties of undefined")) {
    return "App build is out of date — hard-refresh or reopen the app, then try again.";
  }

  return fallback;
}
