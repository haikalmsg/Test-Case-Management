"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";
export function createClient() {
  const { url, key } = publicEnv();
  return createBrowserClient<Database>(url, key);
}
