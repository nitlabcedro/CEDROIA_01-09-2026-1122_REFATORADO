import React, { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/contextos/ContextoAutenticacao";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";
import {
  criarEstadoHistoricoCedroIA,
  ehEstadoHistoricoCedroIA,
} from "@/utilitarios/historico-navegacao";

const TAMANHO_MINIMO_SENHA = 8;

type ErrosCampos = {
  novaSenha?: string;
  confirmarSenha?: string;
};

const variantesFormulario = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const variantesCampo = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 110, damping: 18 }
  }
};

interface RedefinirSenhaProps {
  onConcluida?: (mensagem: string) => void;
  onRetornarLogin?: () => void;
}

export default function ResetPassword({
  onConcluida,
  onRetornarLogin,
}: RedefinirSenhaProps) {
  const {
    session,
    loading: authLoading,
    recuperacaoSenhaEmAndamento,
    finalizarRecuperacaoSenha,
    signOut,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ErrosCampos>({});
  const [message, setMessage] = useState<{ type: "error"; text: string } | null>(null);

  const recuperacaoValida = Boolean(
    !authLoading
    && recuperacaoSenhaEmAndamento
    && session?.user,
  );

  const irParaLogin = async () => {
    try {
      await signOut({ somenteLocal: true });
    } catch {
      // Mesmo se o encerramento da sessão falhar, a rota inicial exibe o login.
    }
    const navigationIndex = ehEstadoHistoricoCedroIA(window.history.state)
      ? window.history.state.navigationIndex
      : 0;
    window.history.replaceState(
      criarEstadoHistoricoCedroIA({
        protegida: false,
        navigationIndex,
      }),
      "",
      "/",
    );
    onRetornarLogin?.();
  };

  const validarCampos = () => {
    const erros: ErrosCampos = {};
    const cleanPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword) {
      erros.novaSenha = "Informe a nova senha.";
    } else if (cleanPassword.length < TAMANHO_MINIMO_SENHA) {
      erros.novaSenha = "A senha deve possuir pelo menos 8 caracteres.";
    }

    if (!cleanConfirm) {
      erros.confirmarSenha = "Informe a confirmação da senha.";
    } else if (cleanPassword !== cleanConfirm) {
      erros.confirmarSenha = "As senhas não coincidem.";
    }

    return { erros, cleanPassword };
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const { erros, cleanPassword } = validarCampos();
    setFieldErrors(erros);

    if (erros.novaSenha || erros.confirmarSenha) {
      return;
    }
    if (!recuperacaoValida) {
      setMessage({
        type: "error",
        text: "Este link de redefinição de senha é inválido ou expirou. Solicite um novo link.",
      });
      return;
    }

    setLoading(true);

    try {
      await finalizarRecuperacaoSenha(cleanPassword);
      const navigationIndex = ehEstadoHistoricoCedroIA(window.history.state)
        ? window.history.state.navigationIndex
        : 0;
      window.history.replaceState(
        criarEstadoHistoricoCedroIA({
          protegida: false,
          navigationIndex,
        }),
        "",
        "/",
      );
      onConcluida?.("Senha redefinida com sucesso. Faça login com sua nova senha.");
    } catch (error: unknown) {
      console.error("Erro ao redefinir senha:", error);
      setMessage({
        type: "error",
        text: obterMensagemErroUsuario(error, "redefinicao-senha"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="pagina-redefinir-senha"
      data-componente="pagina-redefinir-senha"
      className="pagina-autenticacao pagina-autenticacao--reset"
    >
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
        </div>
      </aside>

      <main className="pagina-autenticacao__conteudo">
        <div className="pagina-autenticacao__halo pagina-autenticacao__halo--superior" />
        <div className="pagina-autenticacao__halo pagina-autenticacao__halo--inferior" />

        <motion.section
          initial="hidden"
          animate="visible"
          variants={variantesFormulario}
          className="autenticacao-card autenticacao-card--reset"
        >
          {!authLoading && !recuperacaoValida ? (
            <>
              <motion.header variants={variantesCampo} className="autenticacao-card__cabecalho">
                <span className="autenticacao-card__icone" aria-hidden="true">
                  <AlertCircle size={25} strokeWidth={1.7} />
                </span>
                <h1 className="autenticacao-card__titulo">Link inválido ou expirado</h1>
                <p className="autenticacao-card__descricao">
                  Este link de redefinição de senha é inválido ou expirou. Solicite um novo link.
                </p>
              </motion.header>

              <motion.div variants={variantesCampo}>
                <button
                  type="button"
                  className="autenticacao-submit"
                  onClick={irParaLogin}
                >
                  Voltar para o login
                </button>
              </motion.div>
            </>
          ) : authLoading ? (
            <motion.header variants={variantesCampo} className="autenticacao-card__cabecalho">
              <span className="autenticacao-card__icone" aria-hidden="true">
                <Loader2 className="autenticacao-submit__loader" size={25} />
              </span>
              <h1 className="autenticacao-card__titulo">Validando link</h1>
              <p className="autenticacao-card__descricao">Aguarde um instante.</p>
            </motion.header>
          ) : (
            <>
              <motion.header variants={variantesCampo} className="autenticacao-card__cabecalho">
                <span className="autenticacao-card__icone" aria-hidden="true">
                  <KeyRound size={25} strokeWidth={1.7} />
                </span>
                <h1 className="autenticacao-card__titulo">Redefinir senha</h1>
                <p className="autenticacao-card__descricao">
                  Crie uma nova senha para acessar o Cedro IA.
                </p>
              </motion.header>

              <form
                id="formRedefinirSenha"
                onSubmit={handleUpdatePassword}
                className="autenticacao-formulario"
                noValidate
              >
                <motion.div variants={variantesCampo} className="autenticacao-campo-grupo">
                  <label htmlFor="reset-nova-senha" className="autenticacao-campo__rotulo">
                    Nova senha
                  </label>
                  <div className={`autenticacao-campo${fieldErrors.novaSenha ? " autenticacao-campo--erro" : ""}`}>
                    <span className="autenticacao-campo__icone">
                      <Lock size={20} strokeWidth={1.8} />
                    </span>
                    <input
                      id="reset-nova-senha"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua nova senha"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (fieldErrors.novaSenha) {
                          setFieldErrors((atual) => ({ ...atual, novaSenha: undefined }));
                        }
                      }}
                      className="autenticacao-campo__input autenticacao-campo__input--senha"
                      aria-invalid={Boolean(fieldErrors.novaSenha)}
                      aria-describedby="reset-senha-ajuda reset-senha-erro"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((atual) => !atual)}
                      className="autenticacao-campo__visibilidade"
                      aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                    >
                      {showPassword ? <EyeOff size={19} strokeWidth={1.7} /> : <Eye size={19} strokeWidth={1.7} />}
                    </button>
                  </div>
                  <p id="reset-senha-ajuda" className="autenticacao-formulario__ajuda">
                    Use pelo menos 8 caracteres.
                  </p>
                  {fieldErrors.novaSenha && (
                    <p id="reset-senha-erro" className="autenticacao-campo__erro" role="alert">
                      {fieldErrors.novaSenha}
                    </p>
                  )}
                </motion.div>

                <motion.div variants={variantesCampo} className="autenticacao-campo-grupo">
                  <label htmlFor="reset-confirmar-senha" className="autenticacao-campo__rotulo">
                    Confirmar nova senha
                  </label>
                  <div className={`autenticacao-campo${fieldErrors.confirmarSenha ? " autenticacao-campo--erro" : ""}`}>
                    <span className="autenticacao-campo__icone">
                      <Lock size={20} strokeWidth={1.8} />
                    </span>
                    <input
                      id="reset-confirmar-senha"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Digite novamente sua senha"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (fieldErrors.confirmarSenha) {
                          setFieldErrors((atual) => ({ ...atual, confirmarSenha: undefined }));
                        }
                      }}
                      className="autenticacao-campo__input autenticacao-campo__input--senha"
                      aria-invalid={Boolean(fieldErrors.confirmarSenha)}
                      aria-describedby={fieldErrors.confirmarSenha ? "reset-confirmar-erro" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((atual) => !atual)}
                      className="autenticacao-campo__visibilidade"
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    >
                      {showConfirmPassword ? <EyeOff size={19} strokeWidth={1.7} /> : <Eye size={19} strokeWidth={1.7} />}
                    </button>
                  </div>
                  {fieldErrors.confirmarSenha && (
                    <p id="reset-confirmar-erro" className="autenticacao-campo__erro" role="alert">
                      {fieldErrors.confirmarSenha}
                    </p>
                  )}
                </motion.div>

                {message && (
                  <motion.div
                    variants={variantesCampo}
                    className="autenticacao-mensagem autenticacao-mensagem--error"
                    role="alert"
                    aria-live="assertive"
                  >
                    <span className="autenticacao-mensagem__icone" aria-hidden="true">
                      <AlertCircle size={18} />
                    </span>
                    <span>{message.text}</span>
                  </motion.div>
                )}

                <motion.div variants={variantesCampo}>
                  <button
                    id="btnRedefinirSenha"
                    type="submit"
                    disabled={loading}
                    className="autenticacao-submit"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="autenticacao-submit__loader" size={18} />
                        <span>Atualizando...</span>
                      </>
                    ) : (
                      <span>Atualizar senha</span>
                    )}
                  </button>
                </motion.div>
              </form>

              <motion.div variants={variantesCampo} className="autenticacao-card__rodape">
                <button
                  type="button"
                  onClick={irParaLogin}
                  className="autenticacao-card__trocar"
                >
                  ← Voltar para o login
                </button>
              </motion.div>
            </>
          )}
        </motion.section>
      </main>
    </div>
  );
}
