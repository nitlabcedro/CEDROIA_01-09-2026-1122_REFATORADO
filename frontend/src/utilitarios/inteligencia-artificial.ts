export type MarcaIA = "chatgpt" | "gemini" | "copilot" | "claude" | "grok" | "outro";

export function normalizarNomeIA(nome?: string): string {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function identificarMarcaIA(nome?: string): MarcaIA {
  const nomeNormalizado = normalizarNomeIA(nome);

  if (nomeNormalizado.includes("chatgpt") || nomeNormalizado.includes("openai")) return "chatgpt";
  if (nomeNormalizado.includes("gemini")) return "gemini";
  if (nomeNormalizado.includes("copilot")) return "copilot";
  if (nomeNormalizado.includes("claude")) return "claude";
  if (nomeNormalizado.includes("grok")) return "grok";

  return "outro";
}
