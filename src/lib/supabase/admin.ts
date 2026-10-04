import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "Server invitation configuration is missing. Set SUPABASE_SERVICE_ROLE_KEY.",
    );
  return createClient<Database>(publicEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
