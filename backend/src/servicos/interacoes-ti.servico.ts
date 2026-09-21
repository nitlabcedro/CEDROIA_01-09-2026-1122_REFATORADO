import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { papelEhAdmin } from "../utilitarios/permissoes";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";

const LIMITE_MENSAGEM_COMUNICACAO_TI = 1000;
const MAXIMO_PERGUNTAS_BLOCO_TI = 10;
const LIMITE_PERGUNTA_BLOCO_TI = 1000;
const LIMITE_RESPOSTA_BLOCO_TI = 1000;

type ClienteRpc = {
  rpc: (funcao: string, parametros: Record<string, unknown>) => Promise<{
    data: unknown;
    error: unknown;
  }>;
};

type ErroRpc = {
  code?: string;
  details?: string;
  message?: string;
};

const STATUS_ERRO_RPC: Record<string, number> = {
  MENSAGEM_INVALIDA: 400,
  DECISAO_INVALIDA: 400,
  WORKFLOW_INVALIDO: 400,
  NAO_AUTORIZADO: 403,
  THREAD_NAO_ENCONTRADA: 404,
  CONVERSA_ABERTA: 409,
  CONVERSA_ENCERRADA: 409,
  TURNO_INVALIDO: 409,
  MODO_LEGADO: 409,
  MODO_CHAT_SIMPLES: 409,
  MODO_BLOCO_PERGUNTAS: 409,
  PENDENCIA_SOLICITANTE: 409,
  QUANTIDADE_PERGUNTAS_INVALIDA: 400,
  PERGUNTA_INVALIDA: 400,
  RESPOSTA_INVALIDA: 400,
  BLOCO_INVALIDO: 400,
  BLOCO_INCOMPLETO: 400,
  BLOCO_NAO_ENCONTRADO: 404,
  PERGUNTA_NAO_ENCONTRADA: 404,
  RESPOSTAS_IMUTAVEIS: 409,
};

const MENSAGEM_ERRO_RPC: Record<string, string> = {
  QUANTIDADE_PERGUNTAS_INVALIDA: "O bloco deve conter entre 1 e 10 perguntas.",
  PERGUNTA_INVALIDA: "Cada pergunta deve ter entre 1 e 1000 caracteres.",
  RESPOSTA_INVALIDA: "A resposta deve ter entre 1 e 1000 caracteres.",
  BLOCO_INCOMPLETO: "Todas as perguntas precisam ser respondidas antes do envio.",
  BLOCO_NAO_ENCONTRADO: "Este bloco de perguntas não foi encontrado.",
  PERGUNTA_NAO_ENCONTRADA: "Esta pergunta não pertence ao bloco informado.",
  RESPOSTAS_IMUTAVEIS: "Esta resposta já não pode mais ser alterada.",
  CONVERSA_ENCERRADA: "Esta comunicação já foi encerrada.",
  NAO_AUTORIZADO: "Você não tem permissão para realizar esta ação.",
  MODO_CHAT_SIMPLES: "Esta comunicação utiliza o chat simples.",
  MODO_BLOCO_PERGUNTAS: "Esta comunicação utiliza um bloco estruturado de perguntas.",
};

export function mapearErroRpcInteracaoTI(error: ErroRpc) {
  const detalhe = String(error?.details || "").split(":")[0];
  const codigoFuncional = detalhe || (error?.code === "23505" ? "CONVERSA_ABERTA" : "");
  const status = STATUS_ERRO_RPC[codigoFuncional] || (error?.code === "23505" ? 409 : 500);
  return {
    status,
    codigo: codigoFuncional || "ERRO_INTERACAO_TI",
    mensagem: MENSAGEM_ERRO_RPC[codigoFuncional]
      || (status < 500 ? error?.message : undefined)
      || "Erro ao processar comunicação com a TI.",
  };
}

async function chamarRpc(
  cliente: ClienteRpc,
  funcao: string,
  parametros: Record<string, unknown>,
) {
  const { data, error } = await cliente.rpc(funcao, parametros);
  if (error) throw error;
  return data;
}

export function chamarRpcCriarConversaTI(
  cliente: ClienteRpc,
  dados: { recordId: string; userId: string; userName: string; mensagem: string },
) {
  return chamarRpc(cliente, "criar_conversa_comunicacao_ti", {
    p_ia_record_id: dados.recordId,
    p_user_id: dados.userId,
    p_user_name: dados.userName,
    p_content: dados.mensagem,
  });
}

export function chamarRpcCriarBlocoTI(
  cliente: ClienteRpc,
  dados: { recordId: string; userId: string; userName: string; perguntas: string[] },
) {
  return chamarRpc(cliente, "criar_bloco_perguntas_ti", {
    p_ia_record_id: dados.recordId,
    p_user_id: dados.userId,
    p_user_name: dados.userName,
    p_questions: dados.perguntas,
  });
}

export function chamarRpcSalvarRespostaBlocoTI(
  cliente: ClienteRpc,
  dados: { solicitacaoId: string; perguntaId: string; userId: string; resposta: string },
) {
  return chamarRpc(cliente, "salvar_resposta_bloco_ti", {
    p_request_id: dados.solicitacaoId,
    p_question_id: dados.perguntaId,
    p_user_id: dados.userId,
    p_answer: dados.resposta,
  });
}

