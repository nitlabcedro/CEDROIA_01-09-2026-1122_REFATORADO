export type ContextoMensagemErro =
  | "login"
  | "cadastro"
  | "recuperacao-senha"
  | "redefinicao-senha"
  | "perfil"
  | "chat"
  | "inventario"
  | "aprovacao"
  | "administracao"
  | "operacao";

const FALLBACKS: Record<ContextoMensagemErro, string> = {
  login: "Não foi possível entrar. Tente novamente.",
  cadastro: "Não foi possível concluir o cadastro no momento. Tente novamente.",
  "recuperacao-senha": "Não foi possível enviar o link de recuperação. Tente novamente.",
  "redefinicao-senha": "Não foi possível redefinir sua senha. Tente novamente.",
  perfil: "Não foi possível atualizar o perfil. Tente novamente.",
  chat: "Não foi possível concluir a operação no chat. Tente novamente.",
  inventario: "Não foi possível concluir a operação no inventário. Tente novamente.",
  aprovacao: "Não foi possível concluir a operação de aprovação. Tente novamente.",
  administracao: "Não foi possível concluir a operação administrativa. Tente novamente.",
  operacao: "Não foi possível concluir esta operação. Tente novamente.",
};

function extrairTextoErro(erro: unknown): string {
  if (typeof erro === "string") return erro;
  if (erro instanceof Error) return erro.message;
  if (!erro || typeof erro !== "object") return "";

  const objeto = erro as Record<string, unknown>;
  const partes = [objeto.message, objeto.error_description, objeto.details, objeto.hint, objeto.code];
  return partes.filter((parte): parte is string => typeof parte === "string").join(" ");
}

function extrairCodigoErro(erro: unknown): string {
  if (!erro || typeof erro !== "object") return "";
  const codigo = (erro as Record<string, unknown>).code;
  return typeof codigo === "string" ? codigo.trim().toLocaleLowerCase("en-US") : "";
}

function indicaSenhaIgualAtual(erro: unknown, mensagemNormalizada: string): boolean {
  if (extrairCodigoErro(erro) === "same_password") return true;
  return (
    mensagemNormalizada.includes("same_password")
    || mensagemNormalizada.includes("same password")
    || mensagemNormalizada.includes("different from the old password")
    || mensagemNormalizada.includes("should be different")
  );
}

export function obterMensagemErroUsuario(
  erro: unknown,
  contexto: ContextoMensagemErro = "operacao",
): string {
  const mensagem = extrairTextoErro(erro).trim().toLocaleLowerCase("en-US");

  if (indicaSenhaIgualAtual(erro, mensagem)) {
    return "A nova senha deve ser diferente da senha atual.";
  }

  if (mensagem.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }

  if (
    mensagem.includes("user already registered")
    || mensagem.includes("already been registered")
    || mensagem.includes("email address is already registered")
  ) {
    return "Este e-mail já possui cadastro.";
  }

  if (mensagem.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (mensagem.includes("database error saving new user")) {
    return "Não foi possível concluir o cadastro no momento. Tente novamente em alguns instantes.";
  }

  if (
    mensagem.includes("failed to fetch")
    || mensagem.includes("fetch failed")
    || mensagem.includes("networkerror")
    || mensagem.includes("network error")
    || mensagem.includes("network request failed")
    || mensagem.includes("erro de rede")
    || mensagem.includes("econnrefused")
    || mensagem.includes("connection refused")
    || mensagem.includes("connection reset")
  ) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
  }

  if (
    mensagem.includes("invalid api key")
    || mensagem.includes("missing supabase")
    || mensagem.includes("supabase is not configured")
    || mensagem.includes("supabase não configurado")
    || mensagem.includes("service unavailable")
    || mensagem.includes("project not found")
    || mensagem.includes("503")
  ) {
    return "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.";
  }

  return FALLBACKS[contexto];
}
