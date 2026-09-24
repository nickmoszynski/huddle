/**
 * Shared username rules — imported by both the client (instant inline
 * validation, before even hitting the availability-check API) and the two
 * server routes that touch `users.username` (api/auth/username-available,
 * api/auth/claim), so the three places can't drift out of sync.
 */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < 3) return "At least 3 characters.";
  if (u.length > 20) return "20 characters max.";
  if (!USERNAME_PATTERN.test(u)) return "Only lowercase letters, numbers, and underscores.";
  return null;
}
