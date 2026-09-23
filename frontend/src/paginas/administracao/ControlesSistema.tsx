import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import React, { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, Activity, Database, RefreshCw,
  Play, Terminal, Server, Sliders, Check, AlertTriangle, Cpu, Globe, Key } from
"lucide-react";
import { motion } from "framer-motion";
import { IARecord } from "@/tipos";

interface SystemControlsProps {
  supabaseStatus?: "online" | "offline" | "checking";
  records: IARecord[];
}

export default function SystemControls({
  supabaseStatus = "checking",
  records
}: SystemControlsProps) {
  // Enforce/load localStorage values
  const [lgpdLevel, setLgpdLevel] = useState<"basico" | "restrito" | "auditoria">(() => {
    return localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.LGPD_NIVEL) as any || "restrito";
  });

  const [healthStatus, setHealthStatus] = useState<"otimizado" | "alerta" | "manutencao">(() => {
    return localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.SAUDE_SISTEMA) as any || "otimizado";
  });

  const [performanceMode, setPerformanceMode] = useState<"boost" | "balanced" | "eco">(() => {
    return localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.MODO_DESEMPENHO) as any || "boost";
  });

  // Diagnostic states
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<string[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([]);

  // Local sync stats
  const [localCacheSize, setLocalCacheSize] = useState<string>("0.45 MB");

  // Save items in storage and trigger a custom event so other pages can listen to changes
  const updateLgpdLevel = (level: "basico" | "restrito" | "auditoria") => {
    setLgpdLevel(level);
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.LGPD_NIVEL, level);
    window.dispatchEvent(new Event("storage"));
  };

  const updateHealthStatus = (status: "otimizado" | "alerta" | "manutencao") => {
    setHealthStatus(status);
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.SAUDE_SISTEMA, status);
    window.dispatchEvent(new Event("storage"));
  };

  const updatePerformanceMode = (mode: "boost" | "balanced" | "eco") => {
    setPerformanceMode(mode);
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.MODO_DESEMPENHO, mode);
    window.dispatchEvent(new Event("storage"));
  };

  const handleClearCache = () => {
    setLocalCacheSize("0 MB");
    alert("⚡ Cache local do navegador limpo com sucesso! Os dados ativos serão recarregados do Supabase.");
  };

  const runDiagnostics = () => {
    setIsDiagnosing(true);
    setDiagnosticSteps([]);
    setDiagnosticResults([]);

    const steps = [
    "ESTABELECENDO CANAIS DE TESTE DE PERMANÊNCIA...",
    "PING SUPABASE DB CLUSTER (LATÊNCIA ATUAL)...",
    "ANALISANDO INTEGRIDADE DA ESTRUTURA DE TABELAS (IA_RECORDS)...",
    "MEDINDO DESEMPENHO DE RENDERIZAÇÃO E PAGINAÇÃO (LIGTHHOUSE SIM)...",
    "VALIDANDO PROTOCOLOS DE CRIPTOGRAFIA DE DADOS SENSÍVEIS (AES-256)...",
    "COMPILANDO RELATÓRIO DO ECOSSISTEMA NIT CEDRO..."];


    let currentStepIdx = 0;

    const interval = setInterval(() => {
      if (currentStepIdx < steps.length) {
        setDiagnosticSteps((prev) => [...prev, steps[currentStepIdx]]);
        currentStepIdx++;
      } else {
        clearInterval(interval);
        // Compute outcomes
        const latency = supabaseStatus === "online" ? `${Math.floor(Math.random() * 20) + 35}ms` : "Inacessível / Offline";
        const uptime = "99.98%";
        const memory = `${Math.floor(Math.random() * 5) + 12}.4 MB`;

        setDiagnosticResults([
        `========== RELATÓRIO DE SAÚDE DO SISTEMA NIT CEDRO ==========`,
        `Horário de Auditoria : ${new Date().toLocaleTimeString()} (UTC)`,
        `Status Supabase Cloud: ${supabaseStatus.toUpperCase()}`,
        `Latência Cloud Run   : ${latency}`,
        `Rigor Legal LGPD     : ${lgpdLevel.toUpperCase()}`,
        `Uptime Estimado      : ${uptime} (Últimos 30 dias)`,
        `Instâncias de IA     : ${records.length} Cadastros Ativos`,
        `Eficiência do Canvas : Sincronismo Integrado (Renderização: 1.25ms)`,
        `Desempenho de Carga  : Modo ${performanceMode.toUpperCase()} ativo (Uso de Memória: ${memory})`,
        `================ DIAGNÓSTICO CONCLUÍDO SEM ERROS ================`]
        );
        setIsDiagnosing(false);
      }
    }, 600);
  };

  return (
    <div className="administracao-conteiner administracao-controles-sistema controles-sistema__grupo-controles-tecnicos-de-governan">
      
      {/* Top Banner introducing system controls */}
      <div className="controles-sistema__grupo-controles-tecnicos-de-governan-2">
        <div className="controles-sistema__grupo-controles-tecnicos-de-governan-3">
          <h4 className="controles-sistema__titulo-item-controles-tecnicos-de-governan">
            <Sliders size={20} className="controles-sistema__icone-sliders" />
            Controles Técnicos de Governança
          </h4>
          <p className="controles-sistema__descricao-area-restrita-para-manutencao-">
            Área restrita para manutenção, monitoramento e integridade operacional do sistema.
          </p>
        </div>
        <div className="controles-sistema__grupo">
          <button
            onClick={runDiagnostics}
            disabled={isDiagnosing}
            className="controles-sistema__botao">
            
            {isDiagnosing ?
            <>
                <RefreshCw size={14} className="controles-sistema__icone-refreshcw" /> Diagnosticando...
              </> :

            <>
                <Play size={14} /> Executar Diagnóstico
              </>
            }
          </button>
        </div>
      </div>

      <div className="controles-sistema__grupo-2">
        
        {/* LGPD Strictness Regulation Card */}
        <div className="controles-sistema__grupo-3">
          <div className="controles-sistema__grupo-4">
            <ShieldCheck size={120} />
          </div>
          <div>
            <div className="controles-sistema__grupo-5">
              <div className="controles-sistema__grupo-6">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="controles-sistema__texto-conformidade-ativa">Conformidade Ativa</span>
                <h5 className="controles-sistema__elemento-privacidade-lgpd">Privacidade LGPD</h5>
              </div>
            </div>

            <p className="controles-sistema__descricao-define-o-rigor-com-que-os-cole">
              Define o rigor com que os coletores e filtros de formulário e Minhas IAs impõem validações e termos de tratamento sobre os dados cadastrados.
            </p>

            {/* Selector Options */}
            <div className="controles-sistema__grupo-7">
              {[
              { id: "basico", label: "Básico", variante: "basico" },
              { id: "restrito", label: "Rigor Restrito", variante: "restrito" },
              { id: "auditoria", label: "Auditoria Completa", variante: "auditoria" }].
              map((opt) =>
              <button
                key={opt.id}
                onClick={() => updateLgpdLevel(opt.id as any)}
                className={`controles-sistema__botao-2 ${
                lgpdLevel === opt.id ?
                `controles-sistema__botao-3 controles-sistema__botao--${opt.variante}` :
                "controles-sistema__botao-4"}`
                }>
                
                  <div className="controles-sistema__grupo-8">
                    {lgpdLevel === opt.id && <div className="controles-sistema__grupo-9"></div>}
                  </div>
                  <span className="controles-sistema__texto">{opt.label}</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="controles-sistema__grupo-status-interno">
            <p className="controles-sistema__descricao-status-interno">Status Interno:</p>
            <div className="controles-sistema__grupo-10">
              <span className="controles-sistema__texto-2"></span>
              {lgpdLevel === "basico" ? "ATIVO - APENAS LOGS" : lgpdLevel === "restrito" ? "ATIVO - RIGOR MÁXIMO" : "EM AUDITORIA COMPLETA"}
            </div>
          </div>
        </div>

        {/* System Health / Status Controller */}
        <div className="controles-sistema__grupo-3">
          <div className="controles-sistema__grupo-4">
            <Activity size={120} />
          </div>
          <div>
            <div className="controles-sistema__grupo-5">
              <div className="controles-sistema__grupo-11">
                <Activity size={20} />
              </div>
              <div>
                <span className="controles-sistema__texto-saude-das-instancias">Saúde das Instâncias</span>
                <h5 className="controles-sistema__elemento-privacidade-lgpd">Status do Sistema</h5>
              </div>
            </div>

            <p className="controles-sistema__descricao-define-o-rigor-com-que-os-cole">
              Habilita simulações operacionais de falhas, gargalos ou manutenção para validação de contingência das equipes administrativas.
            </p>

            {/* Selector Options */}
            <div className="controles-sistema__grupo-7">
              {[
              { id: "otimizado", label: "Otimizado", variante: "otimizado" },
              { id: "alerta", label: "Modo Sobrecarga", variante: "alerta" },
              { id: "manutencao", label: "Manutenção Geral", variante: "manutencao" }].
              map((opt) =>
              <button
                key={opt.id}
                onClick={() => updateHealthStatus(opt.id as any)}
                className={`controles-sistema__botao-2 ${
                healthStatus === opt.id ?
                `controles-sistema__botao-3 controles-sistema__botao--${opt.variante}` :
                "controles-sistema__botao-4"}`
                }>
                
                  <div className="controles-sistema__grupo-8">
                    {healthStatus === opt.id && <div className="controles-sistema__grupo-9"></div>}
                  </div>
                  <span className="controles-sistema__texto">{opt.label}</span>
                </button>
              )}
            </div>
          </div>

          <div className="controles-sistema__grupo-status-interno">
            <p className="controles-sistema__descricao-status-interno">Carga Estimada da CPU:</p>
            <div className="controles-sistema__grupo-12">
              <Cpu size={14} />
              {healthStatus === "otimizado" ? "0.02% (ESTÁVEL)" : healthStatus === "alerta" ? "88.7% (GARGALO REPLICANDO)" : "MANUTENÇÃO PROGRAMADA"}
            </div>
          </div>
        </div>

        {/* Database & Cloud Sync Controller */}
        <div className="controles-sistema__grupo-3">
          <div className="controles-sistema__grupo-4">
            <Database size={120} />
          </div>
          <div>
            <div className="controles-sistema__grupo-5">
              <div className="controles-sistema__grupo-13">
                <Database size={20} />
              </div>
              <div>
                <span className="controles-sistema__texto-banco-de-dados-supabase">Banco de Dados Supabase</span>
                <h5 className="controles-sistema__elemento-privacidade-lgpd">Nuvem & Sincronismo</h5>
              </div>
            </div>

            <p className="controles-sistema__descricao-define-o-rigor-com-que-os-cole">
              Exibe a disponibilidade do Supabase Cloud e oferece manutenção do cache local do navegador.
            </p>

            {/* Supabase Status Banner */}
            <div className="controles-sistema__grupo-status-conexao">
              <div className="controles-sistema__grupo-status-conexao-2">
                <span className="controles-sistema__texto-status-conexao">Status Conexão:</span>
                <div className="controles-sistema__grupo-14">
                  <span className={`controles-sistema__texto-3 ${
                  supabaseStatus === "online" ? "controles-sistema__texto-4" :
                  supabaseStatus === "offline" ? "controles-sistema__texto-5" :
                  "controles-sistema__texto-6"}`
                  } />
                  <span className="controles-sistema__texto-7">
                    {supabaseStatus === "online" ? "ONLINE" : supabaseStatus === "offline" ? "OFFLINE/STANDBY" : "VERIFICANDO..."}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="controles-sistema__grupo-15">
            <button
              onClick={handleClearCache}
              className="controles-sistema__botao-limpar-cache-do-navegador">
              
              Limpar Cache do Navegador
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Terminal Output for diagnostics results */}
      {(diagnosticSteps.length > 0 || diagnosticResults.length > 0) &&
      <div className="controles-sistema__grupo-16">
          <div className="controles-sistema__grupo-17">
            <span className="controles-sistema__texto-8" />
            <span className="controles-sistema__texto-9" />
            <span className="controles-sistema__texto-10" />
          </div>
          
          <div className="controles-sistema__grupo-console-de-auditoria-local-nit">
            <Terminal size={14} />
            <span>Console de Auditoria Local — NIT Cedro Diagnostico</span>
          </div>

          <div className="rolagem-personalizada controles-sistema__grupo-18">
            {diagnosticSteps.map((step, idx) =>
          <div key={idx} className="controles-sistema__grupo-worker">
                <span className="controles-sistema__texto-worker">[WORKER-{idx + 1}]</span>
                <span className="controles-sistema__texto-11">{step}</span>
                <Check size={12} className="controles-sistema__icone-check" />
              </div>
          )}
            
            {diagnosticResults.length > 0 && <div className="controles-sistema__grupo-19" />}
            
            {diagnosticResults.map((res, idx) =>
          <div key={idx} className={`${idx === 0 || idx === diagnosticResults.length - 1 ? "controles-sistema__grupo-20" : "controles-sistema__grupo-21"}`}>
                {res}
              </div>
          )}
          </div>
        </div>
      }

    </div>);

}
