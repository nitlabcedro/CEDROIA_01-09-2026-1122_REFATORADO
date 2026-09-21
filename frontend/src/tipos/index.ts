/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TiposIA {
  CHATBOT = "Chatbot / assistente virtual",
  IA_GENERATIVA = "IA generativa",
  AUTOMACAO = "Automação",
  ANALISE_DADOS = "Análise de dados",
  ANALISE_IMAGENS = "Análise de imagens",
  MACHINE_LEARNING = "Machine Learning",
  APOIO_DECISAO = "Apoio à decisão",
  EQUIPAMENTO_IA_EMBARCADA = "Equipamento com IA embarcada",
  OUTRO = "Outro"
}

export enum ObjetivosIA {
  APOIO_TECNICO = "Apoio técnico",
  AUTOMACAO = "Automação",
  REDUCAO_ERROS = "Redução de erros",
  PRODUTIVIDADE = "Produtividade",
  APOIO_DECISAO = "Apoio à decisão",
  TRIAGEM_PRIORIZACAO = "Triagem ou priorização",
  COMUNICACAO_PACIENTE_MEDICO = "Comunicação com paciente ou médico",
  ANALISE_IMAGENS = "Análise de imagens",
  GESTAO_ADMINISTRATIVA = "Gestão administrativa",
  OUTRO = "Outro"
}

export enum EtapaProcesso {
  PRE_ANALITICA = "Pré-analítica",
  ANALITICA = "Analítica",
  POS_ANALITICA = "Pós-analítica",
  ATENDIMENTO = "Atendimento",
  COMERCIAL = "Comercial",
  FINANCEIRO = "Financeiro",
  FATURAMENTO = "Faturamento",
  QUALIDADE = "Qualidade",
  TI = "TI",
  GESTAO = "Gestão",
  OUTRO = "Outro"
}

export enum Criticidade {
  BAIXA = "Baixa: apoio administrativo",
  MEDIA = "Média: apoio técnico sem impacto direto em resultados",
  ALTA = "Alta: impacto direto em laudos/resultados"
}

export enum NaturezaUso {
  ADMINISTRATIVO = "Administrativo",
  OPERACIONAL = "Operacional",
  TECNICO = "Técnico",
  ASSISTENCIAL = "Assistencial",
  DIAGNOSTICO = "Diagnóstico",
  ESTRATEGICO = "Estratégico"
}

export enum GrauAutonomia {
  BAIXO = "Baixo: apenas apoio ou sugestão",
  MEDIO = "Médio: recomenda ação, mas exige validação humana",
  ALTO = "Alto: executa ou decide automaticamente"
}

export enum StatusUso {
  EM_AVALIACAO = "Em avaliação",
  APROVADO = "Aprovado",
  APROVADO_COM_RESTRICOES = "Aprovado com restrições",
  NAO_APROVADO = "Não aprovado",
  SUSPENSO = "Suspenso",
  EM_TESTE_PILOTO = "Em teste/piloto",
  CANCELADA = "Cancelada pelo solicitante"
}

export enum StatusAuditoria {
  PENDENTE = "Pendente",
  APROVADO = "Aprovado",
  NEGADO = "Negado"
}

export interface RecordHistoryItem {
  date: string;
  action: string;
  user?: string;
  message?: string;
}

export interface IARecord {
  statusAuditoria?: StatusAuditoria;
  id: string; // Ex: IA-CEDRO-0001
  ownerId?: string;
  createdAt: string;
  updatedAt: string;

  // 1. IDENTIFICAÇÃO
  unidadeSetor: string;
  responsavelPreenchimento: string;
  cargo: string;
  dataRegistro: string;
  contato?: string;

  // 2. IDENTIFICAÇÃO DO USO DE IA
  utilizaIA: "Sim" | "Não";
  nomeFerramenta: string;
  fornecedor: string;
  versao: string;
  tipoIA: TiposIA[];
  tipoIAOutro?: string;

  // 3. FINALIDADE
  descricaoAtividade: string;
  objetivos: ObjetivosIA[];
  objetivoOutro?: string;
  etapaProcesso: EtapaProcesso;
  etapaOutro?: string;
  beneficiosEsperados: string;

  // Campos legados de privacidade mantidos somente para desserializar registros antigos.
  usaDadosPessoais?: "Sim" | "Não";
  usaDadosSensiveis?: "Sim" | "Não";
  quaisDados?: string;
  dadosAnonimizados?: "Sim" | "Não" | "Parcial";
  envioFornecedorExterno?: "Sim" | "Não" | "Não sei";
  dadosTreinamentoModelo?: "Sim" | "Não" | "Não sei";
  obsProtecaoDados?: string;

  // 5. PROCESSO E INTEGRAÇÃO
  integradaSistemaInterno: "Sim" | "Não";
  qualSistema?: string;
  impactoResultadosLaboratoriais: "Sim" | "Não";
  validacaoHumana: "Sim" | "Não";
  quemValida?: string;
  registroLogDecisao: "Sim" | "Não" | "Não sei";
  ambienteHomologacao: "Sim" | "Não" | "Não sei";
  obsIntegracao: string;

