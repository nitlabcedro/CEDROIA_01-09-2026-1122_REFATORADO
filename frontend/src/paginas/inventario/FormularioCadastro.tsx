/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import React, { useState, useEffect } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import { IconeIA } from "@/componentes/comuns/IconeIA";
import {
  Save, X, Info, AlertTriangle, Zap, Database, Share2, ClipboardCheck, Scale, FileText, ChevronRight,
  Check, UserRound, Clock3, Bookmark
} from "lucide-react";
import { motion } from "framer-motion";
import {
  StatusAuditoria,
  IARecord, TiposIA, ObjetivosIA, EtapaProcesso, StatusUso } from
"@/tipos";
import { generateId, getGlobalRecords, getSectors } from "@/servicos/armazenamento";
import { obterCargosDoSetor } from "@/servicos/setores";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";

import { useAuth } from "@/contextos/ContextoAutenticacao";

interface RegistrationFormProps {
  initialData?: IARecord | null;
  /** Registros já carregados pelo app — evita nova consulta a registros_ia só para gerar protocolo. */
  existingRecords?: IARecord[];
  onSave: (record: IARecord) => Promise<void> | void;
  onCancel: () => void;
  isAdmin?: boolean;
}

// ... helper components defined outside to prevent re-mounting focus loss issues ...
const BadgePerfil = () =>
<span className="cadastro__texto-perfil">
    👤 Perfil
  </span>;


const BadgeAutomatico = () =>
<span className="cadastro__texto-automatico">
    ⚙️ Automático
  </span>;


const getInputClass = (val: any, disabled?: boolean) => {
  const preenchido = Array.isArray(val) ? val.length > 0 : Boolean(val);
  return [
    "cadastro-campo",
    disabled ? "cadastro-campo--bloqueado" : "cadastro-campo--editavel",
    preenchido ? "cadastro-campo--preenchido" : "cadastro-campo--vazio",
  ].join(" ");
};

const InputGroup = ({
  label,
  required,
  children,
  infoAction,
  badge






}: {label: string;required?: boolean;children: React.ReactNode;infoAction?: React.ReactNode;badge?: React.ReactNode;}) =>
<div className="cadastro-campo-grupo grupo-interativo cadastro__cadastro-campo-grupo-estrutura">
    <div className="cadastro__grupo">
      <label className="cadastro__rotulo">
        <div className="cadastro__grupo-2"></div>
        <span>{label}</span>
        {required && <span className="cadastro__texto">*</span>}
        {badge}
      </label>
      {infoAction}
    </div>
    {children}
  </div>;


const RadioGroup = ({
  label,
  value,
  options,
  onChange,
  required,
  onInfoClick







}: {label: string;value: string;options: string[];onChange: (val: string) => void;required?: boolean;onInfoClick?: () => void;}) =>
<InputGroup
  label={label}
  required={required}
  infoAction={onInfoClick ?
  <button
    type="button"
    onClick={onInfoClick}
    className="cadastro__botao-explicar"
    title="Explicar">
    
        <span className="cadastro__texto-explicacao">Explicação</span>
      </button> :
  null}>
  
    <div className="cadastro__grupo-3">
      {options.map((opt) =>
    <button
      key={opt}
      type="button"
      onClick={() => onChange(opt)}
      className={`cadastro__botao ${
      value === opt ?
      "cadastro__botao-2" :
      "cadastro__botao-3"}`
      }>
      
          {opt}
        </button>
    )}
    </div>
  </InputGroup>;


const CheckboxGroup = ({
  label,
  value,
  options,
  onToggle,
  required,
  onInfoClick







}: {label: string;value: string[];options: string[];onToggle: (val: string) => void;required?: boolean;onInfoClick?: () => void;}) =>
<InputGroup
  label={label}
  required={required}
  infoAction={onInfoClick ?
  <button
    type="button"
    onClick={onInfoClick}
    className="cadastro__botao-explicar"
    title="Explicar tipos de IA">
    
        <span className="cadastro__texto-explicacao">Explicação</span>
      </button> :
  null}>
  
    <div className="cadastro__grupo-3">
      {options.map((opt) => {
      const isSelected = value.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`cadastro__botao ${
          isSelected ?
          "cadastro__botao-2" :
          "cadastro__botao-3"}`
          }>
          
            {opt}
          </button>);

    })}
    </div>
  </InputGroup>;


