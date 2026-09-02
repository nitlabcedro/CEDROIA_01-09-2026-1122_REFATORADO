import { createClient } from "@supabase/supabase-js";

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
