export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Follow the README and configure .env.local.",
    );
  return { url, key };
}
export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url)
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for authentication emails.",
    );
  return new URL(url).origin;
}
