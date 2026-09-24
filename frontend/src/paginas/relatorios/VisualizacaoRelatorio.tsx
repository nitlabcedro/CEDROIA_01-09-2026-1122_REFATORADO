/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  Activity,
  FileText,
  Info,
  Target,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Clock3,
  Landmark,
  WalletCards,
  Lock,
  FileCheck2,
  ExternalLink } from
"lucide-react";
import { IARecord, ApprovalWorkflow, ApprovalConfig, SolicitacaoInformacoesTI } from "@/tipos";
import { IconeIA } from "@/componentes/comuns/IconeIA";
import { listarInteracoesTI } from "@/servicos/interacoes-ti";
import { obterWorkflowRelatorio } from "@/servicos/workflow-relatorio";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";
import {
  obterStatusGeralDoRegistro,
  obterVarianteStatus,
  type StatusGeral,
  type VarianteStatusGeral,
} from "@/utilitarios/status-solicitacao";
import { montarDadosRelatorioPdf } from "./pdf/dadosRelatorioPdf";
import {
  ABAS_RELATORIO_IA,
  ESTRUTURA_ABAS_RELATORIO_SEGMENTADO,
  ESTRUTURA_FLUXO_APROVACAO_CARD,
  ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL,
  extrairTextoParecerPeriodoTeste,
  formatarDataRelatorio,
  obterDetalhesStatusEtapaRelatorio,
  obterEtapasWorkflowPorNumero,
  obterRotuloEtapaFluxo,
  type AbaRelatorioId,
} from "./relatorioVisao.util";
import "./RelatorioDetalhes.css";
import "./RelatorioPdfPainel.css";


interface ReportViewProps {
  record: IARecord;
  onBack: () => void;
  onEdit?: (record: IARecord) => void;
  isAdmin?: boolean;
  workflows?: ApprovalWorkflow[];
  approvalConfig?: ApprovalConfig;
}

type TabType = AbaRelatorioId;

const ICONES_ABAS_RELATORIO: Record<TabType, React.ComponentType<{ size?: number; className?: string }>> = {
  "visao-geral": Info,
  "finalidade-uso": Target,
  nit: ShieldCheck,
  ti: Cpu,
  "periodo-teste": Clock3,
  presidencia: Landmark,
  financeiro: WalletCards,
  relatorio: FileText,
};

