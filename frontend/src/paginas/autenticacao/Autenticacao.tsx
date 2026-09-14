import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { DOMINIO_EMAIL_INSTITUCIONAL } from "@/constantes/institucional";
import { TABELAS_SUPABASE } from "@/constantes/supabase";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/servicos/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Mail, Lock, User, Loader2, Building, Briefcase, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { getSectors } from "@/servicos/armazenamento";
import { obterCargosDoSetor } from "@/servicos/setores";
import { useAuth } from "@/contextos/ContextoAutenticacao";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";

interface AuthProps {
  onAuthSuccess?: () => void;
  mensagemInicial?: string | null;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess, mensagemInicial }) => {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [combos, setCombos] = useState<Array<{setor: string;cargo: string;}>>([
  { setor: "", cargo: "" }]
  );
  const [cargosPorSetor, setCargosPorSetor] = useState<Record<string, string[]>>({});
  const [sectors, setSectors] = useState<string[]>([]);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState<{type: "success" | "error";text: string;} | null>(
    mensagemInicial ? { type: "success", text: mensagemInicial } : null,
  );
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const paginaAutenticacaoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getSectors().then(setSectors);
    try {
      const savedEmail = localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.EMAIL_LEMBRADO);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.error("Erro ao ler e-mail lembrado do localStorage:", e);
    }
  }, []);

  useEffect(() => {
    // Login, cadastro e recuperacao possuem alturas diferentes. Ao trocar de
    // modo, navegadores mobile podem preservar a posicao anterior e esconder
    // o inicio ou o fim do formulario.
    const frame = window.requestAnimationFrame(() => {
      paginaAutenticacaoRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const fetchCargosParaSetor = async (sectorName: string) => {
    if (!sectorName || cargosPorSetor[sectorName]) return;
    const cargos = await obterCargosDoSetor(sectorName);
    setCargosPorSetor((prev) => ({ ...prev, [sectorName]: cargos }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          console.error("Erro ao enviar link de recuperação:", error);
          setMessage({
            type: "error",
            text: obterMensagemErroUsuario(error, "recuperacao-senha")
          });
        } else {
          setMessage({
            type: "success",
            text: "Enviamos um link de recuperação para o e-mail informado. Verifique sua caixa de entrada e spam."
          });
        }
        setLoading(false);
        return;
      }

      if (mode === "login") {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });
        if (error) throw error;

        // Carrega o perfil fresco imediatamente após login bem-sucedido
        if (authData?.user?.id) {
          try {
            await refreshProfile(undefined, false, authData.user.id);
          } catch (pError) {
            console.error("Erro ao sincronizar perfil pós-login:", pError);
          }
        }

        // Persistir/remover e-mail conforme checkbox "Lembrar-me"
        try {
          if (rememberMe) {
            localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.EMAIL_LEMBRADO, cleanEmail);
          } else {
            localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.EMAIL_LEMBRADO);
          }
        } catch (storageErr) {
          console.error("Erro ao salvar e-mail no localStorage:", storageErr);
        }

        if (onAuthSuccess) onAuthSuccess();
      } else {
        if (!cleanEmail.toLowerCase().endsWith(DOMINIO_EMAIL_INSTITUCIONAL)) {
          setMessage({
            type: "error",
            text: `Apenas e-mails institucionais (${DOMINIO_EMAIL_INSTITUCIONAL}) podem se cadastrar na plataforma.`
          });
          setLoading(false);
          return;
        }

        const validCombos = combos.filter((c) => c.setor && c.cargo);
        if (validCombos.length === 0) {
          setMessage({ type: "error", text: "Por favor, adicione pelo menos uma atribuição de setor e cargo / função." });
          setLoading(false);
          return;
        }

        const finalSetor = validCombos.map((c) => c.setor.trim()).join("; ");
        const finalCargo = validCombos.map((c) => c.cargo.trim()).join("; ");

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;

        const userId = data.user?.id;

        if (!userId) {
          throw new Error("Usuário não retornado após cadastro.");
        }

        const { data: existingProfile, error: existingProfileError } = await supabase.
        from(TABELAS_SUPABASE.PERFIS).
        select("id, role").
        eq("id", userId).
        maybeSingle();

        if (existingProfileError) {
          console.error("Erro ao verificar perfil existente:", existingProfileError);
          throw existingProfileError;
        }

        if (existingProfile) {
          const { error: updateProfileError } = await supabase.
          from(TABELAS_SUPABASE.PERFIS).
          update({
            full_name: fullName,
            setor: finalSetor,
            cargo: finalCargo,
            contato: cleanEmail,
            updated_at: new Date().toISOString()
          }).
          eq("id", userId);

          if (updateProfileError) {
            console.error("Erro ao atualizar perfil existente:", updateProfileError);
            throw updateProfileError;
          }
        } else {
          const { error: insertProfileError } = await supabase.
          from(TABELAS_SUPABASE.PERFIS).
          insert({
            id: userId,
            full_name: fullName,
            setor: finalSetor,
            cargo: finalCargo,
            role: "user",
            contato: cleanEmail,
            updated_at: new Date().toISOString()
          });

          if (insertProfileError) {
            console.error("Erro ao criar perfil:", insertProfileError);
            throw insertProfileError;
          }
        }

        // Forçar a atualização do perfil em memória e no banco de dados para evitar atrasos na interface
        try {
          await refreshProfile({
            id: userId,
            full_name: fullName,
            setor: finalSetor,
            cargo: finalCargo,
            role: "user",
            status: "Autorizado",
            contato: cleanEmail
          }, false);
        } catch (rfErr) {
          console.warn("Aviso ao sincronizar perfil recém-criado:", rfErr);
        }

        setMessage({ type: "success", text: "Cadastro realizado! Faça login para continuar." });
        setMode("login");
      }
    } catch (error: unknown) {
      console.error(`Erro no fluxo de ${mode === "login" ? "login" : "cadastro"}:`, error);
      setMessage({
        type: "error",
        text: obterMensagemErroUsuario(error, mode === "login" ? "login" : "cadastro"),
      });
    } finally {
      setLoading(false);
    }
  };

  const formContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.25, ease: "easeInOut" }
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 110, damping: 18 }
    }
  };

  return (
    <div ref={paginaAutenticacaoRef} id="pagina-autenticacao" data-componente="pagina-autenticacao" className={`pagina-autenticacao pagina-autenticacao--${mode}`}>
      <aside className="pagina-autenticacao__visual" aria-hidden="true">
        <div className="pagina-autenticacao__visual-overlay" />
        <div className="pagina-autenticacao__ondas pagina-autenticacao__ondas--superior" />
        <div className="pagina-autenticacao__ondas pagina-autenticacao__ondas--inferior" />
        <div className="pagina-autenticacao__marca">
          <img
            src="/NIT.webp"
            alt=""
            className="pagina-autenticacao__visual-logo"
          />
          <span className="pagina-autenticacao__marca-traco" />
          {/* <p className="pagina-autenticacao__produto">Cedro <strong>IA</strong></p>
          <p className="pagina-autenticacao__slogan">Governança e avaliação de inteligência artificial</p> */}
        </div>
      </aside>

      <main className="pagina-autenticacao__conteudo">
        <div className="pagina-autenticacao__halo pagina-autenticacao__halo--superior" />
        <div className="pagina-autenticacao__halo pagina-autenticacao__halo--inferior" />

        <AnimatePresence mode="wait">
          <motion.section
            key={mode}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={formContainerVariants}
            className={`autenticacao-card autenticacao-card--${mode}`}
          >
            <motion.header variants={fieldVariants} className="autenticacao-card__cabecalho">
              <span className="autenticacao-card__icone" aria-hidden="true">
                {mode === "login" ? <Lock size={25} strokeWidth={1.7} /> : mode === "signup" ? <User size={25} strokeWidth={1.7} /> : <KeyRound size={25} strokeWidth={1.7} />}
              </span>
              <h1 className="autenticacao-card__titulo">
                {mode === "login" ? "Login" : mode === "signup" ? "Cadastro" : "Recuperar Senha"}
              </h1>
              <p className="autenticacao-card__descricao">
                {mode === "login"
                  ? "Acesse a plataforma para continuar"
                  : mode === "signup"
                    ? "Crie sua conta para solicitar acesso à plataforma"
                    : "Informe seu e-mail para receber as instruções de recuperação."}
              </p>
            </motion.header>

            <form id="formAutenticacao" onSubmit={handleSubmit} className="autenticacao-formulario">
              {mode === "signup" && (
                <motion.div variants={fieldVariants} className="autenticacao-signup__bloco">
                  <div className="autenticacao-campo-grupo">
                    <label htmlFor="auth-nome" className="autenticacao-campo__rotulo">Nome completo</label>
                    <div className="autenticacao-campo">
                      <span className="autenticacao-campo__icone"><User size={20} strokeWidth={1.8} /></span>
                      <input
                        id="auth-nome"
                        type="text"
                        placeholder="Digite seu nome completo"
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="autenticacao-campo__input"
                      />
                    </div>
                  </div>

                  <div className="autenticacao-signup__atribuicoes">
                    {combos.map((combo, index) => (
                      <div key={index} className="autenticacao-signup__atribuicao" style={{ zIndex: combos.length - index }}>
                        {combos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCombos(combos.filter((_, i) => i !== index))}
                            className="autenticacao-signup__remover"
                          >
                            Remover setor/cargo
                          </button>
                        )}

                        <CustomDropdown
                          label="Setor"
                          required
                          placeholder="Selecione o setor..."
                          value={combo.setor}
                          options={sectors}
                          size="lg"
                          className="autenticacao-dropdown"
                          onChange={(sec) => {
                            const newCombos = [...combos];
                            newCombos[index] = { setor: sec, cargo: "" };
                            setCombos(newCombos);
                            fetchCargosParaSetor(sec);
                          }}
                          icon={<Building size={18} strokeWidth={2} />}
                        />

                        <CustomDropdown
                          label="Cargo"
                          required
                          placeholder={combo.setor ? "Selecione o cargo..." : "Selecione o setor primeiro"}
                          value={combo.cargo}
                          options={cargosPorSetor[combo.setor] || []}
                          size="lg"
                          className="autenticacao-dropdown"
                          onChange={(carg) => {
                            const newCombos = [...combos];
                            newCombos[index].cargo = carg;
                            setCombos(newCombos);
                          }}
                          icon={<Briefcase size={18} strokeWidth={2} />}
                          disabled={!combo.setor}
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCombos([...combos, { setor: "", cargo: "" }])}
                      className="autenticacao-signup__adicionar"
                    >
                      + Adicionar outro cargo/setor
                    </button>
                  </div>
                </motion.div>
              )}

              <motion.div variants={fieldVariants} className="autenticacao-campo-grupo">
                <label htmlFor="auth-email" className="autenticacao-campo__rotulo">E-mail corporativo</label>
                <div className="autenticacao-campo">
                  <span className="autenticacao-campo__icone"><Mail size={20} strokeWidth={1.8} /></span>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder={mode === "signup" ? `seuemail${DOMINIO_EMAIL_INSTITUCIONAL}` : "nome@labcedro.com.br"}
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="autenticacao-campo__input"
                  />
                </div>
              </motion.div>

              {mode === "signup" && (
                <motion.p variants={fieldVariants} className="autenticacao-formulario__ajuda">
                  Use seu e-mail institucional ({DOMINIO_EMAIL_INSTITUCIONAL}).
                </motion.p>
              )}

              {mode !== "forgot" && (
                <motion.div variants={fieldVariants} className="autenticacao-campo-grupo">
                  <label htmlFor="auth-senha" className="autenticacao-campo__rotulo">Senha</label>
                  <div className="autenticacao-campo">
                    <span className="autenticacao-campo__icone"><Lock size={20} strokeWidth={1.8} /></span>
                    <input
                      id="auth-senha"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="autenticacao-campo__input autenticacao-campo__input--senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="autenticacao-campo__visibilidade"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={19} strokeWidth={1.7} /> : <Eye size={19} strokeWidth={1.7} />}
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === "login" && (
                <motion.div variants={fieldVariants} className="autenticacao-login__opcoes">
                  <label className="autenticacao-login__lembrar">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Lembrar-me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setMessage(null); }}
                    className="autenticacao-link"
                  >
                    Esqueci minha senha
                  </button>
                </motion.div>
              )}

              {message && (
                <motion.div
                  variants={fieldVariants}
                  className={`autenticacao-mensagem autenticacao-mensagem--${message.type}`}
                  role={message.type === "error" ? "alert" : "status"}
                  aria-live={message.type === "error" ? "assertive" : "polite"}
                >
                  <span className="autenticacao-mensagem__icone" aria-hidden="true">
                    {message.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  </span>
                  <span>{message.text}</span>
                </motion.div>
              )}

              <motion.div variants={fieldVariants}>
                <button id="btnEnviarAutenticacao" type="submit" disabled={loading} className="autenticacao-submit">
                  {loading ? (
                    <Loader2 className="autenticacao-submit__loader" size={18} />
                  ) : (
                    <span>{mode === "login" ? "Entrar" : mode === "signup" ? "Criar cadastro" : "Enviar link de recuperação"}</span>
                  )}
                </button>
              </motion.div>

              {mode === "forgot" && (
                <motion.div variants={fieldVariants}>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setMessage(null); }}
                    className="autenticacao-cancelar"
                  >
                    Cancelar
                  </button>
                </motion.div>
              )}
            </form>

            {mode !== "forgot" && (
              <motion.div variants={fieldVariants} className="autenticacao-card__rodape">
                <button
                  type="button"
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
                  className="autenticacao-card__trocar"
                >
                  {mode === "login" ? <><span>Não possui conta?</span> Criar cadastro</> : <><span>Já possui conta?</span> Entrar</>}
                </button>
              </motion.div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
};
