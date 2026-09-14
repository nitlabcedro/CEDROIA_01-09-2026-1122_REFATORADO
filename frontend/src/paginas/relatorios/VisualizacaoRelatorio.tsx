/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { criarConfiguracaoAprovacaoPadrao, ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  Activity,
  Edit,
  Clipboard,
  FileText,
  Info,
  Target,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Check,
  CheckCircle2,
  Users,
  Cpu,
  Lock,
  ChevronRight,
  TrendingUp,
  FileCheck2,
  Bookmark,
  ExternalLink } from
"lucide-react";
import { IARecord, StatusAuditoria, ApprovalWorkflow, ApprovalStep, ApprovalConfig, SolicitacaoInformacoesTI } from "@/tipos";
import { listarInteracoesTI } from "@/servicos/interacoes-ti";
import { obterUltimoParecerLimpo } from "@/utilitarios/pareceres";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";
import {
  obterStatusGeralDoRegistro,
  obterVarianteStatus,
  type StatusGeral,
  type VarianteStatusGeral,
} from "@/utilitarios/status-solicitacao";
import { montarDadosRelatorioPdf } from "./pdf/dadosRelatorioPdf";
import { gerarRelatorioPdfEstruturado } from "./pdf/gerarRelatorioPdf";
import "./RelatorioPdfPainel.css";


interface ReportViewProps {
  record: IARecord;
  onBack: () => void;
  onEdit?: (record: IARecord) => void;
  isAdmin?: boolean;
  workflows?: ApprovalWorkflow[];
  approvalConfig?: ApprovalConfig;
}

type TabType = "visao-geral" | "finalidade-uso" | "nit" | "ti" | "relatorio";

