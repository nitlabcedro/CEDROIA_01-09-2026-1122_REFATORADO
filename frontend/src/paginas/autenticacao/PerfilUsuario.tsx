import { ROTAS_API } from "@/constantes/api";
import { TABELAS_SUPABASE } from "@/constantes/supabase";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contextos/ContextoAutenticacao";
import { requisicaoApi } from "@/servicos/api";
import { supabase } from "@/servicos/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import {
  User,
  Mail,
  Briefcase,
  Building,
  Phone,
  Save,
  Loader2,
  Camera,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock3,
  Fingerprint,
  Lock,
  Info,
  AppWindow,
  Sparkles,
  CheckCircle2,
  X } from
"lucide-react";
import { getSectors } from "@/servicos/armazenamento";
import { obterCargosDoSetor } from "@/servicos/setores";
import { usuarioEhAdmin } from "@/utilitarios/permissoes";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";

export const UserProfileView: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    cargo: profile?.cargo || "",
    setor: profile?.setor || "",
    contato: profile?.contato || "",
    avatar_url: profile?.avatar_url || ""
  });
  const [message, setMessage] = useState<{type: "success" | "error";text: string;} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile?.avatar_url || "");
  const [cargosDisponiveis, setCargosDisponiveis] = useState<string[]>([]);
  const [editCombos, setEditCombos] = useState<Array<{setor: string;cargo: string;}>>([]);
  const [cargosPorSetor, setCargosPorSetor] = useState<Record<string, string[]>>({});

  const fetchCargosParaSetor = async (sectorName: string) => {
    if (!sectorName || cargosPorSetor[sectorName]) return;
    const cargos = await obterCargosDoSetor(sectorName);
    setCargosPorSetor((prev) => ({ ...prev, [sectorName]: cargos }));
  };

  useEffect(() => {
    editCombos.forEach((combo) => {
      if (combo.setor) {
        fetchCargosParaSetor(combo.setor);
      }
    });
  }, [editCombos]);

  useEffect(() => {
    const currentSector = formData.setor;
    if (!currentSector) {
      setCargosDisponiveis([]);
      return;
    }

    const loadCargos = async () => {
      setCargosDisponiveis(await obterCargosDoSetor(currentSector));
    };
    loadCargos();
  }, [formData.setor]);

  // Password alteration modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{type: "success" | "error";text: string;} | null>(null);

  useEffect(() => {
    const fetchSectors = async () => {
      const list = await getSectors();
      setSectors(list);
    };
    fetchSectors();
  }, []);

  // Sincroniza os dados locais com o perfil global da sessão de maneira reativa e otimista
  useEffect(() => {
    if (profile) {
      const defaultContato = profile.contato || user?.email || "";
      setFormData({
        full_name: profile.full_name || "",
        cargo: profile.cargo || "",
        setor: profile.setor || "",
        contato: defaultContato,
        avatar_url: profile.avatar_url || ""
      });
      setAvatarPreview(profile.avatar_url || "");

      const sList = (profile.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
      const cList = (profile.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);
      const list = sList.length > 0 ? sList.map((sec, idx) => ({
        setor: sec,
        cargo: cList[idx] || "Colaborador"
      })) : [{ setor: "", cargo: "" }];
      setEditCombos(list);

      // Se o campo de contato na tabela profiles estiver vazio no banco de dados e tivermos o email do usuario
      if (!profile.contato && user?.email) {
        console.log("Sincronizando silenciosamente o contato com o email do auth do usuario:", user.email);
        supabase.
        from(TABELAS_SUPABASE.PERFIS).
        update({ contato: user.email }).
        eq("id", user.id).
        then(({ error }) => {
          if (!error) {
            console.log("Contato sincronizado na tabela de profiles do Supabase com sucesso!");
            refreshProfile({ contato: user.email }, true).catch(() => {});
          }
        });
      }
    }
  }, [profile, user]);

  useEffect(() => {
    if (user?.id) {
      refreshProfile();
    }
  }, [user?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMessage(null);

      if (!user) {
        throw new Error("Usuário não encontrado para atualizar a foto.");
      }

      const file = e.target.files?.[0];

      if (!file) {
        return;
      }

      const localPreviewUrl = URL.createObjectURL(file);

      setAvatarPreview(localPreviewUrl);
      setFormData((prev) => ({
        ...prev,
        avatar_url: localPreviewUrl
      }));

      // Atualiza o contexto global do perfil de forma instantânea/otimista
      refreshProfile({ avatar_url: localPreviewUrl }, true).catch((err) => {
        console.error("Erro ao atualizar o avatar de forma otimista:", err);
      });

      setUploading(true);

      // Conversão do arquivo selecionado para Base64
      const reader = new FileReader();
      const fileLoadedPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Str = result.split(",")[1];
          resolve(base64Str);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const base64Data = await fileLoadedPromise;

      // Obter o token de autenticação atualizado para validar a requisição na API
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Sessão não encontrada ou expirada. Faça login novamente.");
      }

      // Enviar via proxy seguro no servidor
      const response = await requisicaoApi(ROTAS_API.AVATAR_UPLOAD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileBase64: base64Data,
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro de rede no servidor: ${response.status}`);
      }

      const resJson = await response.json();
      const finalAvatarUrl = `${resJson.publicUrl}?t=${Date.now()}`;

      setAvatarPreview(finalAvatarUrl);

      setFormData((prev) => ({
        ...prev,
        avatar_url: finalAvatarUrl
      }));

      refreshProfile({ avatar_url: finalAvatarUrl }).catch((err) => {
        console.error("Erro ao atualizar perfil após upload:", err);
      });

      setMessage({ type: "success", text: "Foto atualizada com sucesso." });
    } catch (err: unknown) {
      console.error("Erro ao atualizar foto:", err);
      setMessage({ type: "error", text: obterMensagemErroUsuario(err, "perfil") });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };


  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setMessage(null);

    const isCurrentUserAdmin = usuarioEhAdmin(profile);
    let updatedFormData = { ...formData };

    if (isCurrentUserAdmin) {
      const validCombos = editCombos.filter((c) => c.setor && c.cargo);
      if (validCombos.length === 0) {
        setMessage({ type: "error", text: "Por favor, adicione pelo menos uma atribuição de setor e cargo / função." });
        setLoading(false);
        return;
      }

      const finalSetor = validCombos.map((c) => c.setor.trim()).join("; ");
      const finalCargo = validCombos.map((c) => c.cargo.trim()).join("; ");

      updatedFormData = {
        ...formData,
        setor: finalSetor,
        cargo: finalCargo
      };
    }

    try {
      const { error } = await supabase.
      from(TABELAS_SUPABASE.PERFIS).
      upsert({
        id: user.id,
        ...updatedFormData,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      await refreshProfile(updatedFormData);
      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: unknown) {
      console.error("Erro ao atualizar perfil:", error);
      setMessage({ type: "error", text: obterMensagemErroUsuario(error, "perfil") });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "As senhas informadas não coincidem." });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "A nova senha deve possuir pelo menos 6 caracteres." });
      return;
    }

    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setPasswordMessage({ type: "success", text: "Senha corporativa atualizada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordMessage(null);
      }, 2500);
    } catch (err: unknown) {
      console.error("Erro ao atualizar senha pelo perfil:", err);
      setPasswordMessage({ type: "error", text: obterMensagemErroUsuario(err, "redefinicao-senha") });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Human readable registration date
  const formattedCreatedDate = user?.created_at ?
  new Date(user.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) :
  "Março de 2026";

  const formattedLastAccess = user?.last_sign_in_at ?
  new Date(user.last_sign_in_at).toLocaleString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) :
  "Sessão atual";

  const isCurrentUserAdmin = usuarioEhAdmin(profile);
  const avatarSrc = avatarPreview || "";

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 220, damping: 22 }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05
          }
        }
      }}
      id="perfil-conteudo"
      data-componente="pagina-perfil"
      className="pagina-perfil perfil-container cedro-page-premium">

      {/* <motion.header variants={itemVariants} className="perfil__cabecalho-pagina">
        <div className="perfil__cabecalho-pagina-icone" aria-hidden="true">
          <User size={28} />
        </div>
        <div className="perfil__cabecalho-pagina-textos">
          <h1>Meu Perfil</h1>
          <p>Gerencie suas informações pessoais, cargos, permissões e preferências da sua conta.</p>
        </div>
      </motion.header> */}
      
      <div className="perfil__grupo">
        {/* CARD HERO DO PERFIL */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { type: "spring", stiffness: 180, damping: 20 }
            }
          }}
          className="perfil-cabecalho cedro-profile-hero perfil__perfil-cabecalho-estrutura">
          
          {/* Subtle decorative glowing background blur */}
          <div className="perfil__grupo-2" />
          <div className="perfil__grupo-3" />

          <div className="perfil__grupo-4">
            {/* Avatar container with solid green border */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              className="perfil-avatar perfil__perfil-avatar-estrutura">
              
              <div className="perfil__grupo-5">
                <div className="perfil__grupo-6">
                  {avatarSrc ?
                  <div className="perfil__grupo-7">
                      <img
                      src={avatarSrc}
                      alt="Avatar Usuário"
                      className="perfil__imagem"
                      referrerPolicy="no-referrer" />
                    

                      {uploading &&
                    <div className="perfil__grupo-8">
                          <Loader2 className="perfil__icone-loader2" />
                        </div>
                    }
                    </div> :
                  uploading ?
                  <Loader2 className="perfil__icone-loader2-2" /> :

                  <User size={48} className="perfil__icone-user" />
                  }
                </div>
              </div>
              <motion.label
                whileHover={{ scale: 1.1, backgroundColor: "#003F1D" }}
                whileTap={{ scale: 0.9 }}
                htmlFor="campoAvatarPerfil"
                className={`perfil__elemento-modificar-imagem ${uploading ? "perfil__elemento-modificar-imagem-2" : "perfil__elemento-modificar-imagem-3"}`}
                title="Modificar imagem">
                
                <Camera size={13} />
                <input
                  id="campoAvatarPerfil"
                  type="file"
                  accept="image/*"
                  className="perfil__campo-campoavatarperfil"
                  onChange={handleAvatarUpload}
                  disabled={uploading} />
                
              </motion.label>

              {uploading &&
              <div className="perfil__grupo-enviando-foto">
                  <p className="perfil__descricao-enviando-foto">
                    Enviando foto...
                  </p>
                  <p className="perfil__descricao-aguarde-alguns-segundos-ate-a-">
                    Aguarde alguns segundos até a imagem ser salva no perfil.
                  </p>
                </div>
              }
            </motion.div>

            {/* User Meta Information Group */}
            <div className="perfil-identidade perfil__perfil-identidade-estrutura">
              <div className="perfil__grupo-9">
                <h2 className="perfil__titulo-secao">
                  {formData.full_name || user?.email?.split("@")[0] || "Membro Cedro"}
                </h2>
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  className="perfil__elemento">
                  
                  {profile?.role === "admin" ? "Administrador" : "Colaborador"}
                </motion.span>
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  className="perfil__elemento-ativo">
                  
                  Ativo
                </motion.span>
              </div>
              
              <div className="perfil__grupo-10">
                {(() => {
                  const sectors = (formData.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
                  const cargos = (formData.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);

                  if (sectors.length === 0) {
                    return (
                      <span className="perfil__texto-nenhuma-atribuicao-declarada">
                        Nenhuma atribuição declarada
                      </span>);

                  }

                  return sectors.map((sec, idx) => {
                    const carg = cargos[idx] || "Colaborador";
                    return (
                      <motion.div
                        key={idx}
                        whileHover={{ scale: 1.03, y: -1 }}
                        className="perfil__elemento-2">
                        
                        <span className="perfil__texto">{sec}</span>
                        <span className="perfil__texto-2">{carg}</span>
                      </motion.div>);

                  });
                })()}
              </div>
            </div>
          </div>

          {/* Sair da Conta Button right-aligned with red outline styling */}
          <div className="perfil__grupo-sair-da-conta">
            <motion.button
              whileHover={{ scale: 1.03, backgroundColor: "#FEE4E2" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signOut()}
              className="perfil__elemento-sair-da-conta">
              
              <LogOut size={14} />
              Sair da Conta
            </motion.button>
          </div>
        </motion.div>

        {/* COMPOSIÇÃO DE DUAS COLUNAS ABAIXO DO HERO */}
        <div className="perfil-dados perfil__perfil-dados-estrutura" style={{ perspective: 1200 }}>
          
          {/* COLUNA ESQUERDA: CARDS MENORES */}
          <div className="perfil__grupo-11">
            
            {/* CARD 1: RESUMO DO PERFIL */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 180, damping: 20 }
                }
              }}
              className="cedro-card-premium perfil__elemento-resumo-do-perfil">
              
              <div className="perfil__grupo-resumo-do-perfil">
                <div>
                  <h4 className="perfil__titulo-item-resumo-do-perfil">Resumo da conta</h4>
                </div>
              </div>

              <div className="perfil__grupo-12">
                {/* Usuário desde */}
                <motion.div variants={itemVariants} className="perfil__elemento-3">
                  <div className="perfil__grupo-13">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="perfil__descricao-usuario-desde">Usuário desde</p>
                    <p className="perfil__descricao">{formattedCreatedDate}</p>
                  </div>
                </motion.div>

                {/* Autorização de acesso */}
                <motion.div variants={itemVariants} className="perfil__elemento-3">
                  <div className="perfil__grupo-13">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="perfil__descricao-usuario-desde">Autorização de acesso</p>
                    <p className="perfil__descricao">Sessão estabelecida e ativa</p>
                  </div>
                </motion.div>

                {/* Último acesso */}
                <motion.div variants={itemVariants} className="perfil__elemento-3">
                  <div className="perfil__grupo-13">
                    <Clock3 size={18} />
                  </div>
                  <div>
                    <p className="perfil__descricao-usuario-desde">Último acesso</p>
                    <p className="perfil__descricao">{formattedLastAccess}</p>
                  </div>
                </motion.div>

                {/* Nível de acesso */}
                <motion.div variants={itemVariants} className="perfil__elemento-3">
                  <div className="perfil__grupo-13">
                    <Fingerprint size={18} />
                  </div>
                  <div>
                    <p className="perfil__descricao-usuario-desde">Nível de acesso</p>
                    <span className="perfil__nivel-acesso">
                      {profile?.role === "admin" ? "Administrador" : "Colaborador"}
                    </span>
                  </div>
                </motion.div>




              </div>
            </motion.div>

          </div>

          {/* COLUNA DIREITA: CARD GRANDE DE INFORMAÇÕES PESSOAIS */}
          <div className="perfil__grupo-informacoes-pessoais">
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 180, damping: 20 }
                }
              }}
              className="cedro-card-premium perfil__elemento-informacoes-pessoais">
              
              <div className="perfil__grupo-informacoes-pessoais-2">
                <h3 className="perfil__titulo-bloco-informacoes-pessoais">Informações Pessoais</h3>
              </div>

              <form className="perfil-formulario perfil__perfil-formulario-estrutura" onSubmit={handleUpdate}>
                <div className="perfil__grupo-14">
                  
                  {/* Nome Completo field */}
                  <motion.div variants={itemVariants} className="perfil__elemento-nome-completo">
                    <label className="perfil__rotulo-nome-completo">
                      <User size={12} className="perfil__icone-user-2" /> Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="perfil__campo-ex-carlos-ferreira"
                      placeholder="Ex: Carlos Ferreira" />
                    
                  </motion.div>

                  {/* E-mail (Disabled, informational only) */}
                  <motion.div variants={itemVariants} className="perfil__elemento-nome-completo">
                    <label className="perfil__rotulo-nome-completo">
                      <Mail size={12} className="perfil__icone-user-2" /> E-mail Credenciado
                    </label>
                    <input
                      type="text"
                      value={user?.email || ""}
                      disabled
                      className="perfil__campo" />
                    
                  </motion.div>

                  {/* Cargo/Setor (Editável se Administrador, caso contrário Apenas Leitura) */}
                  <motion.div variants={itemVariants} className="perfil__elemento-cargo-setor">
                    <label className="perfil__rotulo-nome-completo">
                      <Building size={12} className="perfil__icone-user-2" /> Cargo/Setor
                    </label>

                    {isCurrentUserAdmin ?
                    <>
                        <div className="perfil__grupo-15">
                          {editCombos.map((combo, index) =>
                        <div key={index} className="perfil__grupo-16">
                              <div className="perfil__grupo-atribuicao">
                                <span className="perfil__texto-atribuicao">Atribuição #{index + 1}</span>
                                {editCombos.length > 1 &&
                            <button
                              type="button"
                              onClick={() => {
                                const newCombos = editCombos.filter((_, i) => i !== index);
                                setEditCombos(newCombos);
                              }}
                              className="perfil__botao-remover">
                              
                                    Remover
                                  </button>
                            }
                              </div>
                              
                              {/* Select Setor */}
                              <CustomDropdown
                            placeholder="Selecione o setor..."
                            value={combo.setor}
                            options={sectors}
                            onChange={(sec) => {
                              const newCombos = [...editCombos];
                              newCombos[index] = { setor: sec, cargo: "" };
                              setEditCombos(newCombos);
                              fetchCargosParaSetor(sec);
                            }}
                            icon={<Building size={14} />}
                            size="md" />
                          

                              {/* Select Cargo */}
                              <CustomDropdown
                            placeholder={combo.setor ? "Selecione o cargo..." : "Selecione o setor primeiro"}
                            value={combo.cargo}
                            options={cargosPorSetor[combo.setor] || []}
                            onChange={(carg) => {
                              const newCombos = [...editCombos];
                              newCombos[index].cargo = carg;
                              setEditCombos(newCombos);
                            }}
                            icon={<Briefcase size={14} />}
                            disabled={!combo.setor}
                            size="md" />
                          
                            </div>
                        )}
                        </div>
                        
                        <button
                        type="button"
                        onClick={() => setEditCombos([...editCombos, { setor: "", cargo: "" }])}
                        className="perfil__botao-adicionar-outro-cargo-setor">
                        
                          + Adicionar outro Cargo/Setor
                        </button>
                      </> :

                    <div className="perfil__grupo-17">
                        {(() => {
                        const sList = (profile?.setor || "").split(";").map((s) => s.trim()).filter(Boolean);
                        const cList = (profile?.cargo || "").split(";").map((c) => c.trim()).filter(Boolean);

                        if (sList.length === 0) {
                          return (
                            <span className="perfil__texto-nenhuma-atribuicao-declarada-2">
                                Nenhuma atribuição declarada
                              </span>);

                        }

                        return sList.map((sec, idx) => {
                          const carg = cList[idx] || "Colaborador";
                          return (
                            <div key={idx} className="perfil__grupo-18">
                                <span className="perfil__texto-3">{sec}</span>
                                <span className="perfil__texto-4">{carg}</span>
                              </div>);

                        });
                      })()}
                      </div>
                    }
                  </motion.div>

                  {/* URL da foto de perfil — oculto na interface; valor ainda pode ser definido por upload/outros fluxos */}
                  <motion.div variants={itemVariants} className="perfil__elemento-url-da-foto-de-perfil" hidden>
                    <label className="perfil__rotulo-nome-completo">
                      <Camera size={12} className="perfil__icone-user-2" /> URL da foto de perfil
                    </label>
                    <input
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, avatar_url: val });
                        setAvatarPreview(val);
                      }}
                      className="perfil__campo-ex-carlos-ferreira"
                      placeholder="https://exemplo.com/foto.jpg" />
                    
                  </motion.div>

                </div>

                {/* Feedback message display */}
                {message &&
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`perfil__elemento-8 ${
                  message.type === "success" ?
                  "perfil__elemento-9" :
                  "perfil__elemento-10"}`
                  }>
                  
                    {message.text}
                  </motion.div>
                }

                {/* Submit button using solid corporate primary green */}
                <motion.div variants={itemVariants}>
                  <motion.button
                    whileHover={{ scale: 1.015, backgroundColor: "#003F1D" }}
                    whileTap={{ scale: 0.995 }}
                    type="submit"
                    disabled={loading}
                    className="perfil__elemento-11">
                    
                    {loading ?
                    <Loader2 className="perfil__icone-loader2-3" size={18} /> :

                    <>
                        <Save size={18} />
                        Salvar Alterações
                      </>
                    }
                  </motion.button>
                </motion.div>
              </form>
            </motion.div>
          </div>

        </div>
      </div>

      {/* DIALOG/MODAL COMPLETO DE ALTERAÇÃO DE SENHA CORPORATIVA */}
      <AnimatePresence>
        {isPasswordModalOpen &&
        <div className="cedro-modal-overlay perfil__grupo-19">
            {/* Backdrop layer */}
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPasswordModalOpen(false)}
            className="perfil__elemento-12" />
          
            
            {/* Modal Body */}
            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="cedro-modal-painel cedro-modal-painel--compacto perfil__elemento-13">
            
              <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="perfil__botao">
              
                <X size={18} />
              </button>

              <div className="perfil__grupo-20">
                <div className="perfil__grupo-21">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="perfil__titulo-bloco-alterar-senha">Alterar Senha</h3>
                  <p className="perfil__descricao-garanta-a-seguranca-de-seus-ac">Garanta a segurança de seus acessos</p>
                </div>
              </div>

              <form className="perfil-formulario perfil-formulario-senha perfil__perfil-formulario-estrutura-2" onSubmit={handlePasswordChange}>
                <div className="perfil__grupo-nova-senha-corporativa">
                  <label className="perfil__rotulo-nova-senha-corporativa">Nova Senha Corporativa</label>
                  <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  className="perfil__campo-minimo-6-digitos" />
                
                </div>

                <div className="perfil__grupo-nova-senha-corporativa">
                  <label className="perfil__rotulo-nova-senha-corporativa">Confirmar Nova Senha</label>
                  <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className="perfil__campo-minimo-6-digitos" />
                
                </div>

                {passwordMessage &&
              <div className={`perfil__grupo-22 ${
              passwordMessage.type === "success" ?
              "perfil__elemento-9" :
              "perfil__elemento-10"}`
              }>
                    {passwordMessage.text}
                  </div>
              }

                <div className="perfil__grupo-cancelar">
                  <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="perfil__botao-cancelar">
                  
                    Cancelar
                  </button>
                  <button
                  type="submit"
                  disabled={passwordLoading}
                  className="perfil__botao-2">
                  
                    {passwordLoading ?
                  <Loader2 className="perfil__icone-loader2-3" size={14} /> :

                  "Confirmar Nova Senha"
                  }
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        }
      </AnimatePresence>
    </motion.div>);

};