export function chamarRpcFinalizarBlocoTI(
  cliente: ClienteRpc,
  dados: { solicitacaoId: string; userId: string },
) {
  return chamarRpc(cliente, "finalizar_respostas_bloco_ti", {
    p_request_id: dados.solicitacaoId,
    p_user_id: dados.userId,
  });
}

export function chamarRpcEnviarMensagemTI(
  cliente: ClienteRpc,
  dados: { solicitacaoId: string; userId: string; mensagem: string },
) {
  return chamarRpc(cliente, "enviar_mensagem_comunicacao_ti", {
    p_request_id: dados.solicitacaoId,
    p_user_id: dados.userId,
    p_content: dados.mensagem,
  });
}

export function chamarRpcEncerrarConversaTI(
  cliente: ClienteRpc,
  dados: { solicitacaoId: string; userId: string },
) {
  return chamarRpc(cliente, "encerrar_conversa_comunicacao_ti", {
    p_request_id: dados.solicitacaoId,
    p_user_id: dados.userId,
  });
}

export function chamarRpcDecidirEtapaTI(
  cliente: ClienteRpc,
  dados: {
    workflowId: string;
    stepId: string;
    userId: string;
    decision: string;
    comment?: string;
    userName: string;
  },
) {
  return chamarRpc(cliente, "decidir_etapa_ti_comunicacao_segura", {
    p_workflow_id: dados.workflowId,
    p_step_id: dados.stepId,
    p_user_id: dados.userId,
    p_decision: dados.decision,
    p_comment: dados.comment || "",
    p_user_name: dados.userName,
  });
}

export function validarMensagemComunicacaoTI(mensagem: unknown): string | null {
  const texto = String(mensagem ?? "").trim();
  return texto.length >= 1 && texto.length <= LIMITE_MENSAGEM_COMUNICACAO_TI ? texto : null;
}

export function validarPerguntasBlocoTI(perguntas: unknown): {
  valido: boolean;
  perguntas: string[];
  erro?: string;
} {
  if (!Array.isArray(perguntas)) {
    return { valido: false, perguntas: [], erro: "Informe uma lista de perguntas." };
  }
  const normalizadas = perguntas.map((item) => String(item ?? "").trim());
  if (normalizadas.length < 1 || normalizadas.length > MAXIMO_PERGUNTAS_BLOCO_TI) {
    return { valido: false, perguntas: normalizadas, erro: "O bloco deve conter entre 1 e 10 perguntas." };
  }
  if (normalizadas.some((item) => item.length < 1 || item.length > LIMITE_PERGUNTA_BLOCO_TI)) {
    return {
      valido: false,
      perguntas: normalizadas,
      erro: "Cada pergunta deve ter entre 1 e 1000 caracteres.",
    };
  }
  return { valido: true, perguntas: normalizadas };
}

export function validarRespostaBlocoTI(resposta: unknown): string | null {
  const texto = String(resposta ?? "").trim();
  return texto.length >= 1 && texto.length <= LIMITE_RESPOSTA_BLOCO_TI ? texto : null;
}

export function conversaEhPendenciaResponsavelTI(row: any): boolean {
  return row?.current_turn === "ti" && row?.closed_at == null;
}

export function conversaEhPendenciaSolicitanteTI(row: any): boolean {
  if (row?.closed_at != null) return false;
  if (row?.current_turn == null) return row?.status === "aguardando_resposta";
  return row?.current_turn === "solicitante";
}

export type PayloadCriacaoInteracaoTI =
  | { modo: "chat"; recordId: string; mensagem: string }
  | { modo: "bloco"; recordId: string; perguntas: string[] }
  | { modo: "invalido"; erro: string };

export function identificarPayloadCriacaoInteracaoTI(body: any): PayloadCriacaoInteracaoTI {
  const recordId = String(body?.recordId || "").trim();
  if (!recordId) return { modo: "invalido", erro: "recordId é obrigatório." };

  const possuiMensagem = Object.prototype.hasOwnProperty.call(body || {}, "mensagem");
  const possuiPerguntas = Object.prototype.hasOwnProperty.call(body || {}, "perguntas");
  if (possuiMensagem && possuiPerguntas) {
    return { modo: "invalido", erro: "Informe mensagem ou perguntas, nunca ambos." };
  }

  if (possuiMensagem) {
    const mensagem = validarMensagemComunicacaoTI(body.mensagem);
    return mensagem
      ? { modo: "chat", recordId, mensagem }
      : { modo: "invalido", erro: "A mensagem deve ter entre 1 e 1000 caracteres." };
  }

  if (possuiPerguntas) {
    const validacao = validarPerguntasBlocoTI(body.perguntas);
    return validacao.valido
      ? { modo: "bloco", recordId, perguntas: validacao.perguntas }
      : { modo: "invalido", erro: validacao.erro || "Bloco de perguntas inválido." };
  }

  return { modo: "invalido", erro: "Informe uma mensagem ou uma lista de perguntas." };
}

function estruturaLegadaAusente(error: any) {
  const texto = String(error?.message || error?.details || "").toLowerCase();
  return texto.includes(TABELAS_SUPABASE.SOLICITACOES_TI)
    || texto.includes(TABELAS_SUPABASE.PERGUNTAS_TI);
}

