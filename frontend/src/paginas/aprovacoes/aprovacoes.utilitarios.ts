import type { IARecord } from "@/tipos";
import { obterUltimoParecerLimpo } from "@/utilitarios/pareceres";

export interface CriterioParecer {
  label: string;
  value: string;
}

export interface ParecerInterpretado {
  criteria: CriterioParecer[];
  parecer: string;
}

export function obterObservacoesOriginais(record: IARecord | null | undefined): string {
  if (!record) return "Não preenchido";

  if (record.observacoesGeraisOriginais?.trim()) {
    return record.observacoesGeraisOriginais;
  }

  const observacoes = record.observacoesGerais?.trim();
  if (!observacoes) return "Não preenchido";

  const ehRegistroDeDecisao =
    observacoes.startsWith("### FORMULÁRIO") ||
    observacoes.startsWith("### Parecer") ||
    observacoes.startsWith("Confirmação do Período de Teste") ||
    observacoes.includes("FORMULÁRIO DE AVALIAÇÃO") ||
    observacoes.includes("FORMULÁRIO DE GESTÃO DE RISCOS") ||
    observacoes.includes("Parecer Final da Etapa:") ||
    observacoes.startsWith("Direção Financeira:") ||
    observacoes.includes("Relatório do Período de Teste:") ||
    observacoes.includes("Parecer:");

  return ehRegistroDeDecisao ? "Não preenchido" : record.observacoesGerais;
}

export function interpretarComentarioAprovacao(rawComment?: string): ParecerInterpretado {
  const raw = rawComment || "";
  const rawMinusculo = raw.toLowerCase();

  if (
    rawMinusculo.includes("redefinido por") ||
    rawMinusculo.includes("redefinição") ||
    rawMinusculo.includes("status redefinido")
  ) {
    return { criteria: [], parecer: obterUltimoParecerLimpo(raw.trim()) };
  }

  const normalized = raw
    .replace(/###\s*FORMULÁRIO DE AVALIAÇÃO\s*-\s*[^\n\r]*/gi, "")
    .replace(/###\s*FORMULÁRIO DE GESTÃO DE RISCOS\s*\([^\)]*\)/gi, "")
    .replace(/###/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();

  const lines = normalized
    .split(/\n|•/)
    .map((line) => line.trim())
    .filter(Boolean);

  const criteria: CriterioParecer[] = [];
  let parecer = "";

  lines.forEach((line) => {
    const cleanLine = line.trim();

    const extrairParecer = (regex: RegExp) => {
      parecer = cleanLine.replace(regex, "").trim();
    };

    if (/^parecer final da etapa:/i.test(cleanLine)) {
      extrairParecer(/^parecer final da etapa:\s*/i);
      return;
    }
    if (/^parecer técnico justificado:/i.test(cleanLine)) {
      extrairParecer(/^parecer técnico justificado:\s*/i);
      return;
    }
    if (/^parecer:/i.test(cleanLine)) {
      extrairParecer(/^parecer:\s*/i);
      return;
    }
    if (/^confirmação do período de teste:/i.test(cleanLine)) {
      criteria.push({
        label: "Período de Teste",
        value: cleanLine.replace(/^confirmação do período de teste:\s*/i, "").trim(),
      });
      return;
    }
    if (/^relatório geral do período de teste e observações:/i.test(cleanLine)) {
      extrairParecer(/^relatório geral do período de teste e observações:\s*/i);
      return;
    }
    if (/^relatório do período de testes?:/i.test(cleanLine)) {
      extrairParecer(/^relatório do período de testes?:\s*/i);
      return;
    }

    if (cleanLine.includes(":")) {
      const [label, ...rest] = cleanLine.split(":");
      const value = rest.join(":").trim();
      const trimmedLabel = label.trim();
      if (!trimmedLabel || !value || trimmedLabel.toLowerCase() === "etapa") return;

      let finalLabel = trimmedLabel;
      if (trimmedLabel.toLowerCase() === "nome") finalLabel = "Responsável";
      if (trimmedLabel.toLowerCase() === "motivo") finalLabel = "Motivo da Redefinição";
      criteria.push({ label: finalLabel, value });
      return;
    }

    if (!parecer && cleanLine) parecer = cleanLine;
  });

  return {
    criteria,
    parecer: obterUltimoParecerLimpo(parecer || rawComment),
  };
}
