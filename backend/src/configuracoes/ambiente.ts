import dotenv from "dotenv";

dotenv.config();

function exigirVariavel(nome: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`[AMBIENTE] Variável obrigatória ausente: ${nome}`);
  }

  return valor;
}

export const ambiente = {
  get supabaseUrl(): string {
    return exigirVariavel("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string {
    return exigirVariavel("SUPABASE_SERVICE_ROLE_KEY");
  },
};

export function validarAmbiente(): void {
  void ambiente.supabaseUrl;
  void ambiente.supabaseServiceRoleKey;
}
