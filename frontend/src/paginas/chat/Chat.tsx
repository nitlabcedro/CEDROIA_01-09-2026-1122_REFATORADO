import { CHAVES_ARMAZENAMENTO_LOCAL, EVENTOS_APLICACAO } from "@/constantes/armazenamento-local";
import { datasNoMesmoDia, EMOJIS_SUGERIDOS, formatarHorarioMensagem, mesclarMensagemSemDuplicar, ordenarMensagens, removerDuplicadasPorId, rotuloDataAmigavel, usuarioEstaOnline } from "./chat.utilitarios";
import { ChatAvatar } from "./ChatAvatar";
import { ProfileModal } from "./PerfilChatModal";
import { BUCKETS_SUPABASE, TABELAS_SUPABASE } from "@/constantes/supabase";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/servicos/supabase";
import { getProfiles } from "@/servicos/armazenamento";
import "@/estilos/paginas/chat-referencia.css";
import { useAuth } from "@/contextos/ContextoAutenticacao";
import { ChatMessage, UserProfile } from "@/tipos";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, User, MoreVertical, MessageSquare, X,
  Search, Filter, Plus,
  Paperclip, Smile, Star, Check, ChevronLeft,
  FileText, Download } from
"lucide-react";

export const Chat: React.FC = () => {
  const { user, profile } = useAuth();

  // Estados reais do banco de dados do Supabase
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});
  // Mantemos separada a última mensagem RECEBIDA de cada contato.
  // Isso evita que uma resposta enviada pelo próprio usuário volte a marcar a conversa como não lida.
  const [lastIncomingMessagesMap, setLastIncomingMessagesMap] = useState<Record<string, ChatMessage>>({});
  const [unreadCountsMap, setUnreadCountsMap] = useState<Record<string, number>>({});

  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Conversa ativa selecionada (representa o ID do usuário real de profiles)
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [listFilter, setListFilter] = useState<"all" | "unread" | "favorites">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Busca na conversa ativa
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // Controle de arquivos e emojis
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [uiError, setUiError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Modais de ações adicionais
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");

  // Controle local de favoritos
  const [favorites, setFavorites] = useState<string[]>([]);

  // Controle local de mensagens lidas (não-lidas reativos)
  const [lastSeenMessageMap, setLastSeenMessageMap] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(`${CHAVES_ARMAZENAMENTO_LOCAL.MAPA_CHAT_VISUALIZADO_PREFIXO}${user?.id || "anon"}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Quando a sessão é resolvida/troca de usuário, recarrega o mapa de leitura correto.
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`${CHAVES_ARMAZENAMENTO_LOCAL.MAPA_CHAT_VISUALIZADO_PREFIXO}${user.id}`);
      setLastSeenMessageMap(stored ? JSON.parse(stored) : {});
    } catch {
      setLastSeenMessageMap({});
    }
  }, [user?.id]);

  // Salvar no localStorage sempre que o mapa de visualizações mudar.
  // O hook global usa esse mesmo mapa para o badge do Chat na sidebar.
  useEffect(() => {
    if (user?.id) {
      try {
        localStorage.setItem(`${CHAVES_ARMAZENAMENTO_LOCAL.MAPA_CHAT_VISUALIZADO_PREFIXO}${user.id}`, JSON.stringify(lastSeenMessageMap));
        window.dispatchEvent(new CustomEvent(EVENTOS_APLICACAO.CHAT_LEITURA_ATUALIZADA));
      } catch (err) {
        console.error("Falha ao salvar visto no localStorage", err);
      }
    }
  }, [lastSeenMessageMap, user?.id]);

  // Compartilha qual conversa está aberta para que notificações globais não sinalizem a conversa visível.
  useEffect(() => {
    if (selectedConvId) {
      localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM, selectedConvId);
    } else {
      localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM);
    }

    return () => {
      if (localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM) === selectedConvId) {
        localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM);
      }
    };
  }, [selectedConvId]);

  const markConversationAsSeen = React.useCallback((partnerId: string, incomingMessageId?: string | null) => {
    if (!partnerId) return;

    // Zera imediatamente o contador visual da conversa aberta.
    setUnreadCountsMap((prev) => {
      if ((prev[partnerId] || 0) === 0) return prev;
      return { ...prev, [partnerId]: 0 };
    });

    // O marcador de leitura precisa apontar para uma mensagem RECEBIDA.
    // Nunca usamos a última mensagem geral, pois ela pode ter sido enviada pelo próprio usuário.
    if (!incomingMessageId) return;
    setLastSeenMessageMap((prev) => {
      if (prev[partnerId] === incomingMessageId) return prev;
      return { ...prev, [partnerId]: incomingMessageId };
    });
  }, []);

  // Ao abrir uma conversa, marca como vista a última mensagem que realmente foi RECEBIDA daquele contato.
  // Assim, responder ao contato não faz a notificação reaparecer.
  useEffect(() => {
    if (!selectedConvId) return;
    markConversationAsSeen(selectedConvId, lastIncomingMessagesMap[selectedConvId]?.id);
  }, [selectedConvId, lastIncomingMessagesMap, markConversationAsSeen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Abre diretamente a conversa indicada pela notificação global.
  useEffect(() => {
    if (!user?.id) return;

    const abrirConversaDaNotificacao = (partnerId?: string | null) => {
      if (!partnerId || partnerId === user.id) return;

      setListFilter("all");
      setSearchQuery("");
      setChatSearchOpen(false);
      setChatSearchQuery("");
      setIsEmojiOpen(false);
      setUiError("");
      setSelectedConvId(partnerId);
      sessionStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ALVO_NOTIFICACAO);

      window.setTimeout(() => inputRef.current?.focus(), 80);
    };

    const pendente = sessionStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ALVO_NOTIFICACAO);
    if (pendente) abrirConversaDaNotificacao(pendente);

    const handleOpenChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      abrirConversaDaNotificacao(customEvent.detail?.userId);
    };

    window.addEventListener(EVENTOS_APLICACAO.CHAT_ABRIR_CONVERSA, handleOpenChat as EventListener);
    return () => {
      window.removeEventListener(EVENTOS_APLICACAO.CHAT_ABRIR_CONVERSA, handleOpenChat as EventListener);
    };
  }, [user?.id]);
  // Protege contra duplo clique/Enter duplo que poderia gerar dois INSERTs idênticos.
  const ultimaTentativaEnvioRef = useRef<{ assinatura: string; em: number }>({ assinatura: "", em: 0 });
  const carregandoUsuariosRef = useRef(false);
  const carregandoUltimasMensagensRef = useRef(false);
  const conversasEmCarregamentoRef = useRef(new Set<string>());

  // Carregar usuários reais da tabela profiles
  const fetchUsers = async () => {
    if (carregandoUsuariosRef.current) return;
    carregandoUsuariosRef.current = true;
    try {
      const data = await getProfiles();
      // Libera todo o chat para que todos os usuários possam ver e conversar com qualquer colega voluntariamente
      setUsers(data.filter((item) => item.id !== user?.id));
    } catch (e) {
      console.error("Falha ao carregar perfis reais de usuários para o Chat:", e);
    } finally {
      carregandoUsuariosRef.current = false;
    }
  };

  // Carregar mensagens reais entre o usuário logado e o usuário selecionado
  const fetchRealtimeMessages = async () => {
    if (!selectedConvId || !user?.id) {
      setMessages([]);
      return;
    }
    const conversationKey = `${user.id}:${selectedConvId}`;
    if (conversasEmCarregamentoRef.current.has(conversationKey)) return;
    conversasEmCarregamentoRef.current.add(conversationKey);
    setLoading(true);
    try {
      console.log("Carregando mensagens para a conversa:", selectedConvId);
      let data = null;
      let error = null;

      // 1. Tentar a consulta .or() combinada padrão do PostgREST
      try {
        const res = await supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        or(`and(sender_id.eq.${user.id},recipient_id.eq.${selectedConvId}),and(sender_id.eq.${selectedConvId},recipient_id.eq.${user.id})`).
        order("created_at", { ascending: true }).
        limit(150);
        data = res.data;
        error = res.error;
      } catch (orErr) {
        console.warn("Falha de parser na query .or() combinada, usando manual...", orErr);
      }

      // 2. Se falhar ou do banco retornar erro, usar busca por consultas separadas (absolutamente imune a falhas)
      if (error || !data) {
        console.log("Buscando mensagens separadamente para máxima compatibilidade...");
        const [sentRes, recvRes] = await Promise.all([
        supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        eq("sender_id", user.id).
        eq("recipient_id", selectedConvId).
        limit(100),
        supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        eq("sender_id", selectedConvId).
        eq("recipient_id", user.id).
        limit(100)]
        );

        if (sentRes.error) {
          console.error("Erro na busca de enviadas:", sentRes.error);
        }
        if (recvRes.error) {
          console.error("Erro na busca de recebidas:", recvRes.error);
        }

        const combined = [...(sentRes.data || []), ...(recvRes.data || [])];
        combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        data = combined;
        error = null;
      }

      console.log("Mensagens carregadas do Supabase:", data);

      if (data) {
        const enriched = data.map((msg: any) => {
          let senderProfile = null;
          if (msg.sender_id === user.id) {
            senderProfile = profile;
          } else {
            senderProfile = users.find((u) => u.id === msg.sender_id) || null;
          }
          return {
            ...msg,
            sender_profile: senderProfile
          };
        });
        setMessages(removerDuplicadasPorId(enriched));
      }
    } catch (err) {
      console.error("Erro fatal ao carregar mensagens reais do Supabase:", err);
    } finally {
      conversasEmCarregamentoRef.current.delete(conversationKey);
      setLoading(false);
    }
  };

  // Carregar as últimas mensagens de todas as conversas para as prévias na sidebar
  const fetchAllLastMessages = async () => {
    if (!user?.id) return;
    if (carregandoUltimasMensagensRef.current) return;
    carregandoUltimasMensagensRef.current = true;
    try {
      let data = null;
      let error = null;

      try {
        const res = await supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).
        order("created_at", { ascending: false });
        data = res.data;
        error = res.error;
      } catch (orErr) {
        console.warn("Falha no .or de busca das últimas mensagens:", orErr);
      }

      if (error || !data) {
        const [sentRes, recvRes] = await Promise.all([
        supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        eq("sender_id", user.id).
        order("created_at", { ascending: false }).
        limit(100),
        supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        select("*").
        eq("recipient_id", user.id).
        order("created_at", { ascending: false }).
        limit(100)]
        );

        const combined = [...(sentRes.data || []), ...(recvRes.data || [])];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        data = combined;
        error = null;
      }

      if (data) {
        const lastMsgs: Record<string, ChatMessage> = {};
        const lastIncoming: Record<string, ChatMessage> = {};
        const recebidasPorParceiro: Record<string, ChatMessage[]> = {};

        // `data` está em ordem decrescente de created_at; portanto o primeiro item
        // encontrado por contato é a atividade mais recente daquela conversa.
        data.forEach((msg: ChatMessage) => {
          const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          if (partnerId && !lastMsgs[partnerId]) {
            lastMsgs[partnerId] = msg;
          }

          if (msg.recipient_id === user.id && msg.sender_id !== user.id) {
            if (!lastIncoming[msg.sender_id]) {
              lastIncoming[msg.sender_id] = msg;
            }
            if (!recebidasPorParceiro[msg.sender_id]) recebidasPorParceiro[msg.sender_id] = [];
            recebidasPorParceiro[msg.sender_id].push(msg);
          }
        });

        const unread: Record<string, number> = {};
        Object.entries(recebidasPorParceiro).forEach(([partnerId, recebidas]) => {
          if (selectedConvIdRef.current === partnerId) {
            unread[partnerId] = 0;
            return;
          }

          const lastSeenId = lastSeenMessageMap[partnerId];
          if (!lastSeenId) {
            unread[partnerId] = recebidas.length;
            return;
          }

          const indiceVista = recebidas.findIndex((msg) => msg.id === lastSeenId);
          unread[partnerId] = indiceVista === -1 ? recebidas.length : indiceVista;
        });

        setLastMessagesMap(lastMsgs);
        setLastIncomingMessagesMap(lastIncoming);
        setUnreadCountsMap(unread);
      }
    } catch (err) {
      console.error("Erro ao carregar mapa de conversas com últimas mensagens:", err);
    } finally {
      carregandoUltimasMensagensRef.current = false;
    }
  };

  const selectedConvIdRef = useRef(selectedConvId);
  useEffect(() => {selectedConvIdRef.current = selectedConvId;}, [selectedConvId]);

  const usersRef = useRef(users);
  useEffect(() => {usersRef.current = users;}, [users]);

  const profileRef = useRef(profile);
  useEffect(() => {profileRef.current = profile;}, [profile]);

  // Atualizar tudo ao start ou mudar de usuário
  useEffect(() => {
    fetchUsers();
    fetchAllLastMessages();
  }, [user?.id]);

  useEffect(() => {
    if (selectedConvId) {
      fetchRealtimeMessages();
    } else {
      setMessages([]);
    }
  }, [selectedConvId, user?.id]);

  // Integração em tempo real com o canal do Supabase (estável, depende apenas de user.id)
  useEffect(() => {
    if (!user?.id) return;

    const messageChannel = supabase.
    channel("chat-realtime-cedro").
    on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABELAS_SUPABASE.MENSAGENS },
      async (payload) => {
        const insertMsg = payload.new as ChatMessage;
        const isRelatedToMe = insertMsg.sender_id === user.id || insertMsg.recipient_id === user.id;

        if (isRelatedToMe) {
          // Atualiza mapa de últimas mensagens
          const partnerId = insertMsg.sender_id === user.id ? insertMsg.recipient_id : insertMsg.sender_id;
          if (partnerId) {
            setLastMessagesMap((prev) => ({
              ...prev,
              [partnerId]: insertMsg
            }));

            if (insertMsg.recipient_id === user.id && insertMsg.sender_id !== user.id) {
              setLastIncomingMessagesMap((prev) => ({
                ...prev,
                [partnerId]: insertMsg
              }));

              if (selectedConvIdRef.current === partnerId) {
                // Se a conversa já está aberta, a nova mensagem é considerada visualizada imediatamente.
                markConversationAsSeen(partnerId, insertMsg.id);
              } else {
                setUnreadCountsMap((prev) => ({
                  ...prev,
                  [partnerId]: (prev[partnerId] || 0) + 1
                }));
              }
            }
          }

          // Se for do chat ativamente aberto, adiciona na lista
          const currentConvId = selectedConvIdRef.current;
          const isForOpenChat =
          insertMsg.sender_id === user.id && insertMsg.recipient_id === currentConvId ||
          insertMsg.sender_id === currentConvId && insertMsg.recipient_id === user.id;

          if (isForOpenChat) {
            let senderProfile = null;
            if (insertMsg.sender_id === user.id) {
              senderProfile = profileRef.current;
            } else {
              senderProfile = usersRef.current.find((u) => u.id === insertMsg.sender_id) || null;
            }
            const enrichedMsg = {
              ...insertMsg,
              sender_profile: senderProfile
            };

            setMessages((prev) => mesclarMensagemSemDuplicar(prev, enrichedMsg));
          }
        }
      }
    ).
    on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABELAS_SUPABASE.PERFIS },
      async (payload) => {
        const updatedProfile = payload.new as UserProfile;
        if (updatedProfile && updatedProfile.id !== user?.id) {
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === updatedProfile.id);
            if (exists) {
              return prev.map((u) => u.id === updatedProfile.id ? { ...u, ...updatedProfile } : u);
            } else {
              return [...prev, updatedProfile];
            }
          });
        }
      }
    ).
    subscribe();

    // Reconciliacao de seguranca; o fluxo principal continua sendo o Realtime.
    const pollInterval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchUsers();
      fetchAllLastMessages();
    }, 120000);

    return () => {
      supabase.removeChannel(messageChannel);
      clearInterval(pollInterval);
    };
  }, [user?.id]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedConvId]);

  // Recipiente ativo
  const selectedRecipient = useMemo(() => {
    if (!selectedConvId) return null;
    return users.find((u) => u.id === selectedConvId) || null;
  }, [selectedConvId, users]);

  // Mantém o compositor utilizável assim que o contato aberto pela notificação estiver disponível.
  useEffect(() => {
    if (!selectedConvId || !selectedRecipient) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, [selectedConvId, selectedRecipient?.id]);

  // Lista de conversas no padrão WhatsApp/Instagram:
  // qualquer envio ou recebimento recente move a conversa imediatamente para o topo.
  const computedConversations = useMemo(() => {
    return users
      .map((u) => {
        const lastMsgObj = lastMessagesMap[u.id];
        const hasAttachment = lastMsgObj?.attachment_url;
        const lastMsgText = lastMsgObj ?
        lastMsgObj.content || (hasAttachment ? "📎 Arquivo Anexo" : "") :
        "Nenhuma mensagem ainda. Inicie a conversa.";

        const lastMsgTime = lastMsgObj ?
        formatarHorarioMensagem(lastMsgObj.created_at) :
        "";

        const unreadCount = selectedConvId === u.id ? 0 : unreadCountsMap[u.id] || 0;

        return {
          id: u.id,
          name: u.full_name || "Sem Nome",
          subtitle: `${u.setor || "Sem setor"} • ${u.cargo || "Profissional"}`,
          lastMessage: lastMsgText || "",
          time: lastMsgTime || "",
          lastActivityAt: lastMsgObj?.created_at || null,
          favorite: favorites.includes(u.id),
          unreadCount,
          profile: u
        };
      })
      .sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;

        if (aTime !== bTime) return bTime - aTime;

        // Contatos sem conversa permanecem abaixo dos contatos ativos, em ordem alfabética.
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      });
  }, [users, lastMessagesMap, favorites, selectedConvId, unreadCountsMap]);

  // Filtragem e busca de conversas na aba de conversas
  const filteredConversations = useMemo(() => {
    return computedConversations.filter((c) => {
      const nameStr = c.name || "";
      const subtitleStr = c.subtitle || "";
      const lastMsgStr = c.lastMessage || "";
      const queryStr = searchQuery || "";

      const matchesSearch =
      nameStr.toLowerCase().includes(queryStr.toLowerCase()) ||
      subtitleStr.toLowerCase().includes(queryStr.toLowerCase()) ||
      lastMsgStr.toLowerCase().includes(queryStr.toLowerCase());

      if (!matchesSearch) return false;

      if (listFilter === "all") return true;
      if (listFilter === "favorites") return !!c.favorite;
      if (listFilter === "unread") return c.unreadCount > 0;
      return true;
    });
  }, [computedConversations, searchQuery, listFilter]);

  // Manuseio de anexação de arquivos
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Bloquear arquivos com mais de 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUiError("O arquivo selecionado é muito grande. O limite máximo permitido é 10MB.");
      setTimeout(() => setUiError(""), 5000);
      return;
    }

    // Bloquear arquivos inseguros
    const unsafeExtensions = ["exe", "bat", "cmd", "sh", "js", "vbs"];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt && unsafeExtensions.includes(fileExt)) {
      setUiError("Este tipo de arquivo não é permitido por motivos de segurança do laboratório.");
      setTimeout(() => setUiError(""), 5000);
      return;
    }

    setSelectedFile(file);
    setUiError("");
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Seletor de emoji funcional
  const handleEmojiClick = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setNewMessage((prev) => prev + emoji);
      return;
    }

    const start = input.selectionStart ?? newMessage.length;
    const end = input.selectionEnd ?? newMessage.length;
    const text = newMessage;
    const nextText = text.substring(0, start) + emoji + text.substring(end);
    setNewMessage(nextText);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);

    setIsEmojiOpen(false);
  };

  // Enviar mensagem real e anexos via Storage
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    if (!user?.id) {
      setUiError("Você precisa estar autenticado para enviar mensagens.");
      return;
    }

    if (!selectedConvId) {
      setUiError("Selecione um profissional para conversar.");
      return;
    }

    const textToSend = newMessage.trim();
    const fileToUpload = selectedFile;

    // Evita duplicação por clique duplo, Enter repetido ou submit disparado duas vezes.
    // A janela é curta para não impedir que o usuário envie a mesma frase novamente de propósito.
    const assinaturaEnvio = [
      selectedConvId,
      textToSend,
      fileToUpload?.name || "",
      fileToUpload?.size || 0
    ].join("|");
    const agora = Date.now();
    if (
      ultimaTentativaEnvioRef.current.assinatura === assinaturaEnvio &&
      agora - ultimaTentativaEnvioRef.current.em < 1200
    ) {
      return;
    }
    ultimaTentativaEnvioRef.current = { assinatura: assinaturaEnvio, em: agora };

    // 1. Validar anexo antes de prosseguir
    if (fileToUpload) {
      const allowedExts = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt"];
      const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExts.includes(fileExt)) {
        setUiError("Tipo de arquivo não permitido.");
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10 MB
      if (fileToUpload.size > maxSize) {
        setUiError("O arquivo excede o tamanho máximo permitido de 10 MB.");
        return;
      }
    }

    setUiError("");

    // 2. Criar mensagem otimista temporária imediatamente
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      content: textToSend || `Anexou arquivo: ${fileToUpload ? fileToUpload.name : ""}`,
      is_private: true,
      recipient_id: selectedConvId,
      sender_profile: profile || undefined,
      status: "sending"
    };

    if (fileToUpload) {
      tempMessage.attachment_name = fileToUpload.name;
      tempMessage.attachment_size = fileToUpload.size;
      tempMessage.attachment_type = fileToUpload.type;
    }

    // Inserir localmente instantaneamente!
    setMessages((prev) => [...prev, tempMessage]);

    // Atualizar mapa de última mensagem instantaneamente na sidebar
    setLastMessagesMap((prev) => ({
      ...prev,
      [selectedConvId]: tempMessage
    }));

    // Limpar estados na hora para melhorar a responsividade
    setNewMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    let attachment_url = "";
    let attachment_name = "";
    let attachment_type = "";
    let attachment_size = 0;
    let uploadFailed = false;

    if (fileToUpload) {
      setUploading(true);
      try {
        const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase();
        const fileName = `${Math.random().toString(36).substring(2, 11)}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Tenta fazer o upload para o bucket chat-attachments
        const { data: uploadData, error: uploadError } = await supabase.storage.
        from(BUCKETS_SUPABASE.ANEXOS_CHAT).
        upload(filePath, fileToUpload);

        if (uploadError) {
          throw uploadError;
        }

        if (uploadData) {
          const { data: publicUrlData } = supabase.storage.
          from(BUCKETS_SUPABASE.ANEXOS_CHAT).
          getPublicUrl(filePath);

          attachment_url = publicUrlData.publicUrl;
          attachment_name = fileToUpload.name;
          attachment_type = fileToUpload.type;
          attachment_size = fileToUpload.size;
        }
      } catch (storageErr: any) {
        console.error("Falha ao realizar o upload:", storageErr);
        uploadFailed = true;
        setUiError("Bucket de anexos não configurado. Crie o bucket chat-attachments no Supabase Storage.");

        // Se NÃO há texto digitado, não dá para enviar nada no banco. Restauramos e interrompemos.
        if (!textToSend) {
          setUploading(false);
          setNewMessage(textToSend);
          setSelectedFile(fileToUpload);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    try {
      const payload: any = {
        content: textToSend || `Anexou arquivo: ${attachment_name}`,
        sender_id: user.id,
        is_private: true,
        recipient_id: selectedConvId,
        attachment_url: uploadFailed ? null : attachment_url || null,
        attachment_name: uploadFailed ? null : attachment_name || null,
        attachment_type: uploadFailed ? null : attachment_type || null,
        attachment_size: uploadFailed ? null : attachment_size || null
      };

      console.log("Enviando mensagem:", payload);

      let insertData = null;
      let insertError = null;

      // 1. Tentar inserção completa com suporte a anexo
      const res1 = await supabase.
      from(TABELAS_SUPABASE.MENSAGENS).
      insert(payload).
      select().
      single();

      insertData = res1.data;
      insertError = res1.error;

      // 2. Se der erro por falta de colunas (anexos ausentes na tabela do Supabase legado)
      if (insertError && (insertError.code === "42703" || insertError.message?.includes("attachment") || insertError.message?.includes("column"))) {
        console.warn("Tabela remote 'messages' não suporta anexos ainda. Tentando persistência com fallback básico de texto.");

        let fallbackText = textToSend;
        if (attachment_url && !uploadFailed) {
          fallbackText = (textToSend ? textToSend + "\n\n" : "") + `📎 Arquivo Anexo: [${attachment_name}](${attachment_url})`;
        }

        const basicPayload = {
          content: fallbackText || "📎 Anexo enviado",
          sender_id: user.id,
          is_private: true,
          recipient_id: selectedConvId
        };

        const res2 = await supabase.
        from(TABELAS_SUPABASE.MENSAGENS).
        insert(basicPayload).
        select().
        single();

        insertData = res2.data;
        insertError = res2.error;
      }

      if (insertError) {
        console.error("Erro ao salvar mensagem no Supabase:", insertError);
        setUiError(`Erro ao enviar mensagem: ${insertError.message || insertError.details || "Código do banco: " + insertError.code}`);

        // Marcar mensagem local temporária como erro
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "error" } : m));
        // Restaurar para que o usuário possa tentar novamente
        setNewMessage(textToSend);
        setSelectedFile(fileToUpload);
        return;
      }

      if (insertData) {
        console.log("Mensagem salva com sucesso:", insertData);

        const enrichedInsert = {
          ...insertData,
          sender_profile: profile
        };

        // Substitui a temporária e reconcilia com qualquer INSERT que já tenha
        // chegado pelo realtime. Assim a mesma mensagem nunca fica em duas bolhas.
        setMessages((prev) => {
          const semTemporaria = prev.filter((m) => m.id !== tempId);
          return mesclarMensagemSemDuplicar(semTemporaria, enrichedInsert);
        });

        // Atualizar listagem de prévias lateral
        fetchAllLastMessages();
      }
    } catch (dbErr: any) {
      console.error("Erro fatal ao processar envio de mensagem:", dbErr);
      setUiError(`Erro ao processar envio: ${dbErr.message || dbErr}`);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "error" } : m));
      setNewMessage(textToSend);
      setSelectedFile(fileToUpload);
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
    prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // Filtragem de palavras chave internamente no chat ativado
  const highlightTerm = (text: string = "", term: string) => {
    if (!text) return "";
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ?
        <span key={i} className="chat__termo-destacado">{part}</span> :
        part
        )}
      </>);

  };

  const activeMessagesToShow = useMemo(() => {
    let result = messages;
    if (chatSearchOpen && chatSearchQuery.trim()) {
      const query = chatSearchQuery.toLowerCase();
      result = result.filter((m) => (m.content || "").toLowerCase().includes(query));
    }
    return result;
  }, [messages, chatSearchOpen, chatSearchQuery]);

  // Lista para nova conversa (modal busca em profiles reais)
  const modalUsersRoster = useMemo(() => {
    if (newChatSearch.trim()) {
      return users.filter((u) =>
      u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.setor?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.cargo?.toLowerCase().includes(newChatSearch.toLowerCase())
      );
    }
    return users;
  }, [users, newChatSearch]);

  const activeConvObj = computedConversations.find((c) => c.id === selectedConvId);
  const totalUnreadCount = useMemo(
    () => Object.values(unreadCountsMap).reduce((total: number, count: number) => total + count, 0),
    [unreadCountsMap]
  );

  const voltarParaListaDeConversas = () => {
    // Um campo focado pode manter o teclado aberto e a viewport reduzida no mobile.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsEmojiOpen(false);
    setChatSearchOpen(false);
    setChatSearchQuery("");
    setSelectedConvId("");
  };

  return (
    <div id="chat-conteudo" data-componente="pagina-chat" className="pagina-chat-conteudo chat__pagina">
      {/* Estrutura fixa: cabeçalhos/rodapés permanecem no lugar e somente as listas rolam. */}
      <div className="chat__layout chat__estrutura">
        
        {/* COLUNA ESQUERDA - Sidebar de conversas */}
        <div id="chat-conversas" className={`chat__painel-conversas ${selectedConvId ? "chat__painel--oculto-mobile" : "chat__painel--visivel-mobile"}`}>
          
          {/* Header Superior da Sidebar */}
          <div className="cedro-chat-list-header chat__conversas-cabecalho">
            <div className="chat__conversas-topo">
              <div className="chat__conversas-titulos">
                <div className="chat__linha-controle">
                  <h2 className="chat__conversas-titulo">Conversas</h2>
                  {totalUnreadCount > 0 &&
                  <span className="chat__contador-nao-lidas-total">
                      {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                  }
                </div>
                <p className="chat__conversas-subtitulo">Mensagens internas do Cedro</p>
              </div>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="chat__nova-conversa-botao">
                
                <Plus size={12} strokeWidth={3} /> Nova conversa
              </button>
            </div>

            {/* Caixa de Busca */}
            <div className="chat__linha-controle">
              <div className="chat__busca-conversas">
                <Search size={14} className="chat__busca-conversas-icone" />
                <input
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="chat__busca-conversas-campo" />
                
                {searchQuery &&
                <button
                  onClick={() => setSearchQuery("")}
                  className="chat__busca-conversas-limpar">
                  
                    <X size={12} strokeWidth={2.5} />
                  </button>
                }
              </div>
            </div>

            {/* Chips de filtro */}
            <div className="chat__filtros-conversas">
              {[
              { id: "all", label: "Todas" },
              { id: "unread", label: "Não lidas" },
              { id: "favorites", label: "Favoritas" }].
              map((chip) =>
              <button
                key={chip.id}
                onClick={() => setListFilter(chip.id as any)}
                className={`chat__filtro-botao ${
                listFilter === chip.id ?
                "chat__filtro-botao--ativo" :
                "chat__filtro-botao--inativo"}`
                }>
                
                  {chip.label}
                </button>
              )}
            </div>
          </div>

          {/* Listagem de conversas */}
          <div id="chat-lista-conversas" className="rolagem-personalizada chat__lista-conversas">
            {users.length === 0 ?
            <div className="chat__lista-vazia">
                <div className="chat__lista-vazia-icone">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="chat__lista-vazia-titulo">Nenhum contato disponível</h3>
                  <p className="chat__lista-vazia-descricao">
                    Ainda não há outros usuários cadastrados para iniciar uma conversa.
                  </p>
                </div>
              </div> :
            filteredConversations.length === 0 ?
            <div className="chat__busca-vazia">
                <p className="chat__busca-vazia-titulo">Nenhuma conversa encontrada</p>
                <p className="chat__busca-vazia-descricao">Verifique os filtros ou busque por outro profissional.</p>
              </div> :

            filteredConversations.map((conv) => {
              const isActive = selectedConvId === conv.id;
              const isConvFavorite = !!conv.favorite;
              const hasUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`grupo-interativo chat__contato ${
                  hasUnread ?
                  "chat__contato--nao-lido" :
                  isActive ?
                  "chat__contato--ativo" :
                  "chat__contato--padrao"}`
                  }>
                  
                    {/* Avatar da Conversa */}
                    <div className="chat__contato-avatar">
                      <ChatAvatar
                      avatarUrl={conv.profile.avatar_url}
                      fullName={conv.name}
                      tamanho="medio"
                      isOnline={usuarioEstaOnline(conv.profile.last_seen)} />
                    
                    </div>

                    {/* Conteúdo Textual */}
                    <div className="chat__contato-conteudo">
                      <div className="chat__contato-cabecalho">
                        <h4 className={`chat__contato-nome ${hasUnread ? "chat__contato-nome--nao-lido" : "chat__texto-secundario"}`}>
                          {conv.name}
                        </h4>
                        <span className={`chat__contato-hora ${hasUnread ? "chat__contato-hora--nao-lido" : "chat__texto-suave"}`}>
                          {conv.time}
                        </span>
                      </div>
                      <p className="chat__contato-subtitulo">
                        {conv.subtitle}
                      </p>

                      {/* Display da prévia com indicador de quem enviou */}
                      {(() => {
                      const lastMsgObj = lastMessagesMap[conv.id];
                      const lastMessagePrefix = lastMsgObj ?
                      lastMsgObj.sender_id === user?.id ? "Você" : conv.name.split(" ")[0] || "Colega" :
                      "";
                      return (
                        <div className="chat__contato-previa-linha">
                            <p className="chat__contato-previa">
                              {lastMsgObj ?
                            <>
                                  <span className="chat__contato-previa-autor">{lastMessagePrefix}: </span>
                                  {lastMsgObj.content || "Enviou um anexo"}
                                </> :

                            <span className="chat__contato-sem-mensagem">Nenhuma mensagem ainda.</span>
                            }
                            </p>
                            {conv.unreadCount > 0 &&
                          <span className="chat__contato-contador-nao-lidas">
                                {conv.unreadCount}
                              </span>
                          }
                          </div>);

                    })()}
                    </div>

                    {/* Opções e favoritar */}
                    <div className="chat__contato-acoes">
                      <button
                      onClick={(e) => toggleFavorite(conv.id, e)}
                      className={`chat__favorito-botao ${
                      isConvFavorite ? "chat__favorito-botao--ativo" : ""}`
                      }
                      title={isConvFavorite ? "Remover dos favoritos" : "Marcar como favorita"}>
                      
                        <Star size={12} fill={isConvFavorite ? "currentColor" : "none"} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>);

            })
            }
          </div>

          {/* Rodapé da Sidebar */}
          <div className="chat__conversas-rodape">
            <span>Laboratório Cedro</span>
            <span>{filteredConversations.length} Contatos</span>
          </div>
        </div>

        {/* ÁREA DIREITA - Conversa ativa com os usuários reais */}
        <div id="chat-conversa" className={`chat__painel-conversa ${!selectedConvId ? "chat__painel--oculto-mobile" : "chat__painel--visivel-mobile"}`}>
          
          {activeConvObj && selectedRecipient ?
          <>
              {/* HEADER DA CONVERSA ATIVA */}
              <div className="cedro-chat-conversation-header chat__conversa-cabecalho">
                <div className="chat__conversa-cabecalho-conteudo">
                  
                  {/* Botão voltar para lista no layout mobile */}
                  <button
                    type="button"
                    onClick={voltarParaListaDeConversas}
                    className="chat__conversa-voltar"
                    title="Voltar para lista"
                    aria-label="Voltar para a lista de conversas">
                  
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>

                  <ChatAvatar
                  avatarUrl={selectedRecipient.avatar_url}
                  fullName={selectedRecipient.full_name}
                  tamanho="principal"
                  destaque
                  isOnline={usuarioEstaOnline(selectedRecipient.last_seen)} />
                

                  <div className="chat__usuario-resumo">
                    <div className="chat__usuario-titulo-linha">
                      <h3 className="chat__usuario-nome">
                        {selectedRecipient.full_name}
                      </h3>
                      {selectedRecipient.role === "admin" &&
                    <span className="chat__usuario-badge-admin">ADM</span>
                    }
                    </div>
                    <div className="chat__usuario-meta">
                      <span className="chat__usuario-cargo-setor">{selectedRecipient.setor || "Sem setor"} • {selectedRecipient.cargo || "Membro Cedro"}</span>
                      <span className="chat__usuario-presenca">
                        <span className={`chat__usuario-presenca-ponto ${usuarioEstaOnline(selectedRecipient.last_seen) ? "chat__usuario-presenca-ponto--online" : "chat__usuario-presenca-ponto--offline"}`} />
                        <span className={usuarioEstaOnline(selectedRecipient.last_seen) ? "chat__usuario-presenca-texto--online" : "chat__usuario-presenca-texto--offline"}>
                          {usuarioEstaOnline(selectedRecipient.last_seen) ? "Online" : "Offline"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Ações compactas: não disputam espaço com nome/status no mobile. */}
                  <div className="chat__conversa-acoes">
                  <button
                    onClick={() => setChatSearchOpen((prev) => {
                      if (prev) setChatSearchQuery("");
                      return !prev;
                    })}
                    className={`chat__conversa-acao ${
                    chatSearchOpen ?
                    "chat__conversa-acao--ativo" :
                    "chat__conversa-acao--padrao"}`
                    }
                    title="Pesquisar na conversa">
                    
                    <Search size={14} strokeWidth={2.5} />
                  </button>

                  <button
                    onClick={() => setViewingProfile(selectedRecipient)}
                    className="chat__perfil-botao"
                    title="Mais opções">
                    
                    <MoreVertical size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
              </div>

              {/* BARRA DE PESQUISA INTERNA ATIVA */}
              <AnimatePresence>
                {chatSearchOpen &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="chat__pesquisa-interna">
                
                    <Search size={13} className="chat__pesquisa-interna-icone" />
                    <input
                  type="text"
                  placeholder="Filtrar por palavras-chave na conversa..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="chat__pesquisa-interna-campo" />
                
                    {chatSearchQuery &&
                <button
                  onClick={() => setChatSearchQuery("")}
                  className="chat__pesquisa-interna-limpar">
                  
                        <X size={12} />
                      </button>
                }
                  </motion.div>
              }
              </AnimatePresence>

              {/* CORPO DE MENSAGENS */}
              <div
              ref={scrollRef}
              id="chat-area-mensagens"
              className="rolagem-personalizada chat__mensagens">
              
                {activeMessagesToShow.length === 0 ?
              <div className="chat__mensagens-vazio">
                    <div className="chat__mensagens-vazio-icone">
                      <MessageSquare size={18} />
                    </div>
                    <h3 className="chat__mensagens-vazio-titulo">Nenhuma mensagem ainda</h3>
                    <p className="chat__mensagens-vazio-descricao">
                      Envie uma mensagem para iniciar a conversa.
                    </p>
                  </div> :

              (() => {
                const elements: React.ReactNode[] = [];
                let lastMessageDateStr = "";

                activeMessagesToShow.forEach((msg, idx) => {
                  const idOwn = msg.sender_id === user?.id;

                  // Adicionar separador de data se o dia mudou
                  const msgDateStr = msg.created_at;
                  if (!lastMessageDateStr || !datasNoMesmoDia(lastMessageDateStr, msgDateStr)) {
                    elements.push(
                      <div key={`date-${msg.id}`} className="chat__separador-data">
                            <div className="chat__separador-data-linha"></div>
                            <span className="chat__separador-data-texto">
                              {rotuloDataAmigavel(msgDateStr)}
                            </span>
                            <div className="chat__separador-data-linha"></div>
                          </div>
                    );
                    lastMessageDateStr = msgDateStr;
                  }

                  const showAvatar = idx === 0 || activeMessagesToShow[idx - 1].sender_id !== msg.sender_id || (elements[elements.length - 1] as any)?.key?.startsWith("date-");

                  elements.push(
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`chat__mensagem ${idOwn ? "chat__mensagem--enviada" : "chat__mensagem--recebida"}`}>
                      
                          {/* Avatar */}
                          <div className="chat__mensagem-avatar-coluna">
                            {showAvatar &&
                        <div className="chat__mensagem-avatar-bloco">
                                <button
                            onClick={() => msg.sender_profile && setViewingProfile(msg.sender_profile as UserProfile)}
                            className="chat__mensagem-avatar-botao">
                            
                                  <ChatAvatar
                              avatarUrl={msg.sender_profile?.avatar_url}
                              fullName={msg.sender_profile?.full_name}
                              tamanho="pequeno" />
                            
                                </button>
                                <span className="chat__mensagem-avatar-nome">
                                  {(msg.sender_profile?.full_name || "Membro").split(" ")[0]}
                                </span>
                              </div>
                        }
                          </div>
                          
                          {/* Conteúdo do balão */}
                          <div className={`chat__mensagem-conteudo ${idOwn ? "chat__mensagem-conteudo--enviada" : "chat__mensagem-conteudo--recebida"}`}>
                            {showAvatar &&
                        <div className={`chat__mensagem-autor-linha ${idOwn ? "chat__mensagem-autor-linha--enviada" : "chat__mensagem-autor-linha--recebida"}`}>
                                <span className="chat__mensagem-autor">
                                  {msg.sender_profile?.full_name || "Membro Cedro"}
                                </span>
                                {msg.status === "sending" ?
                          <span className="chat__mensagem-status-enviando">
                                    Enviando...
                                  </span> :
                          msg.status === "error" ?
                          <span className="chat__mensagem-status-erro">
                                    Falha ao enviar
                                  </span> :
                          null}
                              </div>
                        }
                            <div className={`chat__mensagem-balao ${
                        idOwn ?
                        "chat__mensagem-balao--enviada" :
                        "chat__mensagem-balao--recebida"}`
                        }>
                              {highlightTerm(msg.content, chatSearchQuery)}

                              {/* Exibição de Anexos */}
                              {(msg.attachment_url || msg.attachment_name) &&
                          <div className={`chat__anexo ${idOwn ? "chat__anexo--enviado" : "chat__anexo--recebido"}`}>
                                  <div className={`chat__anexo-icone ${idOwn ? "chat__anexo-icone--enviado" : "chat__anexo-icone--recebido"}`}>
                                    <FileText size={16} />
                                  </div>
                                  <div className="chat__informacao-textos">
                                    <p className={`chat__anexo-nome ${idOwn ? "chat__anexo-nome--enviado" : "chat__texto-secundario"}`}>{msg.attachment_name || "Documento"}</p>
                                    <p className={`chat__anexo-meta ${idOwn ? "chat__anexo-meta--enviado" : "chat__texto-suave"}`}>
                                      {msg.attachment_size ? `${Math.round(msg.attachment_size / 1024)} KB` : "Arquivo"}
                                      {msg.status === "sending" && <span className="chat__anexo-status">(Anexando...)</span>}
                                    </p>
                                  </div>
                                  {msg.attachment_url ?
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noreferrer referrer"
                              className={`chat__anexo-download ${idOwn ? "chat__anexo-download--enviado" : "chat__anexo-download--recebido"}`}
                              title="Baixar anexo">
                              
                                      <Download size={14} />
                                    </a> :

                            <span className="chat__anexo-processando">...</span>
                            }
                                </div>
                          }
                            </div>

                            {/* Horário abaixo da mensagem (conforme especificação) */}
                            {msg.status !== "sending" && msg.status !== "error" &&
                        <div className="chat__mensagem-hora">
                                {formatarHorarioMensagem(msg.created_at)}
                              </div>
                        }

                            {!showAvatar && (msg.status === "sending" || msg.status === "error") &&
                        <div className={`chat__mensagem-status-linha ${idOwn ? "chat__mensagem-status-linha--enviada" : "chat__mensagem-status-linha--recebida"}`}>
                                {msg.status === "sending" && <span className="chat__mensagem-status-enviando-secundario">Enviando...</span>}
                                {msg.status === "error" && <span className="chat__mensagem-status-erro-secundario">Falha ao enviar</span>}
                              </div>
                        }
                          </div>
                        </motion.div>
                  );
                });

                return elements;
              })()
              }
              </div>

              {/* BARRA DE PRÉVIA DE ANEXO SELECIONADO */}
              {selectedFile &&
            <div className="chat__anexo-preview">
                  <div className="chat__anexo-preview-info">
                    <Paperclip size={14} className="chat__anexo-preview-icone" />
                    <span className="chat__anexo-preview-nome">{selectedFile.name}</span>
                    <span className="chat__anexo-preview-tamanho">({Math.round(selectedFile.size / 1024)} KB)</span>
                  </div>
                  <button
                onClick={handleRemoveFile}
                className="chat__anexo-preview-remover"
                title="Remover anexo">
                
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
            }

              {/* BARRA DE AVISOS OU ERROS DE SISTEMA */}
              {uiError &&
            <div className="chat__aviso">
                  ⚠️ {uiError}
                </div>
            }

              {/* CAMPO DE COMPOSIÇÃO FIXO (RODAPÉ) */}
              <div id="chat-composer" className="chat__composer">
                
                {/* Painel do Seletor de Emojis */}
                <AnimatePresence>
                  {isEmojiOpen &&
                <>
                      <div
                    className="chat__emoji-overlay"
                    onClick={() => setIsEmojiOpen(false)} />
                  
                      <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="chat__emoji-painel">
                    
                        {EMOJIS_SUGERIDOS.map((emoji) =>
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="chat__emoji-opcao">
                      
                            {emoji}
                          </button>
                    )}
                      </motion.div>
                    </>
                }
                </AnimatePresence>

                <form onSubmit={handleSendMessage} className="chat__composer-formulario">
                  
                  {/* Inputs ocultos de arquivos */}
                  <input
                  type="file"
                  ref={fileInputRef}
                  className="chat__arquivo-input"
                  onChange={handleFileSelect} />
                

                  {/* Anexar arquivo e emojis */}
                  <div className="chat__composer-acoes">
                    <button
                    type="button"
                    onClick={handleFileClick}
                    className="chat__composer-acao"
                    title="Anexar parecer de IA ou arquivos">
                    
                      <Paperclip size={16} />
                    </button>
                    <button
                    type="button"
                    onClick={() => setIsEmojiOpen((prev) => !prev)}
                    className={`chat__composer-acao ${isEmojiOpen ? "chat__composer-acao--ativo" : ""}`}
                    title="Inserir emoji">
                    
                      <Smile size={16} />
                    </button>
                  </div>

                  <input
                  type="text"
                  ref={inputRef}
                  placeholder="Digite sua mensagem corporativa..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="chat__composer-campo"
                  disabled={uploading} />
                
                  
                  <button
                  type="submit"
                  disabled={!newMessage.trim() && !selectedFile || uploading}
                  className="chat__composer-enviar"
                  title="Enviar">
                  
                    <Send size={15} fill="currentColor" />
                  </button>
                </form>

                <div className="chat__composer-seguranca">
                  <span className="chat__composer-seguranca-texto">
                    <span className="chat__composer-seguranca-ponto" /> Mensagem segura e confidencial
                  </span>
                  <span>Canal interno</span>
                </div>
              </div>
            </> : (

          /* ESTADO VAZIO DA CONVERSA */
          <div className="chat__estado-vazio">
            <div className="chat__estado-vazio-conteudo">
              <div className="chat__estado-vazio-centro">
                <div className="chat__estado-vazio-icone">
                  <MessageSquare size={28} />
                </div>
                <h3 className="chat__estado-vazio-titulo">
                  Selecione uma conversa
                </h3>
                <p className="chat__estado-vazio-descricao">
                  Escolha um contato ao lado para iniciar ou continuar uma conversa.
                </p>
              </div>
            </div>

            <div className="chat__composer-vazio" aria-hidden="true">
              <span className="chat__composer-vazio-anexo">
                <Paperclip size={18} />
              </span>
              <span className="chat__composer-vazio-placeholder">Digite sua mensagem...</span>
              <span className="chat__composer-vazio-enviar">
                <Send size={17} />
              </span>
            </div>
          </div>)
          }
        </div>
      </div>

      {/* MODAL INICIAR NOVA CONVERSA */}
      <AnimatePresence>
        {isNewChatOpen &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="cedro-modal-overlay chat-nova-conversa__overlay"
          onClick={() => {
            setIsNewChatOpen(false);
            setNewChatSearch("");
          }}>
          
            <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="cedro-modal-painel chat-nova-conversa__painel"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="cedro-modal-cabecalho chat-nova-conversa__cabecalho">
                <div>
                  <h3 className="chat-nova-conversa__titulo">Iniciar Conversa</h3>
                  <p className="chat-nova-conversa__subtitulo">Selecione um profissional do Cedro Labs</p>
                </div>
                <button
                onClick={() => {
                  setIsNewChatOpen(false);
                  setNewChatSearch("");
                }}
                className="chat-nova-conversa__fechar">
                
                  <X size={16} />
                </button>
              </div>

              <div className="chat-nova-conversa__busca-area">
                <div className="chat-nova-conversa__busca">
                  <Search size={13} className="chat-nova-conversa__busca-icone" />
                  <input
                  type="text"
                  placeholder="Buscar profissional por nome, setor ou cargo..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  className="chat-nova-conversa__busca-campo" />
                
                </div>
              </div>

              <div className="rolagem-personalizada chat-nova-conversa__lista">
                {modalUsersRoster.length === 0 ?
              <div className="chat-nova-conversa__vazio">
                    <p className="chat-nova-conversa__vazio-texto">Profissional não cadastrado</p>
                  </div> :

              modalUsersRoster.map((rosterUser) =>
              <div
                key={rosterUser.id}
                onClick={() => {
                  setSelectedConvId(rosterUser.id);
                  setIsNewChatOpen(false);
                  setNewChatSearch("");
                }}
                className="chat-nova-conversa__contato">
                
                      <ChatAvatar
                  avatarUrl={rosterUser.avatar_url}
                  fullName={rosterUser.full_name}
                  tamanho="medio" />
                
                      <div className="chat__usuario-resumo">
                        <h4 className="chat-nova-conversa__contato-nome">{rosterUser.full_name}</h4>
                        <p className="chat-nova-conversa__contato-cargo">{rosterUser.cargo}</p>
                        <p className="chat-nova-conversa__contato-setor">{rosterUser.setor || "NIT / Cedro"}</p>
                      </div>
                    </div>
              )
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* MODAL AUDITOR VERIFICADO DE PERFIL */}
      <AnimatePresence>
        {viewingProfile &&
        <ProfileModal
          profile={viewingProfile}
          onClose={() => setViewingProfile(null)} />

        }
      </AnimatePresence>
    </div>);

};