export function estruturaChatAusente(error: any) {
  const texto = String(`${error?.message || ""} ${error?.details || ""}`).toLowerCase();
  return texto.includes(TABELAS_SUPABASE.MENSAGENS_TI)
    || texto.includes("current_turn")
    || texto.includes("closed_at")
    || texto.includes("criar_conversa_comunicacao_ti")
    || texto.includes("enviar_mensagem_comunicacao_ti")
    || texto.includes("encerrar_conversa_comunicacao_ti")
    || texto.includes("decidir_etapa_ti_comunicacao_segura")
    || texto.includes("criar_bloco_perguntas_ti")
    || texto.includes("salvar_resposta_bloco_ti")
    || texto.includes("finalizar_respostas_bloco_ti")
    || error?.code === "PGRST202"
    || error?.code === "42883";
}

async function obterUsuarioAutenticado(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("UNAUTHORIZED");

  const token = authHeader.replace("Bearer ", "");
  const supabaseAdmin = obterClienteSupabase();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHORIZED");

  let profile: { role?: string | null; full_name?: string | null } | null = null;
  let profileError: { message?: string } | null = null;

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const resultado = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    profile = resultado.data;
    profileError = resultado.error;
    if (!profileError) break;
  }

  if (profileError) {
    console.error("Erro ao obter perfil para autorização das interações TI:", profileError.message);
    throw new Error("PROFILE_LOOKUP_FAILED");
  }

  return {
    user,
    role: profile?.role?.toLowerCase().trim() || "user",
    fullName: profile?.full_name || user.email || "Usuário",
  };
}

export function usuarioPodeConsultarInteracoesTI(dados: {
  userId: string;
  role?: string | null;
  ownerId?: string | null;
  ownerIdLegado?: string | null;
  responsavelTiId?: string | null;
}): boolean {
  return papelEhAdmin(dados.role)
    || dados.ownerId === dados.userId
    || dados.ownerIdLegado === dados.userId
    || dados.responsavelTiId === dados.userId;
}

export function adaptarMensagensLegadasTI(row: any) {
  const mensagens: any[] = [];
  const perguntas = (row.questions || row.perguntas || [])
    .slice()
    .sort((a: any, b: any) => Number(a.order_number) - Number(b.order_number));

  perguntas.forEach((pergunta: any, indice: number) => {
    mensagens.push({
      id: `legado-pergunta-${pergunta.id}`,
      request_id: row.id,
      sequence_number: indice * 2 + 1,
      author_id: row.requested_by_id,
      author_name: row.requested_by_name || "TI",
      author_role: "ti",
      content: pergunta.question,
      created_at: pergunta.created_at || row.created_at,
      synthetic: true,
    });
    if (String(pergunta.answer || "").trim()) {
      mensagens.push({
        id: `legado-resposta-${pergunta.id}`,
        request_id: row.id,
        sequence_number: indice * 2 + 2,
        author_id: row.requester_id,
        author_name: "Solicitante",
        author_role: "solicitante",
        content: pergunta.answer,
        created_at: pergunta.answered_at || pergunta.updated_at || row.responded_at || row.created_at,
        synthetic: true,
      });
    }
  });

  return mensagens;
}

function obterEstadoInteracaoTI(row: any) {
  if (row.current_turn === "solicitante" && !row.closed_at) return "aguardando_solicitante";
  if (row.current_turn === "ti" && !row.closed_at) return "aguardando_ti";
  if (row.current_turn == null && row.status === "aguardando_resposta") return "aguardando_solicitante";
  return "encerrada";
}

export function identificarModoInteracaoTI(row: any): "legado" | "chat" | "bloco" {
  if (row.current_turn == null) return "legado";

  const totalPerguntas = (row.questions || row.perguntas || []).length;
  const totalMensagens = (row.messages || row.mensagens || []).length;
  if (totalPerguntas > 0 && totalMensagens === 0) return "bloco";
  if (totalMensagens > 0 && totalPerguntas === 0) return "chat";

  const codigo = totalPerguntas > 0 && totalMensagens > 0
    ? "DADOS_TI_MODO_MISTO"
    : "DADOS_TI_MODO_INDEFINIDO";
  const erro: any = new Error(`${codigo}: Estado inconsistente na comunicação com a TI.`);
  erro.code = codigo;
  throw erro;
}

function erroModoInteracaoInconsistente(error: any) {
  return String(error?.code || "").startsWith("DADOS_TI_MODO_");
}

