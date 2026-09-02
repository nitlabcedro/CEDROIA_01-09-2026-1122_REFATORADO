import React, { useEffect, useMemo, useState } from "react";
import { obterIniciais } from "./chat.utilitarios";

// Avatar do Usuário customizado, seguro contra falhas e compatível com Supabase
export const ChatAvatar: React.FC<{
  avatarUrl?: string | null;
  fullName?: string;
  tamanho?: "pequeno" | "medio" | "grande" | "principal";
  destaque?: boolean;
  className?: string;
  isOnline?: boolean;
}> = ({ avatarUrl, fullName, tamanho = "medio", destaque = false, className = "", isOnline }) => {
  const [hasError, setHasError] = useState(false);

  // Geração de iniciais a partir de full_name ou correspondente
  const initials = useMemo(() => obterIniciais(fullName), [fullName]);

  // Resetar falha quando o avatar_url for atualizado
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const hasPhoto = avatarUrl && avatarUrl.trim() !== "" && !hasError;

  return (
    <div className="chat-avatar__container">
      <div
        className={`chat-avatar chat-avatar--${tamanho} ${
        hasPhoto ?
        "chat-avatar__com-foto" :
        "chat-avatar__sem-foto"} ${
        className}`}>
        
        {hasPhoto ?
        <img
          src={avatarUrl}
          alt={fullName || "Avatar"}
          className="chat-avatar__imagem"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)} /> :


        <span className={`chat-avatar__iniciais ${destaque ? "chat-avatar__iniciais--destaque" : ""}`}>
            {initials}
          </span>
        }
      </div>
      {isOnline &&
      <span className="chat-avatar__indicador-online" />
      }
    </div>);

};
