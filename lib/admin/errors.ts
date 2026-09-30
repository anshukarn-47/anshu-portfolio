import "server-only";

/**
 * Admin-facing error text: the site's own message plus the database error code
 * (e.g. "23505"), which is enough to look the problem up. The provider's raw
 * message never reaches the browser; it goes to the server log instead.
 */
export function adminError(context: string, error: { code?: string } | null | undefined, text: string): string {
  if (error) console.error(`[admin] ${context}`, error);
  return error?.code ? `${text} (error ${error.code})` : text;
}