export function formatarInteracao(
  row: any,
  nomeFerramenta?: string,
  nomesAutores = new Map<string, string>(),
) {
  const perguntas = (row.questions || row.perguntas || [])
    .slice()
    .sort((a: any, b: any) => Number(a.order_number) - Number(b.order_number))
    .map((q: any) => ({
      id: q.id,
      solicitacaoId: q.request_id,
      ordem: Number(q.order_number),
      pergunta: q.question,
      resposta: q.answer || "",
      respondidaEm: q.answered_at || undefined,
      atualizadaEm: q.updated_at || undefined,
    }));
  const mensagensOriginais = row.current_turn == null
    ? adaptarMensagensLegadasTI(row)
    : (row.messages || row.mensagens || []);
  const mensagens = mensagensOriginais
    .slice()
    .sort((a: any, b: any) => Number(a.sequence_number) - Number(b.sequence_number))
    .map((mensagem: any) => ({
      id: mensagem.id,
      solicitacaoId: mensagem.request_id,
      sequencia: Number(mensagem.sequence_number),
      autorId: mensagem.author_id,
      autorNome: nomesAutores.get(mensagem.author_id)
        || mensagem.author_name
        || (mensagem.author_role === "ti" ? row.requested_by_name : "Solicitante"),
      papelAutor: mensagem.author_role,
      conteudo: mensagem.content,
      criadoEm: mensagem.created_at,
      sintetica: Boolean(mensagem.synthetic),
    }));

  const totalRespondidas = perguntas.filter((pergunta: any) =>
    String(pergunta.resposta || "").trim().length > 0).length;

  return {
    id: row.id,
    workflowId: row.workflow_id,
    iaRecordId: row.ia_record_id,
    nomeFerramenta: nomeFerramenta || row.nome_ferramenta || undefined,
    numeroRodada: Number(row.round_number),
    solicitadoPorId: row.requested_by_id,
    solicitadoPorNome: row.requested_by_name,
    solicitanteId: row.requester_id,
    status: row.status,
    modo: identificarModoInteracaoTI(row),
    estado: obterEstadoInteracaoTI(row),
    turnoAtual: row.current_turn || undefined,
    encerradaEm: row.closed_at || undefined,
    criadoEm: row.created_at,
    respondidoEm: row.responded_at || undefined,
    perguntas,
    mensagens,
    totalPerguntas: perguntas.length,
    totalRespondidas,
    todasRespondidas: perguntas.length > 0 && totalRespondidas === perguntas.length,
  };
}

async function obterNomesAutoresTI(supabaseAdmin: any, rows: any[]) {
  const ids = new Set<string>();
  rows.forEach((row) => {
    if (row.requested_by_id) ids.add(row.requested_by_id);
    if (row.requester_id) ids.add(row.requester_id);
    (row.messages || row.mensagens || []).forEach((mensagem: any) => {
      if (mensagem.author_id) ids.add(mensagem.author_id);
    });
  });
  if (ids.size === 0) return new Map<string, string>();

  const { data } = await supabaseAdmin
    .from(TABELAS_SUPABASE.PERFIS)
    .select("id, full_name")
    .in("id", [...ids]);
  return new Map<string, string>(
    (data || []).map((perfil: any) => [perfil.id, perfil.full_name || "Usuário"]),
  );
}

async function registrarHistoricoTI(
  supabaseAdmin: any,
  recordId: string,
  entrada: { action: string; user: string; message: string },
) {
  const { data: iaRecord } = await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .select("data")
    .eq("id", recordId)
    .maybeSingle();

  if (!iaRecord?.data) return;

  const agora = new Date().toISOString();
  const dataAtual = iaRecord.data as any;
  const atualizado = {
    ...dataAtual,
    updatedAt: agora,
    historico: [
      {
        date: agora,
        action: entrada.action,
        user: entrada.user,
        message: entrada.message,
      },
      ...(dataAtual.historico || []),
    ],
  };

  await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .update({ data: atualizado, updated_at: agora })
    .eq("id", recordId);
}

async function obterInteracaoCompleta(supabaseAdmin: any, solicitacaoId: string) {
  let { data, error } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}, ${RELACOES_SUPABASE.MENSAGENS_TI}`)
    .eq("id", solicitacaoId)
    .single();

  if (error && estruturaChatAusente(error)) {
    const legado = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
      .eq("id", solicitacaoId)
      .single();
    data = legado.data;
    error = legado.error;
  }

  if (error || !data) throw error || new Error("Solicitação de informações não encontrada.");

  const { data: registro } = await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .select("nome_ferramenta, data")
    .eq("id", data.ia_record_id)
    .maybeSingle();

  const nomeFerramenta = registro?.nome_ferramenta || registro?.data?.nomeFerramenta;
  const nomesAutores = await obterNomesAutoresTI(supabaseAdmin, [data]);
  return formatarInteracao(data, nomeFerramenta, nomesAutores);
}

async function validarResponsavelTI(supabaseAdmin: any, recordId: string, userId: string, role: string) {
  const { data: workflow, error: wfError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
    .select("id, current_step, final_status")
    .eq("ia_record_id", recordId)
    .maybeSingle();

  if (wfError || !workflow) {
    throw new Error("Workflow de aprovação não encontrado.");
  }
  if (workflow.final_status !== "pendente") {
    throw new Error("O fluxo desta IA já foi encerrado.");
  }
  if (Number(workflow.current_step) !== 2) {
    throw new Error("As perguntas ao solicitante só podem ser criadas durante a Etapa 2 — TI.");
  }

  const { data: step, error: stepError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
    .select("assigned_user_id, assigned_user_name")
    .eq("workflow_id", workflow.id)
    .eq("step_number", 2)
    .maybeSingle();

  if (stepError || !step) throw new Error("Etapa de TI não encontrada no workflow.");

  const permitido = papelEhAdmin(role) || step.assigned_user_id === userId;
  if (!permitido) {
    throw new Error("Apenas o responsável designado pela Etapa 2 — TI pode solicitar informações.");
  }

  return { workflow, step };
}

export async function listarInteracoesTI(req: Request, res: Response) {
  try {
    const { user, role } = await obterUsuarioAutenticado(req);
    const recordId = String(req.query.recordId || "").trim();
    if (!recordId) return res.status(400).json({ error: "recordId é obrigatório." });

    const supabaseAdmin = obterClienteSupabase();
    const { data: registro, error: recordError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("owner_id, nome_ferramenta, data")
      .eq("id", recordId)
      .maybeSingle();

    if (recordError || !registro) return res.status(404).json({ error: "Solicitação de IA não encontrada." });

    const { data: workflow } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    let responsavelTiId: string | null = null;
    if (workflow) {
      const { data: stepTI } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .select("assigned_user_id")
        .eq("workflow_id", workflow.id)
        .eq("step_number", 2)
        .maybeSingle();
      responsavelTiId = stepTI?.assigned_user_id || null;
    }

    const podeVisualizar = usuarioPodeConsultarInteracoesTI({
      userId: user.id,
      role,
      ownerId: registro.owner_id,
      ownerIdLegado: registro.data?.ownerId || registro.data?.userId,
      responsavelTiId,
    });

    if (!podeVisualizar) return res.status(403).json({ error: "Sem permissão para consultar estas interações." });

    let { data, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}, ${RELACOES_SUPABASE.MENSAGENS_TI}`)
      .eq("ia_record_id", recordId)
      .order("round_number", { ascending: true });

    if (error && estruturaChatAusente(error)) {
      const legado = await supabaseAdmin
        .from(TABELAS_SUPABASE.SOLICITACOES_TI)
        .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
        .eq("ia_record_id", recordId)
        .order("round_number", { ascending: true });
      data = legado.data;
      error = legado.error;
    }

    if (error) {
      if (estruturaLegadaAusente(error)) {
        console.error("Estrutura legada de interações TI indisponível:", error.message);
        return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
      }
      return res.status(500).json({ error: error.message });
    }

    const nomeFerramenta = registro.nome_ferramenta || registro.data?.nomeFerramenta;
    const nomesAutores = await obterNomesAutoresTI(supabaseAdmin, data || []);
    return res.json({
      interactions: (data || []).map((row: any) =>
        formatarInteracao(row, nomeFerramenta, nomesAutores)),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    if (error?.message === "PROFILE_LOOKUP_FAILED") {
      return res.status(503).json({ error: "Não foi possível validar suas permissões neste momento." });
    }
    if (erroModoInteracaoInconsistente(error)) {
      console.error("Inconsistência no modo da comunicação TI:", error.code);
      return res.status(500).json({ error: "Foi detectada uma inconsistência nesta comunicação com a TI." });
    }
    return res.status(500).json({ error: error?.message || "Erro ao listar interações da TI." });
  }
}

