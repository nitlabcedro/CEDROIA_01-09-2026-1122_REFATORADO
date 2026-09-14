import { createClient } from "@supabase/supabase-js";
import { inicializarRecuperacaoSenhaDaUrl } from "@/utilitarios/recuperacao-senha";

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (typeof window !== "undefined") {
  inicializarRecuperacaoSenhaDaUrl(window.location.href, window.localStorage);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
