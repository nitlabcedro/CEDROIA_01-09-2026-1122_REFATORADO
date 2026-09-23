import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { obterUrlLeituraAnexoChat } from "@/servicos/chat-anexos";

type ChatAnexoDownloadProps = {
  referencia?: string | null;
  enviadoPorMim: boolean;
};

export function ChatAnexoDownload({ referencia, enviadoPorMim }: ChatAnexoDownloadProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterUrlLeituraAnexoChat(referencia).then((assinada) => {
      if (ativo) setUrl(assinada);
    });
    return () => {
      ativo = false;
    };
  }, [referencia]);

  if (!url) {
    return <span className="chat__anexo-processando">...</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer referrer"
      className={`chat__anexo-download ${enviadoPorMim ? "chat__anexo-download--enviado" : "chat__anexo-download--recebido"}`}
      title="Baixar anexo"
      aria-label="Baixar anexo"
    >
      <Download size={16} aria-hidden="true" />
    </a>
  );
}
