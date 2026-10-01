export function getSupabaseConfig() {
  // Direct property reads are required for Next's public browser env inlining.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return url && publishableKey ? { url, publishableKey } : null;
}