export async function listarPendenciasSolicitanteTI(req: Request, res: Response) {
  try {
    const { user } = await obterUsuarioAutenticado(req);
    const supabaseAdmin = obterClienteSupabase();

    let { data, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}, ${RELACOES_SUPABASE.MENSAGENS_TI}`)
      .eq("requester_id", user.id)
      .eq("status", "aguardando_resposta")
      .order("created_at", { ascending: true });

    if (error && estruturaChatAusente(error)) {
      const legado = await supabaseAdmin
        .from(TABELAS_SUPABASE.SOLICITACOES_TI)
        .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
        .eq("requester_id", user.id)
        .eq("status", "aguardando_resposta")
        .order("created_at", { ascending: true });
      data = legado.data;
      error = legado.error;
    }

    if (error) {
      if (estruturaLegadaAusente(error)) {
        console.error("Estrutura legada de interações TI indisponível:", error.message);
        return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
      }
      return res.status(500).json({ error: error.message });
    }

    const workflowIds = [...new Set((data || []).map((row: any) => row.workflow_id))];
    const workflowsAtivos = new Set<string>();
    if (workflowIds.length > 0) {
      const { data: workflows } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .select("id, current_step, final_status")
        .in("id", workflowIds);
      (workflows || []).forEach((workflow: any) => {
        if (workflow.final_status === "pendente" && Number(workflow.current_step) === 2) {
          workflowsAtivos.add(workflow.id);
        }
      });
    }

    const pendenciasAtivas = (data || []).filter((row: any) =>
      workflowsAtivos.has(row.workflow_id) && conversaEhPendenciaSolicitanteTI(row));
    const ids = [...new Set(pendenciasAtivas.map((row: any) => row.ia_record_id))];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: registros } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("id, nome_ferramenta, data")
        .in("id", ids);
      (registros || []).forEach((r: any) => nomes.set(r.id, r.nome_ferramenta || r.data?.nomeFerramenta || r.id));
    }

    const nomesAutores = await obterNomesAutoresTI(supabaseAdmin, pendenciasAtivas);
    return res.json({
      interactions: pendenciasAtivas.map((row: any) =>
        formatarInteracao(row, nomes.get(row.ia_record_id), nomesAutores)),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    if (erroModoInteracaoInconsistente(error)) {
      console.error("Inconsistência no modo da pendência TI:", error.code);
      return res.status(500).json({ error: "Foi detectada uma inconsistência nesta comunicação com a TI." });
    }
    return res.status(500).json({ error: error?.message || "Erro ao consultar pendências da TI." });
  }
}

export async function listarPendenciasResponsavelTI(req: Request, res: Response) {
  try {
    const { user, role } = await obterUsuarioAutenticado(req);
    const supabaseAdmin = obterClienteSupabase();

    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .eq("final_status", "pendente")
      .eq("current_step", 2);
    if (workflowsError) throw workflowsError;

    let workflowIds = (workflows || []).map((workflow: any) => workflow.id);
    if (!papelEhAdmin(role) && workflowIds.length > 0) {
      const { data: etapas, error: etapasError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .select("workflow_id")
        .in("workflow_id", workflowIds)
        .eq("step_number", 2)
        .eq("assigned_user_id", user.id);
      if (etapasError) throw etapasError;
      workflowIds = (etapas || []).map((etapa: any) => etapa.workflow_id);
    }

    if (workflowIds.length === 0) return res.json({ interactions: [] });

    const { data, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}, ${RELACOES_SUPABASE.MENSAGENS_TI}`)
      .in("workflow_id", workflowIds)
      .eq("current_turn", "ti")
      .is("closed_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      if (estruturaChatAusente(error)) {
        return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
      }
      throw error;
    }

    const pendenciasTI = (data || []).filter(conversaEhPendenciaResponsavelTI);
    const idsRegistros = [...new Set(pendenciasTI.map((row: any) => row.ia_record_id))];
    const nomesFerramentas = new Map<string, string>();
    if (idsRegistros.length > 0) {
      const { data: registros } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("id, nome_ferramenta, data")
        .in("id", idsRegistros);
      (registros || []).forEach((registro: any) => {
        nomesFerramentas.set(
          registro.id,
          registro.nome_ferramenta || registro.data?.nomeFerramenta || registro.id,
        );
      });
    }

    const nomesAutores = await obterNomesAutoresTI(supabaseAdmin, pendenciasTI);
    return res.json({
      interactions: pendenciasTI.map((row: any) =>
        formatarInteracao(row, nomesFerramentas.get(row.ia_record_id), nomesAutores)),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    console.error("Erro ao consultar pendências do responsável TI:", error?.message || error);
    return res.status(500).json({ error: "Não foi possível consultar as respostas para a TI." });
  }
}

