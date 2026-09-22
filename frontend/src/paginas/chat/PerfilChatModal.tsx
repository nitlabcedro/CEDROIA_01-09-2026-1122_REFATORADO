import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Building, FileText, Mail, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/contextos/ContextoAutenticacao";
import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { supabase } from "@/servicos/supabase";
import type { UserProfile } from "@/tipos";
import { obterContatoExibicao, obterIniciais } from "./chat.utilitarios";

// Modal para visualização detalhada do perfil do profissional
export const ProfileModal: React.FC<{profile: UserProfile;onClose: () => void;}> = ({ profile, onClose }) => {
  const { user } = useAuth();
  const [iaRecordsCount, setIaRecordsCount] = useState<number | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const displayContact = useMemo(
    () => obterContatoExibicao(profile, user),
    [profile, user],
  );

  // Carrega dinamicamente a contagem de registros de IA que o profissional possui no Inventário
  useEffect(() => {
    let isMounted = true;
    const fetchUserStats = async () => {
      try {
        setLoadingRecords(true);
        // Busca do Supabase quantos registros estão sob a posse ou autoria deste perfil usando a coluna snake_case correta
        const { count, error } = await supabase.
        from(TABELAS_SUPABASE.REGISTROS_IA).
        select("*", { count: "exact", head: true }).
        or(`owner_id.eq.${profile.id},responsavel_preenchimento.eq.${profile.full_name}`);

        if (isMounted && !error && count !== null) {
          setIaRecordsCount(count);
        }

      } catch (err) {
        console.error("Erro ao carregar registros do profissional no modal:", err);
      } finally {
        if (isMounted) {
          setLoadingRecords(false);
        }
      }
    };

    fetchUserStats();
    return () => {
      isMounted = false;
    };
  }, [profile.id, profile.full_name]);

  // Converte a data do last_seen se existir
  const lastSeenLabel = useMemo(() => {
    if (!profile.last_seen) return "Ausente";
    try {
      const dt = new Date(profile.last_seen);
      const isToday = new Date().toDateString() === dt.toDateString();
      if (isToday) {
        return `Ativo hoje às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      }
      return `Visto por último em ${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return null;
    }
  }, [profile.last_seen]);

  const initials = useMemo(() => obterIniciais(profile.full_name), [profile.full_name]);

  const hasPhoto = profile.avatar_url && profile.avatar_url.trim() !== "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="cedro-modal-overlay chat-perfil-modal__overlay"
      onClick={onClose}>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="cedro-modal-painel cedro-modal-painel--compacto chat-perfil-modal__painel"
        onClick={(e) => e.stopPropagation()}>
        
        {/* Banner principal decorado com gradiente institucional Cedro */}
        <div className="chat-perfil-modal__banner">
          <div className="chat-perfil-modal__banner-detalhe" />
          
          <button
            onClick={onClose}
            className="chat-perfil-modal__fechar"
            title="Fechar">
            
            <X size={15} />
          </button>
        </div>
        
        {/* Avatar, Info Básica */}
        <div className="chat-perfil-modal__conteudo">
          <div className="chat-perfil-modal__avatar-area">
            {/* Foto de Perfil Premium */}
            <div className="chat-perfil-modal__avatar-moldura">
              {hasPhoto ?
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "Avatar"}
                className="chat-perfil-modal__avatar-imagem"
                referrerPolicy="no-referrer" /> :


              <span className="chat-perfil-modal__avatar-iniciais">
                  {initials}
                </span>
              }
            </div>
            {/* Ponto Indicador de Status */}
            <span className="chat-perfil-modal__status-ponto" />
          </div>

          <h2 className="chat-perfil-modal__nome">{profile.full_name}</h2>
          
          <div className="chat-perfil-modal__badges">
            {profile.role === "admin" ?
            <div className="chat-perfil-modal__badge-admin">
                <ShieldCheck size={11} className="chat-perfil-modal__badge-icone-admin" />
                <span className="chat-perfil-modal__badge-texto-admin">Administrador</span>
              </div> :

            <div className="chat-perfil-modal__badge-membro">
                <ShieldCheck size={11} className="chat-perfil-modal__badge-icone-membro" />
                <span className="chat-perfil-modal__badge-texto-membro">Membro Cedro</span>
              </div>
            }
            
          </div>

          {/* Grid de Informações Organizacionais com mais dados */}
          <div className="chat-perfil-modal__grade-informacoes">
            
            {/* Cargo */}
            <div className="chat-perfil-modal__informacao">
              <div className="chat-perfil-modal__informacao-icone">
                <Briefcase size={15} />
              </div>
              <div className="chat__informacao-textos">
                <span className="chat__informacao-rotulo">Cargo / Função</span>
                <span className="chat-perfil-modal__informacao-valor">{profile.cargo || "Não Informado"}</span>
              </div>
            </div>

            {/* Setor */}
            <div className="chat-perfil-modal__informacao">
              <div className="chat-perfil-modal__informacao-icone">
                <Building size={15} />
              </div>
              <div className="chat__informacao-textos">
                <span className="chat__informacao-rotulo">Setor de Atuação</span>
                <span className="chat-perfil-modal__informacao-valor">{profile.setor || "Geral"}</span>
              </div>
            </div>

            {/* Contato / E-mail */}
            <div className="chat-perfil-modal__informacao">
              <div className="chat-perfil-modal__informacao-icone">
                <Mail size={15} />
              </div>
              <div className="chat__informacao-textos">
                <span className="chat__informacao-rotulo">Contato / E-mail</span>
                <span className="chat-perfil-modal__contato" title={displayContact}>
                  {displayContact}
                </span>
              </div>
            </div>

            {/* Nova Seção: Sistemas de IA Cadastrados no Inventário (Estatísticas reais da Cedro IA) */}
            <div className="chat-perfil-modal__inventario">
              <div className="chat-perfil-modal__inventario-linha">
                <div className="chat-perfil-modal__informacao-icone">
                  <FileText size={15} />
                </div>
                <div className="chat__informacao-textos">
                  <span className="chat__informacao-rotulo">Minhas IAs</span>
                  <span className="chat-perfil-modal__inventario-total">
                    {loadingRecords ?
                    <span className="chat-perfil-modal__carregando" /> :

                    `${iaRecordsCount || 0} ${iaRecordsCount === 1 ? "IA cadastrada" : "IAs cadastradas"}`
                    }
                  </span>
                </div>
              </div>


            </div>

          </div>

          {/* Rodapé / Last Seen */}
          {lastSeenLabel &&
          <div className="chat-perfil-modal__ultima-atividade">
              <span className="chat-perfil-modal__ultima-atividade-ponto" />
              <p className="chat-perfil-modal__ultima-atividade-texto">{lastSeenLabel}</p>
            </div>
          }

        </div>
      </motion.div>
    </motion.div>);

};