const TextArea = ({
  label,
  value,
  onChange,
  required,
  placeholder,
  className







}: {label: string;value: string;onChange: (val: string) => void;required?: boolean;placeholder?: string;className?: string;}) => {
  const combinedClass = `cadastro-campo cadastro-campo--textarea ${value ? "cadastro-campo--preenchido" : "cadastro-campo--vazio"}`;
  return (
    <InputGroup label={label} required={required}>
      <textarea
        className={combinedClass}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} />
      
    </InputGroup>);

};

export default function RegistrationForm({ initialData, existingRecords = [], onSave, onCancel, isAdmin }: RegistrationFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<Partial<IARecord>>({
    id: "",
    unidadeSetor: "",
    responsavelPreenchimento: "",
    cargo: "",
    dataRegistro: new Date().toISOString().split('T')[0],
    utilizaIA: "Sim",
    nomeFerramenta: "",
    fornecedor: "",
    versao: "",
    tipoIA: [],
    descricaoAtividade: "",
    objetivos: [],
    etapaProcesso: EtapaProcesso.OUTRO,
    beneficiosEsperados: "",
    integradaSistemaInterno: "Não",
    impactoResultadosLaboratoriais: "Não",
    validacaoHumana: "Sim",
    politicaInterna: "Não",
    treinamentoColaboradores: "Não",
    documentacaoTecnica: "Não se aplica",
    statusUso: StatusUso.EM_AVALIACAO,
    statusAuditoria: StatusAuditoria.PENDENTE,
    necessitaPlanoAcao: "Não",
    areaAvaliadora: ["NIT"]
  });

  const [activeSection, setActiveSection] = useState(0);
  const [showTypeIAPopup, setShowTypeIAPopup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [cargosDisponiveis, setCargosDisponiveis] = useState<string[]>([]);
  const [outroActive, setOutroActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");

  useEffect(() => {
    if (!showTypeIAPopup) return;

    const fecharPopupComEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowTypeIAPopup(false);
    };

    window.addEventListener("keydown", fecharPopupComEscape);
    return () => window.removeEventListener("keydown", fecharPopupComEscape);
  }, [showTypeIAPopup]);

  useEffect(() => {
    const fetchSectors = async () => {
      const list = await getSectors();
      setSectors(list);
    };
    fetchSectors();
  }, []);

  useEffect(() => {
    const currentSector = formData.unidadeSetor;
    if (!currentSector) {
      setCargosDisponiveis([]);
      return;
    }

    const loadCargos = async () => {
      setCargosDisponiveis(await obterCargosDoSetor(currentSector));
    };
    loadCargos();
  }, [formData.unidadeSetor]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      const presets = ["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok"];
      if (initialData.nomeFerramenta && !presets.includes(initialData.nomeFerramenta)) {
        setOutroActive(true);
      } else {
        setOutroActive(false);
      }
    } else if (!isInitialized && profile) {
      const fetchAndSetId = async () => {
        const records = existingRecords.length > 0 ? existingRecords : await getGlobalRecords();

        try {
          const savedDraft = localStorage.getItem(`${CHAVES_ARMAZENAMENTO_LOCAL.RASCUNHO_SOLICITACAO_PREFIXO}${profile.id}`);
          if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            if (parsed?.formData && typeof parsed.formData === "object") {
              const restored = { ...parsed.formData };
              // Observações iniciais foram removidas da Nova Solicitação.
              delete restored.observacoesGerais;
              delete restored.observacoesGeraisOriginais;
              const restoredName = String(restored.nomeFerramenta || "");
              const presets = ["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok"];
              setFormData((prev) => ({
                ...prev,
                ...restored,
                id: restored.id || generateId(records),
                dataRegistro: restored.dataRegistro || new Date().toISOString().split("T")[0]
              }));
              setOutroActive(Boolean(restoredName && !presets.includes(restoredName)));
              const legacySection = Number(parsed.activeSection) || 0;
              setActiveSection(legacySection >= 2 ? 1 : 0);
              setIsInitialized(true);
              return;
            }
          }
        } catch (draftError) {
          console.warn("Não foi possível restaurar o rascunho local:", draftError);
        }

        const sList = (profile.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
        const cList = (profile.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);
        const defaultSetor = sList[0] || "";
        const defaultCargo = cList[0] || "";

        setFormData((prev) => ({
          ...prev,
          id: generateId(records),
          unidadeSetor: defaultSetor || prev.unidadeSetor || "",
          responsavelPreenchimento: profile.full_name || prev.responsavelPreenchimento || "",
          cargo: defaultCargo || prev.cargo || "",
          dataRegistro: prev.dataRegistro || new Date().toISOString().split('T')[0]
        }));
        setOutroActive(false);
        setIsInitialized(true);
      };
      fetchAndSetId();
    }
  }, [initialData, profile, isInitialized, existingRecords]);

  useEffect(() => {
    if (initialData || !profile || !isInitialized) return;

    const sList = (profile.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
    const cList = (profile.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);
    const defaultSetor = sList[0] || "";
    const defaultCargo = cList[0] || "";

    setFormData((prev) => ({
      ...prev,
      unidadeSetor: prev.unidadeSetor || defaultSetor,
      responsavelPreenchimento: profile.full_name || prev.responsavelPreenchimento || "",
      cargo: prev.cargo || defaultCargo,
      dataRegistro: prev.dataRegistro || new Date().toISOString().split("T")[0]
    }));
  }, [initialData, profile, isInitialized]);

  const isProfileIncompleteForStep1 = (() => {
    if (!profile || !profile.full_name || profile.full_name.trim() === "") return true;
    const sList = (profile.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
    const cList = (profile.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);
    return sList.length === 0 || cList.length === 0;
  })();

  const isStep1Incomplete = !formData.unidadeSetor ||
  formData.unidadeSetor.trim() === "" ||
  formData.unidadeSetor.trim() === "Não definido" ||
  formData.unidadeSetor.trim() === "Nao definido" ||
  !formData.responsavelPreenchimento ||
  formData.responsavelPreenchimento.trim() === "" ||
  !formData.cargo ||
  formData.cargo.trim() === "" ||
  formData.cargo.trim() === "Colaborador" ||
  formData.cargo.trim() === "Não definido" ||
  formData.cargo.trim() === "Não informado" ||
  !formData.dataRegistro ||
  formData.dataRegistro.trim() === "";

  const isStep2Incomplete = !formData.nomeFerramenta ||
  formData.nomeFerramenta.trim() === "";

  const isStep3Incomplete = !formData.descricaoAtividade ||
  formData.descricaoAtividade.trim() === "" ||
  !formData.objetivos ||
  formData.objetivos.length === 0 ||
  formData.objetivos.includes(ObjetivosIA.OUTRO) && (!formData.objetivoOutro || formData.objetivoOutro.trim() === "") ||
  !formData.beneficiosEsperados ||
  formData.beneficiosEsperados.trim() === "";

  const updateField = (field: keyof IARecord, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: "tipoIA" | "objetivos" | "areaAvaliadora", value: any) => {
    const current = formData[field] as any[] || [];
    const newVal = current.includes(value) ?
    current.filter((v) => v !== value) :
    [...current, value];

    if (field === "objetivos") {
      setFormData((prev) => ({
        ...prev,
        objetivos: newVal,
        ...(newVal.includes(ObjetivosIA.OUTRO) ? {} : { objetivoOutro: "" })
      }));
    } else {
      updateField(field, newVal);
    }
  };

  const sections = [
    { label: "Solução", subtitle: "Detalhes da solução de IA", icon: Zap },
    { label: "Objetivo", subtitle: "Propósito e benefícios", icon: Info }
  ];

  const phaseMeta = [
    {
      title: "Escolha da IA",
      description: "Selecione a inteligência artificial corporativa desejada.",
      icon: Zap
    },
    {
      title: "Objetivo da solicitação",
      description: "Descreva o uso da IA, selecione as utilizações e informe os benefícios esperados.",
      icon: Info
    }
  ];

  const visibleSections = sections;
  const draftStorageKey = `cedro_nova_solicitacao_draft_${profile?.id || "anon"}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Safety guard: only allow save if we are on the very last section (Phase 4: Observações e Envio)
    if (activeSection !== visibleSections.length - 1) {
      console.warn("Submit prevented: Not in the final section.", activeSection);
      return;
    }

    const nativeEvent = e.nativeEvent as any;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;

    if (submitter && submitter.getAttribute("data-action") !== "save-record") {
      return;
    }

    // Rule 5: Não permitir salvar a solicitação se a Etapa 1 estiver incompleta
    if (isStep1Incomplete || isProfileIncompleteForStep1) {
      alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
      return;
    }

    const cleanSector = (formData.unidadeSetor || "").trim();
    if (!cleanSector || cleanSector.toLowerCase() === "não definido" || cleanSector.toLowerCase() === "nao definido") {
      alert("Seu perfil precisa de um setor válido. Atualize em Meu Perfil antes de enviar a solicitação.");
      return;
    }
    if (isStep2Incomplete) {
      alert("Por favor, selecione ou informe o nome da IA (etapa Solução).");
      setActiveSection(0);
      return;
    }
    if (isStep3Incomplete) {
      alert("Por favor, preencha todos os campos obrigatórios da etapa Objetivo.");
      setActiveSection(1);
      return;
    }

    const now = new Date().toISOString();
    const history = formData.historico || [];

    // A Nova Solicitação não coleta mais observações iniciais.
    // Em edições de registros antigos, preservamos valores históricos existentes.
    const cleanObservacoesGerais = initialData ? (initialData.observacoesGerais || "").trim() : "";
    const originalObs = initialData
      ? (initialData.observacoesGeraisOriginais || initialData.observacoesGerais || "").trim()
      : "";

    const cleanNome = (formData.nomeFerramenta || "").trim() || `Solicitação de IA — ${cleanSector || "Geral"}`;
    const presets = ["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok"];
    const cleanTipoIA = presets.includes(cleanNome) ? [TiposIA.CHATBOT, TiposIA.IA_GENERATIVA] : [TiposIA.OUTRO];
    const cleanTipoIAOutro = presets.includes(cleanNome) ? "Atendimento automatizado" : cleanNome;

    setIsSaving(true);
    setSavingStep("Salvando registro de IA no Supabase...");

    try {
      await onSave({
        ...formData,
        nomeFerramenta: cleanNome,
        tipoIA: cleanTipoIA,
        tipoIAOutro: cleanTipoIAOutro,
        observacoesGerais: cleanObservacoesGerais,
        observacoesGeraisOriginais: originalObs,
        utilizaIA: formData.utilizaIA || "Sim",
        fornecedor: formData.fornecedor || "Interno",
        createdAt: initialData ? initialData.createdAt : now,
        updatedAt: now,
        historico: history
      } as IARecord);
      localStorage.removeItem(draftStorageKey);
    } catch (err: unknown) {
      console.error("Erro ao salvar solicitação de IA:", err);
      alert(obterMensagemErroUsuario(err, "inventario"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          formData: {
            ...formData,
            observacoesGerais: "",
            observacoesGeraisOriginais: ""
          },
          activeSection,
          outroActive,
          savedAt: new Date().toISOString()
        })
      );
      alert("Rascunho salvo neste navegador.");
    } catch (error) {
      console.error("Erro ao salvar rascunho local:", error);
      alert("Não foi possível salvar o rascunho neste navegador.");
    }
  };

  const handleCancelRegistration = () => {
    localStorage.removeItem(draftStorageKey);
    onCancel();
  };

  const handleStepNavigation = (targetIndex: number) => {
    if (isStep1Incomplete || isProfileIncompleteForStep1) {
      alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
      return;
    }
    if (targetIndex > 0 && isStep2Incomplete) {
      alert("Por favor, selecione ou informe o nome da IA (etapa Solução) antes de avançar.");
      return;
    }
    setActiveSection(targetIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent implicit submission when pressing Enter inside input fields
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT") {
        e.preventDefault();
      }
    }
  };

  const sharedInputClass = "cadastro-campo cadastro-campo--secundario";

  return (
    <div
      id="nova-solicitacao-conteudo"
      data-componente="pagina-nova-solicitacao"
      className="pagina-nova-solicitacao nova-solicitacao"
    >
      <section className="nova-solicitacao__cabecalho" aria-labelledby="nova-solicitacao-titulo">
        <div className="nova-solicitacao__cabecalho-texto">
          {/* <span className="nova-solicitacao__sobretitulo">Governança de IA</span> */}
          <h1 id="nova-solicitacao-titulo" className="nova-solicitacao__titulo">Nova Solicitação</h1>
          {/* <p className="nova-solicitacao__subtitulo">
            Registre uma nova solução de IA para avaliação pelo comitê de governança.
          </p> */}
        </div>
        <div className="nova-solicitacao__cabecalho-status">
          <span className="nova-solicitacao__status-rascunho">
            <Clock3 size={15} aria-hidden="true" />
            Rascunho
          </span>
          <span className="nova-solicitacao__protocolo">
            Protocolo: <strong>{formData.id || "Gerando..."}</strong>
          </span>
        </div>
      </section>

      <nav className="nova-solicitacao__etapas" aria-label="Etapas da nova solicitação">
        {visibleSections.map((sec, index) => {
          const concluida = index < activeSection;
          const ativa = index === activeSection;
          return (
            <React.Fragment key={sec.label}>
              <button
                type="button"
                className={`nova-solicitacao__etapa ${ativa ? "nova-solicitacao__etapa--ativa" : ""} ${concluida ? "nova-solicitacao__etapa--concluida" : ""}`}
                onClick={() => handleStepNavigation(index)}
                aria-current={ativa ? "step" : undefined}
              >
                <span className="nova-solicitacao__etapa-indicador">
                  {concluida ? <Check size={17} aria-hidden="true" /> : index + 1}
                </span>
                <span className="nova-solicitacao__etapa-texto">
                  <strong>{sec.label}</strong>
                  <small>{sec.subtitle}</small>
                </span>
              </button>
              {index < visibleSections.length - 1 && <span className="nova-solicitacao__etapa-linha" aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </nav>

      {(isProfileIncompleteForStep1 || isStep1Incomplete) && (
        <div className="nova-solicitacao__alerta-perfil nova-solicitacao__alerta-perfil--global" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            Os dados do solicitante serão preenchidos automaticamente com sua conta. Complete seu perfil (nome, setor e cargo) em Meu Perfil para continuar.
          </span>
        </div>
      )}

      <form
        id="formCadastroIA"
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="nova-solicitacao__formulario"
      >
        <div className="nova-solicitacao__conteudo">
          <div className="nova-solicitacao__principal">
            <header className="nova-solicitacao__secao-cabecalho">
              <span className="nova-solicitacao__secao-icone" aria-hidden="true">
                {React.createElement(phaseMeta[activeSection].icon, { size: 21 })}
              </span>
              <div>
                <h2>{phaseMeta[activeSection].title}</h2>
                <p>{phaseMeta[activeSection].description}</p>
              </div>
            </header>

            {activeSection === 0 && (
              <div className="nova-solicitacao__fase nova-solicitacao__fase--solucao">
                <p className="nova-solicitacao__instrucao-solucao">
                  Estas são as inteligências artificiais disponíveis para a escolha do solicitante. Selecione uma das opções abaixo ou marque <strong>“Outro”</strong> para digitar uma ferramenta diferente.
                </p>
                <div className="nova-solicitacao__grade-ias">
                  {["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok", "Outro"].map((name) => {
                    const isSelected = name === "Outro" ? outroActive : formData.nomeFerramenta === name && !outroActive;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`nova-solicitacao__ia-card ${isSelected ? "nova-solicitacao__ia-card--selecionada" : ""}`}
                        onClick={() => {
                          if (name === "Outro") {
                            setOutroActive(true);
                            updateField("nomeFerramenta", "");
                          } else {
                            setOutroActive(false);
                            updateField("nomeFerramenta", name);
                          }
                        }}
                      >
                        <IconeIA nome={name} tamanho={48} className="nova-solicitacao__ia-icone" />
                        <span>{name}</span>
                        {isSelected && <Check size={18} className="nova-solicitacao__ia-check" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                {outroActive && (
                  <div className="nova-solicitacao__outro">
                    <InputGroup label="Nome da inteligência artificial" required>
                      <input
                        id="campoNomeIA"
                        type="text"
                        className={getInputClass(formData.nomeFerramenta)}
                        value={formData.nomeFerramenta || ""}
                        onChange={(event) => updateField("nomeFerramenta", event.target.value)}
                        placeholder="Digite o nome da solução de IA"
                        required
                      />
                    </InputGroup>
                  </div>
                )}
              </div>
            )}

            {activeSection === 1 && (
              <div className="nova-solicitacao__fase nova-solicitacao__fase--objetivo">
                <div className="nova-solicitacao__campo-bloco nova-solicitacao__campo-textarea">
                  <label id="label-descricao-atividade">Onde e como a IA será utilizada <span>*</span></label>
                  <p className="nova-solicitacao__campo-ajuda" id="ajuda-descricao-atividade">
                    Descreva o contexto de uso: setor, tarefas e momento em que a ferramenta entrará no fluxo de trabalho.
                  </p>
                  <div className="nova-solicitacao__textarea-wrap nova-solicitacao__textarea-wrap--destaque">
                    <textarea
                      className="nova-solicitacao__textarea nova-solicitacao__textarea--objetivo"
                      value={formData.descricaoAtividade || ""}
                      onChange={(event) => updateField("descricaoAtividade", event.target.value)}
                      placeholder="Exemplo: A IA será utilizada no setor de atendimento para auxiliar na organização de mensagens, respostas frequentes e triagem inicial de solicitações."
                      maxLength={1000}
                      required
                      aria-describedby="ajuda-descricao-atividade"
                    />
                    <span className="nova-solicitacao__contador">{(formData.descricaoAtividade || "").length}/1000</span>
                  </div>
                </div>

                <div className="nova-solicitacao__campo-bloco nova-solicitacao__objetivos">
                  <label id="label-utilizacoes">Selecione as utilizações <span>*</span></label>
                  <p className="nova-solicitacao__campo-ajuda" id="ajuda-utilizacoes">
                    Clique em uma ou mais opções abaixo. Você pode combinar utilizações que façam sentido para sua solicitação.
                  </p>
                  <div className="nova-solicitacao__chips" role="group" aria-labelledby="label-utilizacoes">
                    {Object.values(ObjetivosIA).map((option) => {
                      const selected = (formData.objetivos || []).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`nova-solicitacao__chip ${selected ? "nova-solicitacao__chip--selecionado" : ""}`}
                          onClick={() => handleArrayToggle("objetivos", option)}
                          aria-pressed={selected}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formData.objetivos?.includes(ObjetivosIA.OUTRO) && (
                  <div className="nova-solicitacao__campo-bloco">
                    <InputGroup label="Descreva a utilização “Outro”" required>
                      <input
                        type="text"
                        className={getInputClass(formData.objetivoOutro)}
                        value={formData.objetivoOutro || ""}
                        onChange={(event) => updateField("objetivoOutro", event.target.value)}
                        placeholder="Informe qual utilização não está listada acima"
                        required
                      />
                    </InputGroup>
                  </div>
                )}

                <div className="nova-solicitacao__campo-bloco nova-solicitacao__campo-textarea">
                  <label id="label-beneficios">Benefícios esperados com o uso da IA <span>*</span></label>
                  <p className="nova-solicitacao__campo-ajuda" id="ajuda-beneficios">
                    Explique o ganho prático para a equipe ou para o processo (tempo, qualidade, padronização, etc.).
                  </p>
                  <div className="nova-solicitacao__textarea-wrap nova-solicitacao__textarea-wrap--destaque">
                    <textarea
                      className="nova-solicitacao__textarea nova-solicitacao__textarea--objetivo"
                      value={formData.beneficiosEsperados || ""}
                      onChange={(event) => updateField("beneficiosEsperados", event.target.value)}
                      placeholder="Exemplo: Reduzir tempo de atendimento, padronizar respostas, diminuir retrabalho, apoiar a equipe na análise de informações e melhorar a produtividade do setor."
                      maxLength={1000}
                      required
                      aria-describedby="ajuda-beneficios"
                    />
                    <span className="nova-solicitacao__contador">{(formData.beneficiosEsperados || "").length}/1000</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* {activeSection === 0 && (
            <aside className="nova-solicitacao__resumo" aria-label="Resumo da solicitação">
              <h3>Resumo da solicitação</h3>
              <div className="nova-solicitacao__resumo-item">
                <span className="nova-solicitacao__resumo-icone"><UserRound size={21} /></span>
                <div><small>Etapa atual</small><strong>Solicitante</strong></div>
              </div>
              <div className="nova-solicitacao__resumo-item">
                <span className="nova-solicitacao__resumo-icone"><ClipboardCheck size={21} /></span>
                <div><small>Campos obrigatórios</small><strong>4</strong></div>
              </div>
              <div className="nova-solicitacao__resumo-item">
                <span className="nova-solicitacao__resumo-icone"><Clock3 size={21} /></span>
                <div><small>Tempo estimado</small><strong>3–5 min</strong></div>
              </div>
            </aside>
          )} */}
        </div>

        <footer className="nova-solicitacao__acoes">
          <button type="button" onClick={handleCancelRegistration} className="nova-solicitacao__botao nova-solicitacao__botao--cancelar">
            <X size={17} />
            Cancelar registro
          </button>

          <div className="nova-solicitacao__acoes-direita">
            {activeSection > 0 && (
              <button
                type="button"
                onClick={() => setActiveSection((section) => section - 1)}
                className="nova-solicitacao__botao nova-solicitacao__botao--secundario"
              >
                Voltar
              </button>
            )}

            {activeSection === 0 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="nova-solicitacao__botao nova-solicitacao__botao--rascunho"
                disabled={isStep1Incomplete || isProfileIncompleteForStep1}
              >
                <Bookmark size={17} />
                Salvar rascunho
              </button>
            )}

            {activeSection < visibleSections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (isStep1Incomplete || isProfileIncompleteForStep1) {
                    alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
                    return;
                  }
                  if (activeSection === 0 && isStep2Incomplete) {
                    alert("Por favor, selecione ou informe o nome da IA (etapa Solução).");
                    return;
                  }
                  setActiveSection((section) => section + 1);
                }}
                disabled={
                  isStep1Incomplete ||
                  isProfileIncompleteForStep1 ||
                  (activeSection === 0 && isStep2Incomplete)
                }
                className="nova-solicitacao__botao nova-solicitacao__botao--primario"
              >
                Próxima etapa
                <ChevronRight size={17} />
              </button>
            ) : (
              <button
                type="submit"
                data-action="save-record"
                disabled={isSaving || isStep3Incomplete}
                className="nova-solicitacao__botao nova-solicitacao__botao--primario"
              >
                {isSaving ? "Aguarde..." : "Salvar registro"}
                {!isSaving && <Save size={17} />}
              </button>
            )}
          </div>
        </footer>
      </form>

      {/* Saving Loading View Overlay */}
      {isSaving &&
      <div className="cedro-modal-overlay cadastro__grupo-15">
          <div className="cedro-modal-painel cedro-modal-painel--compacto cadastro__grupo-16">
            {/* Ambient background glow inside the popup */}
            <div className="cadastro__grupo-17" />
            <div className="cadastro__grupo-18" />
            
            <div className="cadastro__grupo-19">
              {/* Outer light green background circle */}
              <div className="cadastro__grupo-20">
                {/* Inner white circle holding the save icon */}
                <div className="cadastro__grupo-21">
                  <Save size={24} className="cadastro__elemento-2" />
                </div>
                {/* SVG circular track with smooth animated spinner segment */}
                <svg className="cadastro__elemento-4" viewBox="0 0 100 100">
                  <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="transparent"
                  stroke="#075618"
                  strokeWidth="3.5"
                  strokeDasharray="276.4"
                  initial={{ strokeDashoffset: 276.4 }}
                  animate={{ strokeDashoffset: [200, 50, 200], rotate: [0, 360] }}
                  transition={{
                    strokeDashoffset: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                    rotate: { repeat: Infinity, duration: 1.5, ease: "linear" }
                  }}
                  strokeLinecap="round" />
                
                </svg>
              </div>
            </div>
            
            <div className="cadastro__grupo-salvando-solicitacao">
              <h3 className="cadastro__titulo-bloco-salvando-solicitacao">
                Salvando Solicitação
              </h3>
            </div>
            
            <div className="cadastro__grupo-22">
              <motion.div
              className="cadastro__elemento-5"
              initial={{ width: "10%", x: "0%" }}
              animate={{ width: ["15%", "45%", "15%"], x: ["0%", "200%", "0%"] }}
              transition={{
                repeat: Infinity,
                duration: 2.2,
                ease: "easeInOut"
              }} />
            
            </div>
            
            <span className="cadastro__texto-por-favor-aguarde">
              Por favor, aguarde
            </span>
          </div>
        </div>
      }

      {/* Styled Popup Informing AI Types */}
      {showTypeIAPopup &&
      <div className="cedro-modal-overlay cadastro__grupo-23" onClick={() => setShowTypeIAPopup(false)}>
          <div className="cedro-modal-painel cadastro__grupo-24" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cedro-modal-cabecalho cadastro__grupo-25">
              <div className="cadastro__grupo-26">
                <div className="cadastro__grupo-27">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="cadastro__titulo-bloco-tipos-de-inteligencia-artifici">Tipos de Inteligência Artificial</h3>
                </div>
              </div>
              <button
              type="button"
              onClick={() => setShowTypeIAPopup(false)}
              className="cadastro__botao-13">
              
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="rolagem-personalizada cadastro__grupo-28">
              <div className="cadastro__grupo-29">
                {[
              {
                title: "Chatbot",
                description: "Chatbot é uma IA feita para conversar com pessoas, responder perguntas ou atender usuários.",
                variante: "teal",
                tag: "Interação"
              },
              {
                title: "Machine Learning",
                description: "Machine Learning é uma IA que aprende com dados e melhora suas respostas ou previsões com o tempo.",
                variante: "indigo",
                tag: "Aprendizado"
              },
              {
                title: "Automação",
                description: "Automação é uma IA usada para executar tarefas repetitivas, como preencher informações, enviar alertas ou organizar dados.",
                variante: "amber",
                tag: "Processos"
              },
              {
                title: "Análise de Imagens",
                description: "Análise de Imagens é uma IA que consegue interpretar fotos, exames, documentos escaneados ou outros tipos de imagem.",
                variante: "blue",
                tag: "Visão Computacional"
              },
              {
                title: "IA Generativa",
                description: "IA Generativa é uma IA que cria conteúdos, como textos, imagens, relatórios, respostas ou sugestões.",
                variante: "fuchsia",
                tag: "Geração"
              },
              {
                title: "Algoritmo de Apoio à Decisão",
                description: "Algoritmo de Apoio à Decisão é uma IA que ajuda uma pessoa a escolher o melhor caminho, mostrando análises, impactos ou recomendações.",
                variante: "rose",
                tag: "Decisão"
              },
              {
                title: "Equipamento com IA Embarcada",
                description: "Equipamento com IA Embarcada é quando a inteligência artificial já vem dentro de uma máquina, aparelho ou equipamento.",
                variante: "cyan",
                tag: "Hardware"
              },
              {
                title: "Outro",
                description: "Outro é usado quando a IA não se encaixa bem em nenhuma das opções anteriores.",
                variante: "slate",
                tag: "Geral"
              }].
              map((item, idx) =>
              <div key={idx} className={`cadastro__grupo-30 cadastro-info--${item.variante} cadastro__grupo-31`}>
                    <div className="cadastro__grupo-salvando-solicitacao">
                      <h4 className="cadastro__titulo-item-2">{item.title}</h4>
                      <p className="cadastro__descricao">{item.description}</p>
                    </div>
                    <span className="cadastro__texto-6">
                      {item.tag}
                    </span>
                  </div>
              )}
              </div>
            </div>

            {/* Footer */}
            <div className="cadastro__grupo-entendido">
              <button
              type="button"
              onClick={() => setShowTypeIAPopup(false)}
              className="cadastro__botao-entendido">
              
                Entendido
              </button>
            </div>
          </div>
        </div>
      }

    </div>);

}
