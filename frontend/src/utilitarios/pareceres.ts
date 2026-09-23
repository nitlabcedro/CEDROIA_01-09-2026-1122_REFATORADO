const PARECER_NAO_INFORMADO = "Parecer não informado pelo avaliador.";

export function obterUltimoParecerLimpo(comentario?: string): string {
  if (!comentario) return PARECER_NAO_INFORMADO;

  let texto = String(comentario).trim();
  const parecerJustificativo = texto.match(/Parecer justificativo:\s*([\s\S]*)/i);
  const resultado = parecerJustificativo ?? texto.match(/Parecer:\s*([\s\S]*)/i);

  if (resultado?.[1]) {
    texto = resultado[1].trim();
  }

  texto = texto
    .replace(/^[“"]+|[”"]+$/g, "")
    .replace(/\s+—\s*por[\s\S]*$/i, "")
    .replace(/\s+-\s*por[\s\S]*$/i, "")
    .trim();

  return texto || PARECER_NAO_INFORMADO;
}
