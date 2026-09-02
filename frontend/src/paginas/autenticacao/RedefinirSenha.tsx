import React, { useState, useEffect } from "react";
import { supabase } from "@/servicos/supabase";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, FlaskConical, Pipette, Sparkles, Microscope, TestTube, Atom, Dna } from "lucide-react";

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error";text: string;} | null>(null);

  useEffect(() => {
    // Garantir que a sessão do Supabase esteja carregada/inicializada ao abrir /reset-password
    const checkSession = async () => {
      try {
        await supabase.auth.getSession();
      } catch (err) {
        console.error("Erro ao obter sessão no ResetPassword:", err);
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const cleanPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword || !cleanConfirm) {
      setMessage({ type: "error", text: "Preencha todos os campos." });
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage({ type: "error", text: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      setMessage({ type: "error", text: "As senhas informadas não coincidem." });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: cleanPassword
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: "Senha atualizada com sucesso. Você já pode acessar o Cedro IA com sua nova senha."
      });

      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err: any) {
      console.error("Erro ao atualizar senha:", err);
      setMessage({
        type: "error",
        text: "Não foi possível atualizar a senha. Solicite um novo link de recuperação e tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="pagina-redefinir-senha" data-componente="pagina-redefinir-senha" className="pagina-autenticacao autenticacao-conteiner"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1920&q=80')`
      }}>
      
      {/* Solid green overlay */}
      <div className="redefinir-senha__grupo" />

      {/* LEFT COLUMN: Logo */}
      <div className="pagina-autenticacao__marca autenticacao-logo">
        <div className="redefinir-senha__grupo-2">
          <img
            src="/NIT.webp"
            alt="Laboratório Cedro"
            className="redefinir-senha__imagem" />
          
        </div>
      </div>

      {/* RIGHT COLUMN: Password Reset Card */}
      <div className="pagina-autenticacao__painel autenticacao-cartao rolagem-personalizada">
        
        {/* Subtle Laboratory Overlay Elements */}
        <div className="redefinir-senha__grupo-3">
          <div className="redefinir-senha__grupo-4" />
          
          <motion.div
            className="redefinir-senha__elemento"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -6, 0], rotate: [0, 6, -6, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
            
            <FlaskConical size={64} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-2"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ y: [0, 8, 0], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
            
            <Pipette size={52} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-3"
            style={{ color: "rgba(242, 146, 34, 0.05)" }}
            animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            
            <Sparkles size={36} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-4"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
            
            <Microscope size={68} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-5"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, 6, 0], rotate: [0, 8, -8, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
            
            <TestTube size={56} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-6"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ scale: [0.95, 1.05, 0.95], rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
            
            <Atom size={60} strokeWidth={1.2} />
          </motion.div>

          <motion.div
            className="redefinir-senha__elemento-7"
            style={{ color: "rgba(7, 86, 24, 0.075)" }}
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}>
            
            <Dna size={72} strokeWidth={1.0} />
          </motion.div>
        </div>

        {/* Top brand indicator (only visible on mobile) */}
        <div className="redefinir-senha__grupo-cedro">
          <img
            src="/NIT.webp"
            alt="Laboratório Cedro"
            className="redefinir-senha__imagem-2" />
          
          <div className="redefinir-senha__grupo-cedro-2">
            <span className="redefinir-senha__texto-cedro">
              Cedro
            </span>
            <span className="redefinir-senha__texto">
              IA
            </span>
          </div>
        </div>

        <div className="redefinir-senha__grupo-redefinir-senha">
          
          {/* Header Title */}
          <div className="redefinir-senha__grupo-redefinir-senha-2">
            <h2 className="redefinir-senha__titulo-secao-redefinir-senha">
              Redefinir senha
            </h2>
            <p className="redefinir-senha__descricao-crie-uma-nova-senha-para-acess">
              Crie uma nova senha para acessar o Cedro IA.
            </p>
          </div>

          <form id="formRedefinirSenha" onSubmit={handleUpdatePassword} className="autenticacao-formulario">
            
            {/* New Password Input */}
            <div className="autenticacao-campo autenticacao-campo--neutro">
              <div className="redefinir-senha__grupo-5">
                <Lock size={20} strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="caret-[#075618] redefinir-senha__campo-nova-senha" />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="redefinir-senha__botao">
                
                {showPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
              </button>
            </div>

            {/* Confirm New Password Input */}
            <div className="autenticacao-campo autenticacao-campo--neutro">
              <div className="redefinir-senha__grupo-5">
                <Lock size={20} strokeWidth={1.75} />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar nova senha"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="caret-[#075618] redefinir-senha__campo-nova-senha" />
              
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="redefinir-senha__botao">
                
                {showConfirmPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
              </button>
            </div>

            {/* Status / Error messages */}
            {message &&
            <div className={`redefinir-senha__grupo-6 ${
            message.type === "success" ? "redefinir-senha__grupo-8" : "redefinir-senha__grupo-9"} redefinir-senha__grupo-7`
            }>
                <span className={`redefinir-senha__texto-2 ${message.type === "success" ? "redefinir-senha__texto-3" : "redefinir-senha__texto-4"}`} />
                <span>
                  {message.text}
                </span>
              </div>
            }

            {/* Submit Button */}
            <button
              id="btnRedefinirSenha"
              type="submit"
              disabled={loading}
              className="autenticacao-acoes">
              
              {loading ?
              <Loader2 className="redefinir-senha__icone-loader2" size={16} /> :

              "Atualizar senha"
              }
            </button>
          </form>

          {/* Back to login */}
          <div className="redefinir-senha__grupo-voltar-para-o-login">
            <button
              type="button"
              onClick={() => {window.location.href = "/";}}
              className="redefinir-senha__botao-voltar-para-o-login">
              
              Voltar para o login
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="redefinir-senha__grupo-cedro-ia">
          <p className="redefinir-senha__descricao-cedro-ia">
            Cedro IA &copy; {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>);

}
