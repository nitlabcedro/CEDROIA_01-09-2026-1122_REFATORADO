export type IdIdentidadeIA = "chatgpt" | "gemini" | "copilot" | "claude" | "grok" | "generica";

export interface IdentidadeIA {
  id: IdIdentidadeIA;
  nome: string;
  asset: string;
}

export const ASSET_IA_GENERICA = "/ias/ia-generica.svg";

const IDENTIDADES: Record<Exclude<IdIdentidadeIA, "generica">, IdentidadeIA> = {
  chatgpt: {
    id: "chatgpt",
    nome: "ChatGPT",
    asset: "/ias/chatgpt.svg",
  },
  gemini: {
    id: "gemini",
    nome: "Google Gemini",
    asset: "/ias/google-gemini.svg",
  },
  copilot: {
    id: "copilot",
    nome: "Microsoft Copilot",
    asset: "/ias/microsoft-copilot.svg",
  },
  claude: {
    id: "claude",
    nome: "Claude",
    asset: "/ias/claude.svg",
  },
  grok: {
    id: "grok",
    nome: "Grok",
    asset: "/ias/grok.svg",
  },
};

const ALIASES: Readonly<Record<string, Exclude<IdIdentidadeIA, "generica">>> = {
  "chatgpt": "chatgpt",
  "chat gpt": "chatgpt",
  "gpt": "chatgpt",
  "google gemini": "gemini",
  "gemini": "gemini",
  "microsoft copilot": "copilot",
  "copilot": "copilot",
  "claude": "claude",
  "anthropic claude": "claude",
  "grok": "grok",
  "xai grok": "grok",
};

export function normalizarNomeIA(nome: string): string {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function obterIdentidadeGenerica(nome: string): IdentidadeIA {
  return {
    id: "generica",
    nome: nome.trim() || "Inteligência artificial",
    asset: ASSET_IA_GENERICA,
  };
}

export function obterIdentidadeIA(
  nome: string,
  opcoes: { personalizada?: boolean } = {},
): IdentidadeIA {
  if (opcoes.personalizada) {
    return obterIdentidadeGenerica(nome);
  }

  const nomeNormalizado = normalizarNomeIA(nome);

  if (nomeNormalizado === "outro") {
    return obterIdentidadeGenerica(nome);
  }

  const identidade = ALIASES[nomeNormalizado];
  return identidade ? IDENTIDADES[identidade] : obterIdentidadeGenerica(nome);
}
