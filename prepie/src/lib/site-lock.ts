// Shared-secret gate for the single-user deployment. No accounts, no
// sessions: one password in SITE_PASSWORD, checked as the password half of
// HTTP Basic credentials (any username is accepted). Unset password = lock
// off, so local dev and mock demos need zero setup. Runs in the Edge
// runtime, hence atob rather than Buffer.
export function isAuthorized(
  authorizationHeader: string | null,
  password: string | undefined,
): boolean {
  if (!password) return true;
  if (!authorizationHeader?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice("Basic ".length));
  } catch {
    return false;
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  return decoded.slice(sep + 1) === password;
}