async function criarSolicitacaoLegadaTI(
  supabaseAdmin: any,
  dados: {
    recordId: string;
    perguntas: string[];
    userId: string;
    role: string;
    fullName: string;
  },
) {
  const { workflow } = await validarResponsavelTI(
    supabaseAdmin,
    dados.recordId,
    dados.userId,
    dados.role,
  );
  const { data: registro, error: recordError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .select("owner_id, data")
    .eq("id", dados.recordId)
    .maybeSingle();

  if (recordError || !registro) throw new Error("Solicitação de IA não encontrada.");
  const solicitanteId = registro.owner_id || registro.data?.ownerId;
  if (!solicitanteId) throw new Error("A solicitação não possui um solicitante válido.");

  const { data: pendente, error: pendingError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .select("id")
    .eq("workflow_id", workflow.id)
    .eq("status", "aguardando_resposta")
    .limit(1)
    .maybeSingle();
  if (pendingError) throw pendingError;
  if (pendente) {
    const error: any = new Error("Já existe uma rodada aguardando resposta do solicitante.");
    error.status = 409;
    throw error;
  }

  const { data: ultimaRodada, error: roundError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .select("round_number")
    .eq("workflow_id", workflow.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roundError) throw roundError;

  const numeroRodada = Number(ultimaRodada?.round_number || 0) + 1;
  const { data: solicitacao, error: insertError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .insert({
      workflow_id: workflow.id,
      ia_record_id: dados.recordId,
      step_number: 2,
      round_number: numeroRodada,
      requested_by_id: dados.userId,
      requested_by_name: dados.fullName,
      requester_id: solicitanteId,
      status: "aguardando_resposta",
    })
    .select("*")
    .single();
  if (insertError || !solicitacao) throw insertError || new Error("Não foi possível criar a rodada.");

  const { error: questionsError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.PERGUNTAS_TI)
    .insert(dados.perguntas.map((pergunta, index) => ({
      request_id: solicitacao.id,
      order_number: index + 1,
      question: pergunta,
      answer: null,
    })));

  if (questionsError) {
    await supabaseAdmin.from(TABELAS_SUPABASE.SOLICITACOES_TI).delete().eq("id", solicitacao.id);
    throw questionsError;
  }

  await registrarHistoricoTI(supabaseAdmin, dados.recordId, {
    action: `TI solicitou informações adicionais — rodada ${numeroRodada}`,
    user: dados.fullName,
    message: `${dados.perguntas.length} pergunta(s) enviada(s) ao solicitante.`,
  });
  return obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
}

async function executarCriacaoBlocoTI(
  supabaseAdmin: any,
  dados: { recordId: string; perguntas: string[]; userId: string; fullName: string },
) {
  const resultado = await chamarRpcCriarBlocoTI(supabaseAdmin as unknown as ClienteRpc, {
    recordId: dados.recordId,
    userId: dados.userId,
    userName: dados.fullName,
    perguntas: dados.perguntas,
  }) as any;
  const solicitacao = resultado?.request;
  if (!solicitacao?.id) throw new Error("A RPC não retornou o bloco criado.");

  await registrarHistoricoTI(supabaseAdmin, dados.recordId, {
    action: `TI solicitou informações — rodada ${solicitacao.round_number}`,
    user: dados.fullName,
    message: `${dados.perguntas.length} pergunta(s) enviada(s) ao solicitante.`,
  });
  return obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
}

export async function criarBlocoPerguntasTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const recordId = String(req.body?.recordId || "").trim();
    if (!recordId) return res.status(400).json({ error: "recordId é obrigatório." });
    const validacao = validarPerguntasBlocoTI(req.body?.perguntas);
    if (!validacao.valido) return res.status(400).json({ error: validacao.erro });

    const interaction = await executarCriacaoBlocoTI(obterClienteSupabase(), {
      recordId,
      perguntas: validacao.perguntas,
      userId: user.id,
      fullName,
    });
    return res.status(201).json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({ error: erroMapeado.mensagem, code: erroMapeado.codigo });
  }
}

export async function criarSolicitacaoInformacoesTI(req: Request, res: Response) {
  let modoSolicitado: "chat" | "bloco" | null = null;
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const payload = identificarPayloadCriacaoInteracaoTI(req.body);
    if (payload.modo === "invalido") return res.status(400).json({ error: payload.erro });
    modoSolicitado = payload.modo;

    const supabaseAdmin = obterClienteSupabase();
    if (payload.modo === "bloco") {
      const interaction = await executarCriacaoBlocoTI(supabaseAdmin, {
        recordId: payload.recordId,
        perguntas: payload.perguntas,
        userId: user.id,
        fullName,
      });
      return res.status(201).json({ success: true, interaction });
    }

    const resultado = await chamarRpcCriarConversaTI(supabaseAdmin as unknown as ClienteRpc, {
      recordId: payload.recordId,
      userId: user.id,
      userName: fullName,
      mensagem: payload.mensagem,
    }) as any;
    const solicitacao = resultado?.request;
    if (!solicitacao?.id) throw new Error("A RPC não retornou a conversa criada.");

    await registrarHistoricoTI(supabaseAdmin, payload.recordId, {
      action: `TI iniciou comunicação — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: "Mensagem enviada ao solicitante.",
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
    return res.status(201).json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    if (modoSolicitado === "chat" && estruturaChatAusente(error)) {
      console.error(
        "Estrutura do chat TI indisponível. Revise documentacao/SUPABASE_TI_CHAT.sql:",
        error?.message || error,
      );
      return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
    }
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({
      error: erroMapeado.mensagem,
      code: erroMapeado.codigo,
    });
  }
}

export async function salvarRespostaBlocoTI(req: Request, res: Response) {
  try {
    const { user } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const perguntaId = String(req.params.questionId || "").trim();
    const resposta = validarRespostaBlocoTI(req.body?.resposta);
    if (!solicitacaoId || !perguntaId) {
      return res.status(400).json({ error: "Bloco e pergunta são obrigatórios." });
    }
    if (!resposta) {
      return res.status(400).json({ error: "A resposta deve ter entre 1 e 1000 caracteres." });
    }

    const supabaseAdmin = obterClienteSupabase();
    const resultado = await chamarRpcSalvarRespostaBlocoTI(
      supabaseAdmin as unknown as ClienteRpc,
      { solicitacaoId, perguntaId, userId: user.id, resposta },
    ) as any;
    if (!resultado?.request?.id || !resultado?.question?.id) {
      throw new Error("A RPC não retornou a resposta salva.");
    }
    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacaoId);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({ error: erroMapeado.mensagem, code: erroMapeado.codigo });
  }
}

export async function finalizarBlocoRespostasTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    if (!solicitacaoId) return res.status(400).json({ error: "id é obrigatório." });

    const supabaseAdmin = obterClienteSupabase();
    const resultado = await chamarRpcFinalizarBlocoTI(
      supabaseAdmin as unknown as ClienteRpc,
      { solicitacaoId, userId: user.id },
    ) as any;
    const solicitacao = resultado?.request;
    if (!solicitacao?.id) throw new Error("A RPC não retornou o bloco finalizado.");

    await registrarHistoricoTI(supabaseAdmin, solicitacao.ia_record_id, {
      action: `Solicitante respondeu às informações da TI — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: `${(resultado?.questions || []).length} resposta(s) enviadas para reanálise da TI.`,
    });
    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacaoId);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({ error: erroMapeado.mensagem, code: erroMapeado.codigo });
  }
}

export async function enviarMensagemComunicacaoTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const mensagem = validarMensagemComunicacaoTI(req.body?.mensagem);

    if (!solicitacaoId) return res.status(400).json({ error: "id é obrigatório." });
    if (!mensagem) {
      return res.status(400).json({ error: "A mensagem deve ter entre 1 e 1000 caracteres." });
    }

    const supabaseAdmin = obterClienteSupabase();
    const resultado = await chamarRpcEnviarMensagemTI(supabaseAdmin as unknown as ClienteRpc, {
      solicitacaoId,
      userId: user.id,
      mensagem,
    }) as any;
    const solicitacao = resultado?.request;
    if (!solicitacao?.id) throw new Error("A RPC não retornou a conversa atualizada.");

    await registrarHistoricoTI(supabaseAdmin, solicitacao.ia_record_id, {
      action: resultado?.message?.author_role === "ti"
        ? `TI enviou nova mensagem — rodada ${solicitacao.round_number}`
        : `Solicitante respondeu à TI — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: "Mensagem registrada na comunicação da Etapa 2 — TI.",
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    if (estruturaChatAusente(error)) {
      console.error(
        "Estrutura do chat TI indisponível. Revise documentacao/SUPABASE_TI_CHAT.sql:",
        error?.message || error,
      );
      return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
    }
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({
      error: erroMapeado.mensagem,
      code: erroMapeado.codigo,
    });
  }
}

export async function encerrarConversaComunicacaoTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    if (!solicitacaoId) return res.status(400).json({ error: "id é obrigatório." });

    const supabaseAdmin = obterClienteSupabase();
    const resultado = await chamarRpcEncerrarConversaTI(supabaseAdmin as unknown as ClienteRpc, {
      solicitacaoId,
      userId: user.id,
    }) as any;
    const solicitacao = resultado?.request;
    if (!solicitacao?.id) throw new Error("A RPC não retornou a conversa encerrada.");

    await registrarHistoricoTI(supabaseAdmin, solicitacao.ia_record_id, {
      action: `TI encerrou a comunicação — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: "Comunicação encerrada sem alterar a decisão da Etapa 2 — TI.",
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    if (estruturaChatAusente(error)) {
      console.error(
        "Estrutura do chat TI indisponível. Revise documentacao/SUPABASE_TI_CHAT.sql:",
        error?.message || error,
      );
      return res.status(503).json({ error: "A comunicação com a TI está temporariamente indisponível." });
    }
    const erroMapeado = mapearErroRpcInteracaoTI(error);
    return res.status(erroMapeado.status).json({
      error: erroMapeado.mensagem,
      code: erroMapeado.codigo,
    });
  }
}