// helper to format comment text
const formatComment = (commentRaw?: string) => {
  if (!commentRaw) return [<p key="empty" className="relatorio__descricao-nenhum-detalhe-adicional-forne">Nenhum detalhe adicional fornecido.</p>];

  const lines = commentRaw.split("\n").map((l) => l.trim()).filter(Boolean);

  return lines.map((line, idx) => {
    // Check if it's a heading
    if (line.startsWith("###")) {
      const cleanHeading = line.replace(/###/g, "").trim();
      return (
        <h5 key={idx} className="relatorio__elemento">
          {cleanHeading}
        </h5>);

    }

    // Check if it's a key-value pair with colon
    if (line.includes(":") && !line.startsWith("http://") && !line.startsWith("https://")) {
      const parts = line.split(":");
      const key = parts[0].replace(/^[•\-\*]\s*/, "").replace(/\*\*/g, "").trim();
      const val = parts.slice(1).join(":").replace(/\*\*/g, "").trim();

      // If it's the main parecer final, make it larger
      if (key.toLowerCase().includes("parecer final") || key.toLowerCase().includes("parecer")) {
        return (
          <div key={idx} className="relatorio__grupo">
            <span className="relatorio__texto">{key}</span>
            <p className="relatorio__descricao">{val}</p>
          </div>);

      }

      return (
        <div key={idx} className="relatorio__grupo-2">
          <span className="relatorio__texto-2">{key}</span>
          <span className="relatorio__texto-3">{val}</span>
        </div>);

    }

    // Fallback simple line
    const cleanLine = line.replace(/^[•\-\*]\s*/, "").replace(/\*\*/g, "").trim();
    return (
      <p key={idx} className="relatorio__descricao-2">
        • {cleanLine}
      </p>);

  });
};

const obterParecerJustificado = (comment?: string) => {
  if (!comment || !comment.trim()) return "Parecer ainda não registrado.";

  const parecerFinal = comment.match(/Parecer Final da Etapa:\s*([\s\S]*)/i);
  if (parecerFinal?.[1]) {
    return obterUltimoParecerLimpo(parecerFinal[1]);
  }

  return obterUltimoParecerLimpo(comment);
};

const formatarDataHora = (value?: string) => {
  if (!value) return "Data não registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function ReportView({ record, onBack, onEdit, isAdmin, workflows, approvalConfig }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("visao-geral");
  const [interacoesTiRelatorio, setInteracoesTiRelatorio] = useState<SolicitacaoInformacoesTI[]>([]);
  const [carregandoInteracoesTiRelatorio, setCarregandoInteracoesTiRelatorio] = useState(false);
  const [erroInteracoesTiRelatorio, setErroInteracoesTiRelatorio] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("relatorio-cedro-ia.pdf");
  const [pdfPreparando, setPdfPreparando] = useState(true);
  const [pdfErro, setPdfErro] = useState("");

  const workflow = useMemo(
    () => workflows?.find((item) => item.iaRecordId === record.id),
    [workflows, record.id],
  );

  const statusGeral = useMemo(
    () => obterStatusGeralDoRegistro(record, workflow),
    [record, workflow],
  );

  const dadosPdf = useMemo(
    () => montarDadosRelatorioPdf(record, workflow, approvalConfig),
    [record, workflow, approvalConfig],
  );

  useEffect(() => {
    if (activeTab !== "ti") return;

    let ativo = true;
    const carregar = async () => {
      try {
        setCarregandoInteracoesTiRelatorio(true);
        setErroInteracoesTiRelatorio("");
        const dados = await listarInteracoesTI(record.id);
        if (ativo) setInteracoesTiRelatorio(dados);
      } catch (error: unknown) {
        console.error("Erro ao carregar mensagens da TI no relatório:", error);
        if (ativo) {
          setInteracoesTiRelatorio([]);
          setErroInteracoesTiRelatorio(obterMensagemErroUsuario(error, "aprovacao"));
        }
      } finally {
        if (ativo) setCarregandoInteracoesTiRelatorio(false);
      }
    };

    carregar();
    return () => {
      ativo = false;
    };
  }, [activeTab, record.id]);

  // O documento é preparado automaticamente a partir do template fixo sempre que
  // os dados da IA ou do fluxo mudam. Visualização e download reutilizam o MESMO blob.
  useEffect(() => {
    let ativo = true;
    let urlGerada = "";

    const prepararDocumento = async () => {
      setPdfPreparando(true);
      setPdfErro("");
      setPdfUrl(null);

      try {
        const { doc, fileName } = await gerarRelatorioPdfEstruturado(dadosPdf);
        const blob = doc.output("blob");
        urlGerada = URL.createObjectURL(blob);

        if (!ativo) {
          URL.revokeObjectURL(urlGerada);
          return;
        }

        setPdfFileName(fileName);
        setPdfUrl(urlGerada);
      } catch (error) {
        console.error("Erro ao preparar PDF estruturado:", error);
        if (ativo) setPdfErro("Não foi possível preparar o relatório estruturado.");
      } finally {
        if (ativo) setPdfPreparando(false);
      }
    };

    prepararDocumento();

    return () => {
      ativo = false;
      if (urlGerada) URL.revokeObjectURL(urlGerada);
    };
  }, [dadosPdf]);

  const handleDownloadPDF = () => {
    if (!pdfUrl || pdfPreparando) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = pdfFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleVisualizarPDF = () => {
    if (!pdfUrl || pdfPreparando) return;
    const novaAba = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!novaAba) {
      alert("O navegador bloqueou a nova guia. Permita pop-ups para abrir o relatório.");
    }
  };

  // Dynamic approval workflow helpers
  const isWfFinished = statusGeral === "Aprovada" || statusGeral === "Não aprovada" || statusGeral === "Cancelada";
  const currentStepNum = workflow ? workflow.currentStep : 1;
  const deniedSteps = workflow?.steps?.filter((s) => s.status === "negado") || [];

  // Unified helper to obtain steps list (with dynamic fallback if no explicit workflow)
  const getEffectiveWorkflowSteps = (): ApprovalStep[] => {
    if (workflow && workflow.steps && workflow.steps.length > 0) {
      return [...workflow.steps].sort((a, b) => a.stepNumber - b.stepNumber);
    }

    const comentariosPorEtapa: Record<number, { aprovado: string; negado: string; aguardando: string }> = {
      1: {
        aprovado: "Parecer técnico favorável emitido pelo NIT.",
        negado: "Parecer desfavorável emitido pelo NIT.",
        aguardando: "Aguardando parecer técnico justificado.",
      },
      2: {
        aprovado: "Avaliação técnica aprovada.",
        negado: "Avaliação técnica desfavorável.",
        aguardando: "Aguardando avaliação técnica.",
      },
      3: {
        aprovado: "Período de teste concluído.",
        negado: "Período de teste desfavorável.",
        aguardando: "Aguardando período de teste.",
      },
      4: {
        aprovado: "Aprovação da Presidência registrada.",
        negado: "Parecer desfavorável da Presidência.",
        aguardando: "Aguardando deliberação da Presidência.",
      },
      5: {
        aprovado: "Parecer financeiro registrado.",
        negado: "Aguardando parecer financeiro.",
        aguardando: "Aguardando parecer financeiro.",
      },
    };

    return ETAPAS_APROVACAO_OFICIAIS.map((etapa): ApprovalStep => {
      const status: ApprovalStep["status"] = "aguardando";

      const comentario = comentariosPorEtapa[etapa.stepNumber];
      const assignedUserName = etapa.stepNumber === 1
        ? record.quemValida || etapa.roleName
        : etapa.stepNumber === 3
          ? "Responsável pelo Período de Teste"
          : etapa.roleName;

      return {
        stepNumber: etapa.stepNumber,
        roleName: etapa.roleName,
        assignedUserName,
        status,
        comment: comentario.aguardando,
        isOpinionOnly: etapa.isOpinionOnly,
      };
    });

  };

  const getStepStatusDetails = (step: ApprovalStep) => {
    const rawStatus = (step.status || "").toLowerCase().trim();
    const isPassed = ["aprovado", "aprovada", "opiniao", "opinado", "concluido"].includes(rawStatus);
    const isFailed = ["negado", "indeferido", "rejeitado", "declinado", "nao_aprovado"].includes(rawStatus);
    const isCurrent = (step.stepNumber === currentStepNum && !isWfFinished && !isPassed && !isFailed) || rawStatus === "em_avaliacao" || rawStatus === "pendente";
    const isAwaiting = !isPassed && !isFailed && !isCurrent;
    const variante = isPassed ? "aprovada" : isFailed ? "negada" : isCurrent ? "atual" : "aguardando";
    const badgeText = isPassed
      ? (rawStatus === "opiniao" || rawStatus === "opinado" ? "PARECER EMITIDO" : "APROVADA")
      : isFailed ? "INDEFERIDA" : isCurrent ? "EM ANÁLISE" : "AGUARDANDO";

    return {
      isPassed,
      isFailed,
      isCurrent,
      isAwaiting,
      variante,
      badgeText,
      iconSymbol: isPassed ? "✓" : isFailed ? "✕" : String(step.stepNumber),
    };
  };

  const getWorkflowSteps = () => {
    if (approvalConfig?.steps && approvalConfig.steps.length > 0) {
      return approvalConfig.steps;
    }
    return criarConfiguracaoAprovacaoPadrao().steps.map((step) => ({
      ...step,
      userId: "",
      userName: "",
    }));

  };

  const getActiveStepDef = () => {
    return getWorkflowSteps().find((s) => s.stepNumber === currentStepNum);
  };

  const getEtapaAtualText = () => {
    if (!workflow) {
      if (statusGeral === "Aprovada") return "Homologado";
      if (statusGeral === "Em análise" || statusGeral === "Em teste") return "Triagem Inicial NIT";
      if (statusGeral === "Cancelada") return "Cancelada";
      return "Cadastro Concluído";
    }
    if (isWfFinished) {
      if (statusGeral === "Aprovada") return "Homologado (Concluído)";
      if (statusGeral === "Cancelada") return "Cancelada";
      return "Declinado / Não Aprovado";
    }
    const def = getActiveStepDef();
    return def ? `${currentStepNum}. ${def.roleName}` : `Etapa ${currentStepNum}`;
  };

  const getResponsavelAtualText = () => {
    if (!workflow) return record.quemValida || "Comitê de Governança do Laboratório";
    if (isWfFinished) {
      return "Processo Finalizado";
    }
    const wfStep = workflow.steps?.find((s) => s.stepNumber === currentStepNum);
    const def = getActiveStepDef();
    return wfStep?.assignedUserName || def?.userName || record.quemValida || "Aguardando definição";
  };

  const mapVarianteCss = (variante: VarianteStatusGeral) => {
    switch (variante) {
      case "aprovada": return "aprovado";
      case "teste": return "teste";
      case "cancelada": return "cancelado";
      case "negada": return "negado";
      default: return "avaliacao";
    }
  };

  const getStatusIcon = (variante: VarianteStatusGeral) => {
    switch (variante) {
      case "aprovada":
        return <CheckCircle2 className="relatorio__icone-checkcircle2" />;
      case "teste":
        return <TrendingUp className="relatorio__icone-trendingup" />;
      case "cancelada":
        return <AlertTriangle className="relatorio__icone-alerttriangle-2" />;
      case "negada":
        return <ShieldAlert className="relatorio__icone-shieldalert-2" />;
      default:
        return <Activity className="relatorio__icone-activity" />;
    }
  };

  const getStatusGradientClass = (status: StatusGeral) => {
    switch (status) {
      case "Aprovada": return "relatorio__grupo-22";
      case "Em teste": return "relatorio__grupo-25";
      case "Não aprovada": return "relatorio__grupo-27";
      case "Cancelada": return "relatorio__grupo-26";
      default: return "relatorio__grupo-24";
    }
  };

  const getStatusCssVariant = () => mapVarianteCss(obterVarianteStatus(statusGeral));

  const getStatusColor = () =>
    `relatorio-status relatorio-status--${getStatusCssVariant()}`;

  return (
    <div id="relatorio-conteudo" data-componente="pagina-relatorio" className="pagina-relatorio relatorio-container cedro-page-premium">
      {/* 1. Cabeçalho da IA */}
      <div className="relatorio-cabecalho relatorio__relatorio-cabecalho-estrutura">
        {/* Back Link */}
        <div>
          <button
            onClick={onBack}
            className="grupo-interativo relatorio__botao-voltar-ao-inventario">
            
            <ArrowLeft size={14} className="relatorio__icone-arrowleft" />
            Voltar ao Inventário
          </button>
        </div>

        {/* Title, Badge status y acciones */}
        <div className="relatorio__grupo-3">
          <div className="relatorio__grupo-4">
            <div className="relatorio__grupo-5">
              <h1 className="relatorio__titulo-principal">
                {record.nomeFerramenta}
              </h1>
              {/* Status Badge */}
              <div className={`relatorio__grupo-6 ${getStatusColor()}`}>
                <div className="relatorio-status__ponto" />
                <span>{statusGeral}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons Toolbar */}
          <div className="relatorio-acoes relatorio__relatorio-acoes-estrutura">
            {/* {onEdit &&
            <button
              onClick={() => onEdit(record)}
              className="relatorio__botao-editar-cadastro">
              
                <Edit size={14} />
                Editar cadastro
              </button>
            } */}

            {(statusGeral === "Em análise" || statusGeral === "Em teste") &&
            <div className="relatorio__grupo-em-aprovacao">
                <Activity size={14} className="relatorio__icone-activity-2" />
                <span>{statusGeral}</span>
              </div>
            }




          </div>
        </div>
      </div>

      {/* Justificativa de Indeferimento */}
      {(statusGeral === "Não aprovada" || deniedSteps.length > 0) &&
      <section className="relatorio-secao relatorio-indeferimento relatorio__relatorio-secao-estrutura">
          {/* Top highlight bar */}
          <div className="relatorio__grupo-8" />
          
          <div className="relatorio__grupo-9">
            <div className="relatorio__grupo-10">
              <div className="relatorio__grupo-11">
                <ShieldAlert size={22} className="relatorio__icone-shieldalert-3" />
              </div>
              <div>
                <p className="relatorio__descricao-parecer-tecnico-de-indeferimen">
                  Parecer Técnico de Indeferimento / Não Conformidade
                </p>
                <h2 className="relatorio__titulo-secao-justificativa-de-indeferimento">
                  Justificativa de Indeferimento da Proposta
                </h2>
              </div>
            </div>
            <div className="relatorio__grupo-recusada-pelas-instancias-de-g">
              Recusada pelas Instâncias de Governança
            </div>
          </div>

          <div className="relatorio__grupo-12">
            {deniedSteps.length > 0 ?
          deniedSteps.map((step, sIdx) =>
          <div key={sIdx} className="relatorio__grupo-13">
                  <div className="relatorio__grupo-14">
                    <div className="relatorio__grupo-15">
                      <span className="relatorio__texto-4">
                        ✗
                      </span>
                      <h4 className="relatorio__titulo-item-etapa">
                        Etapa {step.stepNumber}: {step.roleName}
                      </h4>
                    </div>
                    {step.decidedAt &&
              <span className="relatorio__texto-decidido-em">
                        Decidido em: {new Date(step.decidedAt).toLocaleString("pt-BR")}
                      </span>
              }
                  </div>

                  <div className="relatorio__grupo-16">
                    <div className="relatorio__grupo-avaliador-responsavel">
                      <div className="relatorio__grupo-avaliador-responsavel-2">
                        <span className="relatorio__texto-avaliador-responsavel">Avaliador Responsável</span>
                        <span className="relatorio__texto-5">{step.assignedUserName || "Não identificado"}</span>
                      </div>
                      
                      <div className="relatorio__grupo-fundamentacao-tecnica-e-justif">
                        <span className="relatorio__texto-fundamentacao-tecnica-e-justif">Fundamentação Técnica e Justificativa da Recusa</span>
                        <div className="relatorio__grupo-17">
                          {formatComment(step.comment)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
          ) :

          <div className="relatorio__grupo-18">
                <div className="relatorio__grupo-19">
                  <AlertTriangle className="relatorio__icone-alerttriangle-3" />
                  <div className="relatorio__grupo-parecer-final-consolidado">
                    <h4 className="relatorio__titulo-item-etapa">Parecer Final Consolidado</h4>
                    <p className="relatorio__descricao-3">
                      {record.parecerTecnico || "Este projeto foi indeferido na triagem inicial ou pelo comitê central de governança."}
                    </p>
                  </div>
                </div>
              </div>
          }
          </div>
        </section>
      }

      {/* 2. Resumo executivo */}
      <section className="relatorio__secao-resumo-executivo">
        <div className="relatorio__cabecalho-bloco">
          <div className="relatorio__icone-bloco relatorio__icone-bloco--verde-claro">
            <Clipboard size={18} />
          </div>
          <div>
            <p className="relatorio__descricao-resumo-executivo">
              Resumo executivo
            </p>
            <h2 className="relatorio__titulo-secao-visao-rapida-da-solicitacao">
              Visão rápida da solicitação
            </h2>
          </div>
        </div>

        <div className="relatorio__grupo-finalidade-da-ia">
          {/* Card 1: Finalidade da IA */}
          <div className="relatorio__grupo-finalidade-da-ia-2 relatorio__cartao-relatorio">
            <div className="relatorio__cabecalho-card">
              <div className="relatorio__icone-bloco relatorio__icone-bloco--verde">
                <Target size={18} />
              </div>
              <span className="relatorio__texto-finalidade-da-ia">Finalidade da IA</span>
            </div>
            <div className="relatorio__grupo-parecer-final-consolidado">
              <p className="relatorio__descricao-4">
                {record.descricaoAtividade || "Nenhuma descrição de atividade registrada."}
              </p>
            </div>
            <div className="relatorio__grupo-setor-ativa">
              <span>Setor: {record.unidadeSetor}</span>
              {statusGeral === "Aprovada" && <span className="relatorio__texto-ativa">Ativa</span>}
            </div>
          </div>

          {/* Card 2: Status da Avaliação */}
          <div className="relatorio__grupo-20 relatorio__cartao-relatorio">
            {/* Top decorative gradient line linked to status */}
            <div className={`relatorio__grupo-21 ${getStatusGradientClass(statusGeral)}`} />

            <div className="relatorio__grupo-status-da-avaliacao">
              <div className="relatorio__cabecalho-card relatorio__cabecalho-card--status">
                <div className="relatorio__icone-bloco relatorio__icone-bloco--alerta">
                  <ShieldCheck size={18} />
                </div>
                <div className="relatorio__grupo-resumo-executivo">
                  <span className="relatorio__texto-finalidade-da-ia">Status da Avaliação</span>
                  <span className="relatorio__texto-6">
                  <span className={`relatorio__texto-7 relatorio-status__pulso relatorio-status__pulso--${getStatusCssVariant()}`} />
                    <span className={`relatorio__texto-8 relatorio-status__ponto relatorio-status__ponto--${getStatusCssVariant()}`} />
                  </span>
                </div>
              </div>

              <div className={`relatorio__grupo-28 relatorio-status relatorio-status--${getStatusCssVariant()}`}>
                <div className="relatorio__grupo-15">
                  {getStatusIcon(obterVarianteStatus(statusGeral))}
                  <span className="relatorio__texto-9">
                    {statusGeral}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Situação atual da aprovação */}
      <section className="relatorio__secao-situacao-da-aprovacao">
        <div className="relatorio__cabecalho-bloco">
          <div className="relatorio__icone-bloco relatorio__icone-bloco--verde-claro">
            <FileCheck2 size={18} />
          </div>
          <div>
          <p className="relatorio__descricao-resumo-executivo">
            Situação da aprovação
          </p>
          <h2 className="relatorio__titulo-secao-visao-rapida-da-solicitacao">
            Etapas de aprovação
          </h2>
          </div>
        </div>



        {/* Dynamic Stepper */}
        <div className="relatorio__grupo-29">
          <div className="relatorio__grupo-30">
            {getEffectiveWorkflowSteps().map((step) => {
              const details = getStepStatusDetails(step);
              const signerName = step.assignedUserName || "Aprovação livre";

              return (
                <div
                  key={step.stepNumber}
                  className={`relatorio__grupo-31 relatorio-etapa relatorio-etapa--${details.variante}`}>
                  
                  <div>
                    <div className="relatorio__grupo-32">
                      <div className="relatorio__grupo-33">
                        <div className="relatorio__grupo-34 relatorio-etapa__icone">
                          {details.iconSymbol}
                        </div>
                        <span className="relatorio__texto-etapa">
                          Etapa {step.stepNumber}
                        </span>
                      </div>
                      <span className="relatorio__texto-10 relatorio-etapa__badge">
                        {details.badgeText}
                      </span>
                    </div>
                    
                    <p className="relatorio__descricao-5">
                      {step.roleName}
                    </p>
                  </div>

                  <div className="relatorio__grupo-responsavel">
                    <span className="relatorio__texto-responsavel">Responsável</span>
                    <span className="relatorio__texto-11">
                      {signerName}
                    </span>
                  </div>
                </div>);

            })}
          </div>
        </div>
      </section>



      {/* 5. Navegação por Abas - hidden on print */}
      <div className="cedro-abas relatorio-abas relatorio__relatorio-abas-estrutura">
        {[
        { id: "visao-geral", label: "Resumo", icon: Info },
        { id: "finalidade-uso", label: "Uso da IA", icon: Target },
        { id: "nit", label: "NIT", icon: ShieldCheck },
        { id: "ti", label: "TI", icon: Cpu },
        { id: "relatorio", label: "Relatório", icon: FileText }].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`cedro-aba ${isActive ? "cedro-aba--ativa" : ""} relatorio__botao ${
              isActive ?
              "relatorio__botao-2" :
              "relatorio__botao-3"}`
              }>
              
              <tab.icon size={14} className={isActive ? "relatorio__elemento-2" : "relatorio__elemento-3"} />
              {tab.label}
            </button>);

        })}
      </div>

      {/* 6. Conteúdo Dinâmico das Abas */}
      <div className="relatorio__grupo-35">
        
        {/* TAB 1: RESUMO / VISÃO GERAL */}
        {activeTab === "visao-geral" &&
        <div className="relatorio__grupo-36">
            <div className="relatorio__grupo-resumo-da-ficha-tecnica">
              <div className="relatorio__cabecalho-bloco relatorio__cabecalho-bloco--sem-fundo">
                <div className="relatorio__icone-bloco relatorio__icone-bloco--verde">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="relatorio__titulo-bloco-resumo-da-ficha-tecnica">
                    Resumo da Ficha Técnica
                  </h3>
                  <p className="relatorio__subtitulo-ficha-tecnica">
                    Visão geral das informações principais desta IA
                  </p>
                </div>
              </div>
              <div className="relatorio__grupo-avaliador-coordenador-nit-etap">
                <span>Avaliador: Coordenador NIT (Etapa 1)</span>
              </div>
            </div>

            <div className={`relatorio__grupo-37 ${isAdmin ? "relatorio__grupo-39" : "relatorio__grupo-40"} relatorio__grupo-38`}>
              {/* Card 1 — O que é esta IA? */}
              <div className="relatorio__grupo-identidade">
                <div className="relatorio__grupo-identidade-o-que-e-esta-ia">
                  <div className="relatorio__icone-bloco relatorio__icone-bloco--verde relatorio__icone-bloco--card">
                    <Cpu size={18} />
                  </div>
                  <div className="relatorio__grupo-titulos-card">
                    <span className="relatorio__texto-identidade">Identidade</span>
                    <h4 className="relatorio__titulo-item-o-que-e-esta-ia">O que é esta IA?</h4>
                  </div>
                </div>
                <div className="relatorio__grupo-nome-da-ferramenta">
                  <div>
                    <span className="relatorio__texto-nome-da-ferramenta">Nome da Ferramenta</span>
                    <p className="relatorio__descricao-6">{record.nomeFerramenta || "Não preenchido"}</p>
                  </div>
                  <div>
                    <span className="relatorio__texto-nome-da-ferramenta">Descrição da Atividade</span>
                    <p className="relatorio__descricao-7">
                      {record.descricaoAtividade || "Não preenchido"}
                    </p>
                  </div>
                  <div>
                    <span className="relatorio__texto-nome-da-ferramenta">Tipo de Inteligência Artificial</span>
                    <div className="relatorio__grupo-41">
                      {record.tipoIA && record.tipoIA.length > 0 ?
                    record.tipoIA.map((t, idx) =>
                    <span key={idx} className="relatorio__texto-12">
                            {t}
                          </span>
                    ) :

                    <span className="relatorio__texto-nao-preenchido">Não preenchido</span>
                    }
                    </div>
                  </div>
                  {record.fornecedor && record.fornecedor.toLowerCase() !== "interno" &&
                <div>
                      <span className="relatorio__texto-nome-da-ferramenta">Fornecedor da Solução</span>
                      <p className="relatorio__descricao-8">{record.fornecedor}</p>
                    </div>
                }
                </div>
              </div>

              {/* Card 2 — Quem solicitou? */}
              <div className="relatorio__grupo-identidade">
                <div className="relatorio__grupo-identidade-o-que-e-esta-ia">
                  <div className="relatorio__icone-bloco relatorio__icone-bloco--azul relatorio__icone-bloco--card">
                    <Users size={18} />
                  </div>
                  <div className="relatorio__grupo-titulos-card">
                    <span className="relatorio__texto-identidade relatorio__texto-identidade--azul">Ficha Solicitante</span>
                    <h4 className="relatorio__titulo-item-o-que-e-esta-ia">Quem solicitou?</h4>
                  </div>
                </div>
                <div className="relatorio__grupo-setor-requisitante">
                  <div>
                    <span className="relatorio__texto-nome-da-ferramenta">Setor Requisitante</span>
                    <p className="relatorio__descricao-9">{record.unidadeSetor || "Não preenchido"}</p>
                  </div>
                  <div>
                    <span className="relatorio__texto-nome-da-ferramenta">Responsável Técnico</span>
                    <p className="relatorio__descricao-10">{record.responsavelPreenchimento || "Não preenchido"}</p>
                    <p className="relatorio__descricao-11">{record.cargo || "Moderação"}</p>
                  </div>
                  <div>
                    <span className="relatorio__texto-data-de-cadastro">Data de Cadastro</span>
                    <p className="relatorio__descricao-8">{record.dataRegistro || "Não preenchido"}</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        }

        {/* TAB 2: USO DA IA — DADOS DA ETAPA 3 DA NOVA SOLICITAÇÃO */}
        {activeTab === "finalidade-uso" &&
        <div className="relatorio-uso-ia">
          <div className="relatorio-uso-ia__cabecalho">
            <div className="relatorio-uso-ia__icone">
              <Target size={19} />
            </div>
            <div>
              <span className="relatorio-uso-ia__rotulo">Etapa 3 da Nova Solicitação</span>
              <h3 className="relatorio-uso-ia__titulo">Finalidade e Objetivos</h3>
              <p className="relatorio-uso-ia__subtitulo">
                Informações declaradas pelo solicitante sobre onde a IA será utilizada, seus objetivos e os benefícios esperados.
              </p>
            </div>
          </div>

          <section className="relatorio-uso-ia__card relatorio-uso-ia__card--destaque">
            <div className="relatorio-uso-ia__card-cabecalho">
              <span className="relatorio-uso-ia__numero">01</span>
              <div>
                <span className="relatorio-uso-ia__campo-rotulo">Descrição da atividade</span>
                <h4>Onde e como a IA será utilizada</h4>
              </div>
            </div>
            <p className={`relatorio-uso-ia__texto ${!record.descricaoAtividade ? "relatorio-uso-ia__texto--vazio" : ""}`}>
              {record.descricaoAtividade || "Não preenchido"}
            </p>
          </section>

          <div className="relatorio-uso-ia__grade">
            <section className="relatorio-uso-ia__card">
              <div className="relatorio-uso-ia__card-cabecalho">
                <span className="relatorio-uso-ia__numero">02</span>
                <div>
                  <span className="relatorio-uso-ia__campo-rotulo">Objetivo da utilização</span>
                  <h4>Objetivos selecionados</h4>
                </div>
              </div>

              {record.objetivos && record.objetivos.length > 0 ?
                <div className="relatorio-uso-ia__objetivos">
                  {record.objetivos.map((objetivo, index) =>
                    <div key={`${objetivo}-${index}`} className="relatorio-uso-ia__objetivo">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>{objetivo}</span>
                    </div>
                  )}
                  {record.objetivoOutro &&
                    <div className="relatorio-uso-ia__outro-objetivo">
                      <span>Outro objetivo informado</span>
                      <p>{record.objetivoOutro}</p>
                    </div>
                  }
                </div> :
                <p className="relatorio-uso-ia__texto relatorio-uso-ia__texto--vazio">Não preenchido</p>
              }
            </section>

            <section className="relatorio-uso-ia__card">
              <div className="relatorio-uso-ia__card-cabecalho">
                <span className="relatorio-uso-ia__numero">03</span>
                <div>
                  <span className="relatorio-uso-ia__campo-rotulo">Benefícios esperados</span>
                  <h4>Resultados esperados com o uso da IA</h4>
                </div>
              </div>
              <p className={`relatorio-uso-ia__texto ${!record.beneficiosEsperados ? "relatorio-uso-ia__texto--vazio" : ""}`}>
                {record.beneficiosEsperados || "Não preenchido"}
              </p>
            </section>
          </div>
        </div>
        }

        {/* TAB 3: PARECER DO NIT */}
        {activeTab === "nit" &&
        <div className="relatorio-parecer-area">
          <div className="relatorio-parecer-area__cabecalho">
            <div className="relatorio-parecer-area__icone">
              <ShieldCheck size={19} />
            </div>
            <div>
              <span className="relatorio-parecer-area__rotulo">Governança da solicitação</span>
              <h3 className="relatorio-parecer-area__titulo">Parecer do NIT</h3>
              <p className="relatorio-parecer-area__descricao">
                Parecer justificado registrado pela etapa do Núcleo de Inovação e Tecnologia no fluxo de aprovação.
              </p>
            </div>
          </div>

          <div className="relatorio-parecer-area__lista">
            {(workflow?.steps || []).filter((step) => /\bNIT\b/i.test(step.roleName)).length > 0 ?
              (workflow?.steps || []).filter((step) => /\bNIT\b/i.test(step.roleName)).map((step) => {
                const status = getStepStatusDetails(step);
                return (
                  <article key={step.stepNumber} className="relatorio-parecer-card">
                    <div className="relatorio-parecer-card__topo">
                      <div>
                        <span className="relatorio-parecer-card__etapa">Etapa {step.stepNumber}</span>
                        <h4 className="relatorio-parecer-card__responsavel">{step.roleName}</h4>
                      </div>
                      <span className={`relatorio-parecer-card__status relatorio-parecer-card__status--${status.variante}`}>
                        {status.badgeText}
                      </span>
                    </div>

                    <div className="relatorio-parecer-card__metadados">
                      <div>
                        <span>Responsável</span>
                        <strong>{step.assignedUserName || "Não identificado"}</strong>
                      </div>
                      <div>
                        <span>Registro da decisão</span>
                        <strong>{formatarDataHora(step.decidedAt)}</strong>
                      </div>
                    </div>

                    <div className="relatorio-parecer-card__parecer">
                      <span className="relatorio-parecer-card__parecer-label">Parecer justificado</span>
                      <p>{obterParecerJustificado(step.comment)}</p>
                    </div>
                  </article>
                );
              }) :
              <div className="relatorio-parecer-vazio">
                <ShieldCheck size={22} />
                <div>
                  <strong>Parecer do NIT ainda não disponível</strong>
                  <p>Quando a etapa do NIT registrar sua decisão, a justificativa será apresentada aqui.</p>
                </div>
              </div>
            }
          </div>
        </div>
        }

        {/* TAB 4: PARECER E INTERAÇÕES DA TI */}
        {activeTab === "ti" &&
        <div className="relatorio-parecer-area">
          <div className="relatorio-parecer-area__cabecalho">
            <div className="relatorio-parecer-area__icone relatorio-parecer-area__icone--ti">
              <Cpu size={19} />
            </div>
            <div>
              <span className="relatorio-parecer-area__rotulo">Avaliação técnica</span>
              <h3 className="relatorio-parecer-area__titulo">Parecer da TI</h3>
              <p className="relatorio-parecer-area__descricao">
                Decisão justificada da etapa de TI e histórico das solicitações de informação trocadas com o usuário.
              </p>
            </div>
          </div>

          <div className="relatorio-parecer-area__lista">
            {(workflow?.steps || []).filter((step) => /\bTI\b/i.test(step.roleName)).length > 0 ?
              (workflow?.steps || []).filter((step) => /\bTI\b/i.test(step.roleName)).map((step) => {
                const status = getStepStatusDetails(step);
                return (
                  <article key={step.stepNumber} className="relatorio-parecer-card">
                    <div className="relatorio-parecer-card__topo">
                      <div>
                        <span className="relatorio-parecer-card__etapa">Etapa {step.stepNumber}</span>
                        <h4 className="relatorio-parecer-card__responsavel">{step.roleName}</h4>
                      </div>
                      <span className={`relatorio-parecer-card__status relatorio-parecer-card__status--${status.variante}`}>
                        {status.badgeText}
                      </span>
                    </div>

                    <div className="relatorio-parecer-card__metadados">
                      <div>
                        <span>Responsável</span>
                        <strong>{step.assignedUserName || "Não identificado"}</strong>
                      </div>
                      <div>
                        <span>Registro da decisão</span>
                        <strong>{formatarDataHora(step.decidedAt)}</strong>
                      </div>
                    </div>

                    <div className="relatorio-parecer-card__parecer">
                      <span className="relatorio-parecer-card__parecer-label">Parecer justificado</span>
                      <p>{obterParecerJustificado(step.comment)}</p>
                    </div>
                  </article>
                );
              }) :
              <div className="relatorio-parecer-vazio">
                <Cpu size={22} />
                <div>
                  <strong>Parecer da TI ainda não disponível</strong>
                  <p>Quando a etapa de TI registrar sua decisão, a justificativa será apresentada aqui.</p>
                </div>
              </div>
            }
          </div>

          <section className="relatorio-ti-conversas">
            <div className="relatorio-ti-conversas__cabecalho">
              <div>
                <span className="relatorio-parecer-area__rotulo">Interações da etapa</span>
                <h4>Mensagens entre TI e usuário</h4>
              </div>
              {!carregandoInteracoesTiRelatorio && !erroInteracoesTiRelatorio &&
                <span className="relatorio-ti-conversas__contador">
                  {interacoesTiRelatorio.length} {interacoesTiRelatorio.length === 1 ? "rodada" : "rodadas"}
                </span>
              }
            </div>

            {carregandoInteracoesTiRelatorio &&
              <div className="relatorio-ti-conversas__estado">Carregando mensagens...</div>
            }

            {!carregandoInteracoesTiRelatorio && erroInteracoesTiRelatorio &&
              <div className="relatorio-ti-conversas__estado relatorio-ti-conversas__estado--erro">
                {erroInteracoesTiRelatorio}
              </div>
            }

            {!carregandoInteracoesTiRelatorio && !erroInteracoesTiRelatorio && interacoesTiRelatorio.length === 0 &&
              <div className="relatorio-ti-conversas__estado">
                Nenhuma solicitação de informação foi registrada entre a TI e o usuário.
              </div>
            }

            {!carregandoInteracoesTiRelatorio && !erroInteracoesTiRelatorio && interacoesTiRelatorio.map((interacao) => (
              <article key={interacao.id} className="relatorio-ti-rodada">
                <div className="relatorio-ti-rodada__cabecalho">
                  <div>
                    <span>Rodada {interacao.numeroRodada}</span>
                    <strong>{interacao.solicitadoPorNome || "Equipe de TI"}</strong>
                  </div>
                  <div className="relatorio-ti-rodada__status">
                    <span className={`relatorio-ti-rodada__badge ${interacao.status === "respondida" ? "relatorio-ti-rodada__badge--respondida" : ""}`}>
                      {interacao.status === "respondida" ? "Respondida" : "Aguardando resposta"}
                    </span>
                    <small>{formatarDataHora(interacao.criadoEm)}</small>
                  </div>
                </div>

                <div className="relatorio-ti-rodada__mensagens">
                  {interacao.perguntas.map((pergunta) => (
                    <div key={pergunta.id} className="relatorio-ti-dialogo">
                      <div className="relatorio-ti-mensagem relatorio-ti-mensagem--ti">
                        <div className="relatorio-ti-mensagem__autor">
                          <span>TI</span>
                          <strong>{interacao.solicitadoPorNome || "Equipe de TI"}</strong>
                        </div>
                        <p>{pergunta.pergunta}</p>
                      </div>

                      {pergunta.resposta ?
                        <div className="relatorio-ti-mensagem relatorio-ti-mensagem--usuario">
                          <div className="relatorio-ti-mensagem__autor">
                            <span>Usuário</span>
                            <strong>{record.responsavelPreenchimento || "Solicitante"}</strong>
                            {pergunta.respondidaEm && <small>{formatarDataHora(pergunta.respondidaEm)}</small>}
                          </div>
                          <p>{pergunta.resposta}</p>
                        </div> :
                        <div className="relatorio-ti-mensagem relatorio-ti-mensagem--pendente">
                          <p>Aguardando resposta do usuário.</p>
                        </div>
                      }
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
        }

        {/* ABA RELATÓRIO — O MESMO PDF ESTRUTURADO USADO NO DOWNLOAD */}
        {activeTab === "relatorio" &&
        <section className="relatorio-pdf-painel" aria-labelledby="relatorio-pdf-titulo">
          <header className="relatorio-pdf-painel__cabecalho">
            <div className="relatorio-pdf-painel__cabecalho-icone" aria-hidden="true">
              <FileCheck2 size={22} />
            </div>

            <div className="relatorio-pdf-painel__cabecalho-conteudo">
              <span className="relatorio-pdf-painel__sobretitulo">RELATÓRIO DE AVALIAÇÃO</span>
              <h2 id="relatorio-pdf-titulo">Documento estruturado da IA</h2>
              <p>
                O relatório utiliza um template fixo e protegido. Os dados da solicitação apenas preenchem os campos definidos,
                preservando a estrutura do documento.
              </p>
            </div>

            <div className={`relatorio-pdf-painel__status ${pdfErro ? "relatorio-pdf-painel__status--erro" : ""}`}>
              {pdfPreparando ? <Activity size={15} /> : pdfErro ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>{pdfPreparando ? "Preparando documento" : pdfErro ? "Falha ao preparar" : "Documento pronto"}</span>
            </div>
          </header>

          <div className="relatorio-pdf-painel__metadados">
            <div>
              <span>IA avaliada</span>
              <strong>{record.nomeFerramenta || "Inteligência Artificial"}</strong>
            </div>
            <div>
              <span>Protocolo</span>
              <strong>{record.id}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{statusGeral}</strong>
            </div>
            <div>
              <span>Última atualização</span>
              <strong>{formatarDataHora(record.updatedAt || record.createdAt)}</strong>
            </div>
          </div>

          <div className="relatorio-pdf-painel__visualizacao">
            {pdfPreparando &&
            <div className="relatorio-pdf-painel__estado">
              <Activity size={26} />
              <strong>Preparando relatório estruturado...</strong>
              <p>Os campos do documento estão sendo preenchidos com os dados atuais da solicitação.</p>
            </div>}

            {!pdfPreparando && pdfErro &&
            <div className="relatorio-pdf-painel__estado relatorio-pdf-painel__estado--erro">
              <AlertTriangle size={26} />
              <strong>Não foi possível carregar a visualização</strong>
              <p>{pdfErro}</p>
            </div>}

            {!pdfPreparando && !pdfErro && pdfUrl &&
            <iframe
              className="relatorio-pdf-painel__iframe"
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Relatório estruturado de ${record.nomeFerramenta || "IA"}`}
            />}
          </div>

          <footer className="relatorio-pdf-painel__rodape-acoes">
            <div className="relatorio-pdf-painel__seguranca">
              <Lock size={15} />
              <span>
                Template fixo • margens protegidas • campos aninhados • conteúdo vinculado à solicitação
              </span>
            </div>

            <div className="relatorio-pdf-painel__acoes">
              <button
                type="button"
                onClick={handleVisualizarPDF}
                disabled={pdfPreparando || !pdfUrl || !!pdfErro}
                className="relatorio-pdf-painel__botao relatorio-pdf-painel__botao--secundario"
              >
                <ExternalLink size={16} />
                Abrir em nova guia
              </button>

              <button
                type="button"
                id="btnBaixarPdf"
                onClick={handleDownloadPDF}
                disabled={pdfPreparando || !pdfUrl || !!pdfErro}
                className="relatorio-pdf-painel__botao relatorio-pdf-painel__botao--primario"
              >
                <Download size={16} />
                {pdfPreparando ? "Preparando..." : "Baixar PDF"}
              </button>
            </div>
          </footer>
        </section>
        }

      </div>
    </div>);

}
