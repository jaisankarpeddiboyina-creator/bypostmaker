/**
 * Avatar URL Resolver Utility
 *
 * Maps a stored user avatar_url string to a valid client-fetchable image URL.
 * - If no avatar is set, returns null (caller falls back to initials/default avatar).
 * - If the URL is an absolute HTTP/HTTPS URL (e.g. Google OAuth photo), returns it as-is.
 * - If the URL is an internal R2 storage key (e.g. `uploads/usr_.../photo.jpg`), routes
 *   through the authenticated `/api/user/avatar` endpoint with an optional cache-busting
 *   query parameter derived from the user's `updated_at` timestamp.
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  updatedAt?: number | string | null
): string | null {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }
  return updatedAt ? `/api/user/avatar?v=${updatedAt}` : '/api/user/avatar'
}
