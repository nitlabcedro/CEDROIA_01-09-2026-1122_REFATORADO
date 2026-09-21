import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizarNomeIA, obterIdentidadeIA } from "./identidade-ia";

describe("identidade visual das IAs", () => {
  it("resolve cada IA oficial para seu asset", () => {
    const casos = [
      ["ChatGPT", "chatgpt", "/ias/chatgpt.svg"],
      ["Google Gemini", "gemini", "/ias/google-gemini.svg"],
      ["Microsoft Copilot", "copilot", "/ias/microsoft-copilot.svg"],
      ["Claude", "claude", "/ias/claude.svg"],
      ["Grok", "grok", "/ias/grok.svg"],
      ["Outro", "generica", "/ias/ia-generica.svg"],
    ] as const;

    for (const [nome, id, asset] of casos) {
      const identidade = obterIdentidadeIA(nome);
      assert.equal(identidade.id, id);
      assert.equal(identidade.asset, asset);
    }
  });

  it("aceita apenas aliases simples conhecidos", () => {
    const aliases = [
      ["Chat GPT", "/ias/chatgpt.svg"],
      ["GPT", "/ias/chatgpt.svg"],
      ["Gemini", "/ias/google-gemini.svg"],
      ["Copilot", "/ias/microsoft-copilot.svg"],
      ["Anthropic Claude", "/ias/claude.svg"],
      ["xAI Grok", "/ias/grok.svg"],
    ] as const;

    for (const [nome, asset] of aliases) {
      assert.equal(obterIdentidadeIA(nome).asset, asset);
    }

    assert.equal(obterIdentidadeIA("  GOOGLE   gemini  ").id, "gemini");
    assert.equal(normalizarNomeIA("  Google   Gemini "), "google gemini");
  });

  it("usa o asset institucional para nomes desconhecidos sem fuzzy matching", () => {
    for (const nome of ["IA interna Cedro", "Perplexity", "ChatGPT Plus", "Midjourney", "OpenAI"]) {
      const identidade = obterIdentidadeIA(nome);
      assert.equal(identidade.id, "generica");
      assert.equal(identidade.asset, "/ias/ia-generica.svg");
    }
  });

  it("força o fallback quando a origem Outro é conhecida", () => {
    assert.equal(
      obterIdentidadeIA("ChatGPT", { personalizada: true }).asset,
      "/ias/ia-generica.svg",
    );
  });
});