  // Campos legados mantidos apenas para desserializar registros antigos.
  riscosIdentificados?: string;
  quaisRiscos?: string;
  controlesImplementados?: string;
  quaisControles?: string[];
  controleOutro?: string;
  riscoResidual?: string;
  responsavelRisco?: string;
  frequenciaReavaliacao?: string;
  obsRiscosControles?: string;

  // 7. CONFORMIDADE E SEGURANÇA
  alinhadoLGPD?: "Sim" | "Não" | "Em avaliação";
  politicaInterna: "Sim" | "Não";
  treinamentoColaboradores: "Sim" | "Não";
  documentacaoTecnica: "Sim" | "Não" | "Não se aplica";
  contratoProtecaoDados?: "Sim" | "Não" | "Em avaliação" | "Não se aplica";
  controleAcessoPerfil: "Sim" | "Não" | "Não sei";
  trilhaAuditoria: "Sim" | "Não" | "Não sei";
  procedimentoIncidente: "Sim" | "Não";
  obsConformidade: string;

  // 8. CLASSIFICAÇÃO
  criticidade: Criticidade;
  naturezaUso: NaturezaUso;
  grauAutonomia: GrauAutonomia;
  classificacaoRiscoAutomatico?: string;
  classificacaoRiscoManual?: string;
  justificativaAlteracaoRisco?: string;

  // 9. APROVAÇÃO
  areaAvaliadora: string[];
  areaAvaliadoraOutra?: string;
  statusUso: StatusUso;
  necessitaPlanoAcao: "Sim" | "Não";
  descricaoPlanoAcao?: string;
  responsavelPlanoAcao?: string;
  prazoPlanoAcao?: string;
  parecerTecnico: string;
  dataAprovacao?: string;
  proximaRevisao?: string;

  // 10. OBSERVAÇÕES
  observacoesGerais: string;
  observacoesGeraisOriginais?: string;
  anexos: string;
  documentoUrl?: string;
  documentoNome?: string;
  documentoTamanho?: number;
  documentoTipo?: string;
  historico: RecordHistoryItem[];
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  cargo?: string;
  setor?: string;
  contato?: string;
  role?: "admin" | "moderator" | "user";
  status: "Pendente" | "Autorizado" | "Rejeitado";
  last_seen?: string;
  authorized_by?: string;
  authorized_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  sender_id: string;
  content: string;
  is_private: boolean;
  recipient_id?: string;
  sender_profile?: UserProfile;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
  status?: "sending" | "error";
}

// SISTEMA DE APROVAÇÃO EM ETAPAS
export interface ApprovalStep {
  stepNumber: number;
  roleName: string;
  assignedUserId?: string;
  assignedUserName?: string;
  status: "aguardando" | "aprovado" | "negado" | "opiniao";
  comment?: string;
  decidedAt?: string;
  isOpinionOnly?: boolean;
}

export interface ApprovalWorkflow {
  iaRecordId: string;
  currentStep: number;
  steps: ApprovalStep[];
  finalStatus?: "aprovado" | "negado" | "pendente" | "cancelado";
  completedAt?: string;
}

export interface ApprovalConfigStep {
  stepNumber: number;
  roleName: string;
  userId?: string;
  userName?: string;
  isOpinionOnly?: boolean;
}

export interface ApprovalConfig {
  steps: ApprovalConfigStep[];
}

export type StatusSolicitacaoInformacoesTI = "aguardando_resposta" | "respondida";
export type ModoComunicacaoTI = "legado" | "chat" | "bloco";
export type EstadoComunicacaoTI =
  | "aguardando_solicitante"
  | "aguardando_ti"
  | "encerrada";
export type TurnoComunicacaoTI = "solicitante" | "ti";

export interface PerguntaInformacaoTI {
  id: string;
  solicitacaoId: string;
  ordem: number;
  pergunta: string;
  resposta?: string;
  respondidaEm?: string;
  atualizadaEm?: string;
}

export interface MensagemComunicacaoTI {
  id: string;
  solicitacaoId: string;
  sequencia: number;
  autorId: string;
  autorNome: string;
  papelAutor: TurnoComunicacaoTI;
  conteudo: string;
  criadoEm: string;
  sintetica?: boolean;
}

export interface SolicitacaoInformacoesTI {
  id: string;
  workflowId: string;
  iaRecordId: string;
  nomeFerramenta?: string;
  numeroRodada: number;
  solicitadoPorId: string;
  solicitadoPorNome: string;
  solicitanteId: string;
  status: StatusSolicitacaoInformacoesTI;
  modo: ModoComunicacaoTI;
  estado: EstadoComunicacaoTI;
  turnoAtual?: TurnoComunicacaoTI;
  encerradaEm?: string;
  criadoEm: string;
  respondidoEm?: string;
  perguntas: PerguntaInformacaoTI[];
  mensagens: MensagemComunicacaoTI[];
  totalPerguntas: number;
  totalRespondidas: number;
  todasRespondidas: boolean;
}

export type UserRole = "admin" | "moderator" | "user";

export function canUserApprove(
  userId: string,
  workflow: ApprovalWorkflow,
  config: ApprovalConfig
): boolean {
  if (!workflow || workflow.finalStatus !== "pendente") return false;
  const currentStepConfig = config.steps.find(s => s.stepNumber === workflow.currentStep);
  return currentStepConfig?.userId === userId;
}