async function obterSolicitacaoComModoCompatibilidade(
  supabaseAdmin: any,
  solicitacaoId: string,
  camposLegados: string,
) {
  let { data, error } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .select(`${camposLegados}, current_turn`)
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (error && estruturaChatAusente(error)) {
    const legado = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(camposLegados)
      .eq("id", solicitacaoId)
      .maybeSingle();
    data = legado.data ? { ...legado.data, current_turn: null } : legado.data;
    error = legado.error;
  }
  return { data, error };
}

export async function salvarRascunhoInformacoesTI(req: Request, res: Response) {
  try {
    const { user } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
    const supabaseAdmin = obterClienteSupabase();

    const { data: solicitacao, error } = await obterSolicitacaoComModoCompatibilidade(
      supabaseAdmin,
      solicitacaoId,
      "id, requester_id, status",
    );

    if (error || !solicitacao) return res.status(404).json({ error: "Solicitação de informações não encontrada." });
    if (solicitacao.requester_id !== user.id) return res.status(403).json({ error: "Apenas o solicitante pode responder estas perguntas." });
    if (solicitacao.current_turn !== null) return res.status(409).json({ error: "Rascunho disponível somente para rodadas legadas." });
    if (solicitacao.status !== "aguardando_resposta") return res.status(409).json({ error: "Esta rodada já foi enviada." });

    for (const item of respostas) {
      const perguntaId = String(item?.perguntaId || "").trim();
      if (!perguntaId) continue;
      const resposta = String(item?.resposta || "");
      const { error: updateError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.PERGUNTAS_TI)
        .update({ answer: resposta, updated_at: new Date().toISOString() })
        .eq("id", perguntaId)
        .eq("request_id", solicitacaoId);
      if (updateError) return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao salvar rascunho." });
  }
}

export async function enviarRespostasInformacoesTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
    const supabaseAdmin = obterClienteSupabase();

    const { data: solicitacao, error } = await obterSolicitacaoComModoCompatibilidade(
      supabaseAdmin,
      solicitacaoId,
      "id, ia_record_id, requester_id, status, round_number",
    );

    if (error || !solicitacao) return res.status(404).json({ error: "Solicitação de informações não encontrada." });
    if (solicitacao.requester_id !== user.id) return res.status(403).json({ error: "Apenas o solicitante pode enviar estas respostas." });
    if (solicitacao.current_turn !== null) return res.status(409).json({ error: "Envio em lote disponível somente para rodadas legadas." });
    if (solicitacao.status !== "aguardando_resposta") return res.status(409).json({ error: "Esta rodada já foi respondida." });

    for (const item of respostas) {
      const perguntaId = String(item?.perguntaId || "").trim();
      if (!perguntaId) continue;
      const resposta = String(item?.resposta || "");
      const { error: updateError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.PERGUNTAS_TI)
        .update({ answer: resposta, updated_at: new Date().toISOString() })
        .eq("id", perguntaId)
        .eq("request_id", solicitacaoId);
      if (updateError) return res.status(500).json({ error: updateError.message });
    }

    const { data: perguntas, error: questionsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERGUNTAS_TI)
      .select("id, answer")
      .eq("request_id", solicitacaoId);

    if (questionsError) return res.status(500).json({ error: questionsError.message });
    const incompletas = (perguntas || []).filter((q: any) => !String(q.answer || "").trim());
    if (incompletas.length > 0) {
      return res.status(400).json({ error: "Responda todas as perguntas antes de enviar." });
    }

    const agora = new Date().toISOString();
    await supabaseAdmin
      .from(TABELAS_SUPABASE.PERGUNTAS_TI)
      .update({ answered_at: agora, updated_at: agora })
      .eq("request_id", solicitacaoId);

    const { error: requestUpdateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .update({ status: "respondida", responded_at: agora })
      .eq("id", solicitacaoId);
    if (requestUpdateError) return res.status(500).json({ error: requestUpdateError.message });

    await registrarHistoricoTI(supabaseAdmin, solicitacao.ia_record_id, {
      action: `Solicitante respondeu às informações da TI — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: `${(perguntas || []).length} resposta(s) enviada(s) para reanálise da TI.`,
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacaoId);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao enviar respostas." });
  }
}
