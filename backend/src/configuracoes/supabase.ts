import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ambiente } from "./ambiente";

let clienteSupabase: SupabaseClient | null = null;

export function obterClienteSupabase(): SupabaseClient {
  if (!clienteSupabase) {
    // A Service Role permanece restrita ao processo de backend.
    clienteSupabase = createClient(
      ambiente.supabaseUrl,
      ambiente.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return clienteSupabase;
}
