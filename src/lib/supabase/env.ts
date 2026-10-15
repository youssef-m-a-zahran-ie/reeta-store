export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const MEDIA_BUCKET = "media";

/** Public URL of a file in the media bucket. Paths starting with "/" are the site's own files, and full URLs, and pass through. */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("/") || /^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