// helper to format comment text
const formatComment = (commentRaw?: string, stepNumber?: number) => {
  if (!commentRaw) return [<p key="empty" className="relatorio__descricao-nenhum-detalhe-adicional-forne">Nenhum detalhe adicional fornecido.</p>];

  if (stepNumber === 3) {
    const textoParecer = extrairTextoParecerPeriodoTeste(commentRaw);
    if (!textoParecer) {
      return [<p key="empty" className="relatorio__descricao-nenhum-detalhe-adicional-forne">Nenhum detalhe adicional fornecido.</p>];
    }
    return [<p key="periodo-teste">{textoParecer}</p>];
  }

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

      // O nome da etapa já está no cabeçalho do painel/card.
      if (key.toLowerCase() === "etapa") return null;

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

export default function ReportView({ record, onBack, workflows, approvalConfig }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("visao-geral");
  const [interacoesTiRelatorio, setInteracoesTiRelatorio] = useState<SolicitacaoInformacoesTI[]>([]);
  const [carregandoInteracoesTiRelatorio, setCarregandoInteracoesTiRelatorio] = useState(false);
  const [erroInteracoesTiRelatorio, setErroInteracoesTiRelatorio] = useState("");
  const [workflowDetalhado, setWorkflowDetalhado] = useState<ApprovalWorkflow | null>();
  const [carregandoWorkflowDetalhado, setCarregandoWorkflowDetalhado] = useState(true);
  const [erroWorkflowDetalhado, setErroWorkflowDetalhado] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("relatorio-cedro-ia.pdf");
  const [pdfPreparando, setPdfPreparando] = useState(true);
  const [pdfErro, setPdfErro] = useState("");

  const workflowEmMemoria = useMemo(
    () => workflows?.find((item) => item.iaRecordId === record.id),
    [workflows, record.id],
  );
  const workflow = workflowDetalhado ?? workflowEmMemoria;
  const etapasWorkflow = useMemo(
    () => [...(workflow?.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber),
    [workflow],
  );

  useEffect(() => {
    let ativo = true;
    setWorkflowDetalhado(undefined);
    setCarregandoWorkflowDetalhado(true);
    setErroWorkflowDetalhado("");

    obterWorkflowRelatorio(record.id)
      .then((workflowOficial) => {
        if (ativo) setWorkflowDetalhado(workflowOficial);
      })
      .catch((error) => {
        console.error("Erro ao carregar workflow oficial no relatório:", error);
        if (ativo) {
          setWorkflowDetalhado(null);
          setErroWorkflowDetalhado(obterMensagemErroUsuario(error, "aprovacao"));
        }
      })
      .finally(() => {
        if (ativo) setCarregandoWorkflowDetalhado(false);
      });

    return () => {
      ativo = false;
    };
  }, [record.id]);

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
        const { gerarRelatorioPdfEstruturado } = await import("./pdf/gerarRelatorioPdf");
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

  const mapVarianteCss = (variante: VarianteStatusGeral) => {
    switch (variante) {
      case "aprovada": return "aprovado";
      case "teste": return "teste";
      case "cancelada": return "cancelado";
      case "negada": return "negado";
      default: return "avaliacao";
    }
  };

  const getStatusCssVariant = () => mapVarianteCss(obterVarianteStatus(statusGeral));

  const getStatusColor = () =>
    `relatorio-status relatorio-status--${getStatusCssVariant()}`;

  const renderEtapaWorkflow = (
    stepNumber: number,
    titulo: string,
    rotuloParecer: string,
    Icone: React.ComponentType<{ size?: number; className?: string }>,
    varianteIcone?: string,
  ) => {
    const etapas = obterEtapasWorkflowPorNumero(workflow?.steps, stepNumber);

    return (
      <div className="relatorio-parecer-area">
        <div className="relatorio-parecer-area__cabecalho">
          <div className={`relatorio-parecer-area__icone ${varianteIcone || ""}`.trim()}>
            <Icone size={19} />
          </div>
          <h3 className="relatorio-parecer-area__titulo">{titulo}</h3>
        </div>

        <div className="relatorio-parecer-area__lista">
          {etapas.length > 0 ? etapas.map((step) => {
            const status = obterDetalhesStatusEtapaRelatorio(step, currentStepNum, isWfFinished);
            const temResponsavel = Boolean(step.assignedUserName?.trim());
            const temDataDecisao = Boolean(step.decidedAt);
            const temParecer = Boolean(step.comment?.trim());

            return (
              <article key={step.stepNumber} className="relatorio-parecer-card">
                <div className="relatorio-parecer-card__topo">
                  <span className="relatorio-parecer-card__decisao">Decisão da etapa</span>
                  <span className={`relatorio-parecer-card__status relatorio-parecer-card__status--${status.variante}`}>
                    {status.badgeText}
                  </span>
                </div>

                {(temResponsavel || temDataDecisao) &&
                  <div className="relatorio-parecer-card__metadados">
                    {temResponsavel &&
                      <div>
                        <span>Responsável</span>
                        <strong>{step.assignedUserName}</strong>
                      </div>
                    }
                    {temDataDecisao &&
                      <div>
                        <span>Data da decisão</span>
                        <strong>{formatarDataHora(step.decidedAt)}</strong>
                      </div>
                    }
                  </div>
                }

                {temParecer &&
                  <div className="relatorio-parecer-card__parecer">
                    <span className="relatorio-parecer-card__parecer-label">{rotuloParecer}</span>
                    <div className="relatorio-parecer-card__conteudo">
                      {formatComment(step.comment, step.stepNumber)}
                    </div>
                  </div>
                }
              </article>
            );
          }) :
            <div className="relatorio-parecer-vazio">
              <Icone size={22} />
              <div>
                <strong>
                  {carregandoWorkflowDetalhado
                    ? "Carregando dados da etapa"
                    : erroWorkflowDetalhado
                      ? "Não foi possível carregar os dados da etapa"
                      : "Dados da etapa ainda não disponíveis"}
                </strong>
                <p>
                  {carregandoWorkflowDetalhado
                    ? "Consultando o workflow oficial."
                    : erroWorkflowDetalhado || "Esta etapa não existe no workflow da solicitação."}
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    );
  };

  return (
    <div
      id="relatorio-conteudo"
      data-componente="pagina-relatorio"
      className="pagina-relatorio relatorio-container cedro-page-premium relatorio-detalhes">
      <header className="relatorio-detalhes__cabecalho">
        <button type="button" onClick={onBack} className="relatorio-detalhes__voltar">
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar para Minhas IAs
        </button>

        <div className="relatorio-detalhes__titulo-linha">
          <div className="relatorio-detalhes__identidade">
            <IconeIA nome={record.nomeFerramenta} tamanho={40} />
            <h1 className="relatorio-detalhes__titulo">{record.nomeFerramenta}</h1>
          </div>
          <div className={`relatorio-detalhes__status ${getStatusColor()}`}>
            <div className="relatorio-status__ponto" />
            <span>{statusGeral}</span>
          </div>
        </div>

        <p className="relatorio-detalhes__setor">
          Setor: <strong>{record.unidadeSetor || "—"}</strong>
        </p>
      </header>

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
                          {formatComment(step.comment, step.stepNumber)}
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

      <section
        className="relatorio-detalhes__fluxo-card"
        data-estrutura={ESTRUTURA_FLUXO_APROVACAO_CARD}
        aria-labelledby="relatorio-etapas-titulo">
        <h2 id="relatorio-etapas-titulo" className="relatorio-detalhes__fluxo-titulo">
          Etapas de aprovação
        </h2>
        <div className="relatorio-detalhes__fluxo-scroll">
          <ol
            className="relatorio-detalhes__fluxo"
            data-estrutura={ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL}>
            {etapasWorkflow.length > 0 ? etapasWorkflow.map((step) => {
              const details = obterDetalhesStatusEtapaRelatorio(step, currentStepNum, isWfFinished);
              const signerName = step.assignedUserName || "Aprovação livre";

              return (
                <li
                  key={step.stepNumber}
                  className={`relatorio-detalhes__fluxo-etapa relatorio-detalhes__fluxo-etapa--${details.variante}`}>
                  <div className="relatorio-detalhes__fluxo-circulo" aria-hidden="true">
                    {details.iconSymbol}
                  </div>
                  <span className="relatorio-detalhes__fluxo-nome">
                    {obterRotuloEtapaFluxo(step.stepNumber)}
                  </span>
                  <span className="relatorio-detalhes__fluxo-badge">{details.badgeText}</span>
                  <span className="relatorio-detalhes__fluxo-resp-label">Responsável</span>
                  <span className="relatorio-detalhes__fluxo-resp-nome">{signerName}</span>
                </li>
              );
            }) :
              <li className="relatorio-detalhes__fluxo-estado">
                {carregandoWorkflowDetalhado
                  ? "Carregando etapas do workflow..."
                  : erroWorkflowDetalhado || "Workflow não disponível para esta solicitação."}
              </li>
            }
          </ol>
        </div>
      </section>

      <nav
        className="cedro-segment-nav cedro-segment-nav--largo"
        data-estrutura={ESTRUTURA_ABAS_RELATORIO_SEGMENTADO}
        aria-label="Seções do relatório"
      >
        <div className="cedro-segment-nav__grupo cedro-segment-nav__grupo--rolagem" role="tablist">
          {ABAS_RELATORIO_IA.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icone = ICONES_ABAS_RELATORIO[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`cedro-segment-nav__item ${isActive ? "cedro-segment-nav__item--ativo" : ""}`}
              >
                <Icone size={15} className="cedro-segment-nav__item-icone" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="relatorio-detalhes__conteudo-abas relatorio__grupo-35">
        
        {/* TAB 1: RESUMO / VISÃO GERAL */}
        {activeTab === "visao-geral" &&
        <div className="relatorio-detalhes__ficha">
            <h2 className="relatorio-detalhes__ficha-titulo">Ficha técnica</h2>

            <div className="relatorio-detalhes__ficha-grade">
              <section className="relatorio-detalhes__ficha-bloco" aria-labelledby="relatorio-ficha-identidade">
                <h3 id="relatorio-ficha-identidade" className="relatorio-detalhes__ficha-bloco-titulo">
                  Identidade
                </h3>
                <div className="relatorio-detalhes__linha">
                  <span className="relatorio-detalhes__linha-label">Nome da ferramenta</span>
                  <p className="relatorio-detalhes__linha-valor">{record.nomeFerramenta || "Não preenchido"}</p>
                </div>
                <div className="relatorio-detalhes__linha">
                  <span className="relatorio-detalhes__linha-label">Descrição da atividade</span>
                  <p className="relatorio-detalhes__linha-valor">{record.descricaoAtividade || "Não preenchido"}</p>
                </div>
                <div
                  className={`relatorio-detalhes__linha ${
                    !record.fornecedor || record.fornecedor.toLowerCase() === "interno" ?
                    "relatorio-detalhes__linha--ultima" :
                    ""}`
                  }>
                  <span className="relatorio-detalhes__linha-label">Tipo de IA</span>
                  <div className="relatorio-detalhes__linha-valor">
                    <div className="relatorio-detalhes__chips">
                      {record.tipoIA && record.tipoIA.length > 0 ?
                        record.tipoIA.map((t, idx) =>
                          <span key={idx} className="relatorio-detalhes__chip">{t}</span>
                        ) :
                        <span>Não preenchido</span>
                      }
                    </div>
                  </div>
                </div>
                {record.fornecedor && record.fornecedor.toLowerCase() !== "interno" &&
                  <div className="relatorio-detalhes__linha relatorio-detalhes__linha--ultima">
                    <span className="relatorio-detalhes__linha-label">Fornecedor</span>
                    <p className="relatorio-detalhes__linha-valor">{record.fornecedor}</p>
                  </div>
                }
              </section>

              <section className="relatorio-detalhes__ficha-bloco" aria-labelledby="relatorio-ficha-solicitacao">
                <h3
                  id="relatorio-ficha-solicitacao"
                  className="relatorio-detalhes__ficha-bloco-titulo relatorio-detalhes__ficha-bloco-titulo--azul">
                  Solicitação
                </h3>
                <div className="relatorio-detalhes__linha">
                  <span className="relatorio-detalhes__linha-label">Solicitante</span>
                  <p className="relatorio-detalhes__linha-valor">{record.responsavelPreenchimento || "Não preenchido"}</p>
                </div>
                <div className="relatorio-detalhes__linha">
                  <span className="relatorio-detalhes__linha-label">Setor requisitante</span>
                  <p className="relatorio-detalhes__linha-valor">{record.unidadeSetor || "Não preenchido"}</p>
                </div>
                <div className="relatorio-detalhes__linha">
                  <span className="relatorio-detalhes__linha-label">Responsável técnico</span>
                  <p className="relatorio-detalhes__linha-valor">
                    {record.responsavelPreenchimento || "Não preenchido"}
                    {record.cargo ? ` · ${record.cargo}` : ""}
                  </p>
                </div>
                <div className="relatorio-detalhes__linha relatorio-detalhes__linha--ultima">
                  <span className="relatorio-detalhes__linha-label">Data de cadastro</span>
                  <p className="relatorio-detalhes__linha-valor">
                    {formatarDataRelatorio(record.dataRegistro) || "Não preenchido"}
                  </p>
                </div>
              </section>
            </div>
          </div>
        }

        {/* TAB 2: USO DA IA — DADOS DA ETAPA 2 (OBJETIVO) DA NOVA SOLICITAÇÃO */}
        {activeTab === "finalidade-uso" &&
        <div className="relatorio-uso-ia">
          <div className="relatorio-uso-ia__cabecalho">
            <div className="relatorio-uso-ia__icone">
              <Target size={19} />
            </div>
            <div>
              <h3 className="relatorio-uso-ia__titulo">Finalidade e Objetivos</h3>
            </div>
          </div>

          <section className="relatorio-uso-ia__card relatorio-uso-ia__card--destaque">
            <div className="relatorio-uso-ia__card-cabecalho">
              <span className="relatorio-uso-ia__campo-rotulo">Onde e como a IA será utilizada</span>
            </div>
            <p className={`relatorio-uso-ia__texto ${!record.descricaoAtividade ? "relatorio-uso-ia__texto--vazio" : ""}`}>
              {record.descricaoAtividade || "Não preenchido"}
            </p>
          </section>

          <div className="relatorio-uso-ia__grade">
            <section className="relatorio-uso-ia__card">
              <div className="relatorio-uso-ia__card-cabecalho">
                <span className="relatorio-uso-ia__campo-rotulo">Utilizações selecionadas</span>
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
                <span className="relatorio-uso-ia__campo-rotulo">Benefícios e resultados esperados</span>
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
          renderEtapaWorkflow(1, "NIT", "Parecer e dados da etapa", ShieldCheck)
        }

        {/* TAB 4: PARECER E INTERAÇÕES DA TI */}
        {activeTab === "ti" &&
        <div className="relatorio-parecer-area">
          {renderEtapaWorkflow(2, "TI", "Análise técnica, parecer e dados da etapa", Cpu, "relatorio-parecer-area__icone--ti")}

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

        {/* TAB 5: PERÍODO DE TESTE */}
        {activeTab === "periodo-teste" &&
          renderEtapaWorkflow(3, "Período de Teste", "Informações registradas durante a etapa", Clock3)
        }

        {/* TAB 6: PRESIDÊNCIA */}
        {activeTab === "presidencia" &&
          renderEtapaWorkflow(4, "Presidência", "Parecer e justificativa", Landmark)
        }

        {/* TAB 7: DIREÇÃO FINANCEIRA */}
        {activeTab === "financeiro" &&
          renderEtapaWorkflow(5, "Financeiro", "Parecer, justificativa e informações financeiras", WalletCards)
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
