import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import { obterSetoresAtivos } from "@/servicos/setores";
import type { UserProfile } from "@/tipos";
import {
  manterCargoAoTrocarSetor,
  validarAtribuicoesCadastro,
  type AtribuicaoCadastro,
  type SetorCadastro,
} from "@/utilitarios/cadastro-usuario";
import { obterAtribuicoesPerfil } from "@/utilitarios/perfil-usuario";

interface ModalEditarAtribuicoesUsuarioProps {
  usuario: UserProfile;
  onClose: () => void;
  onSave: (userId: string, atribuicoes: AtribuicaoCadastro[]) => Promise<void>;
}

export function ModalEditarAtribuicoesUsuario({
  usuario,
  onClose,
  onSave,
}: ModalEditarAtribuicoesUsuarioProps) {
  const [setores, setSetores] = useState<SetorCadastro[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoCadastro[]>(() => {
    const atuais = obterAtribuicoesPerfil(usuario.setor, usuario.cargo);
    return atuais.length > 0 ? atuais : [{ setor: "", cargo: "" }];
  });
  const [carregandoSetores, setCarregandoSetores] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    obterSetoresAtivos()
      .then((dados) => {
        if (ativo) setSetores(dados);
      })
      .catch(() => {
        if (ativo) setErro("Não foi possível carregar os setores ativos.");
      })
      .finally(() => {
        if (ativo) setCarregandoSetores(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !salvando) onClose();
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [onClose, salvando]);

  const setoresUsados = useMemo(
    () => new Set(atribuicoes.map(({ setor }) => setor).filter(Boolean)),
    [atribuicoes],
  );

  const alterarSetor = (indice: number, setor: string) => {
    setAtribuicoes((atuais) =>
      atuais.map((item, itemIndice) =>
        itemIndice === indice
          ? {
              setor,
              cargo: manterCargoAoTrocarSetor(item.cargo, setor, setores),
            }
          : item,
      ),
    );
    setErro(null);
  };

  const alterarCargo = (indice: number, cargo: string) => {
    setAtribuicoes((atuais) =>
      atuais.map((item, itemIndice) =>
        itemIndice === indice ? { ...item, cargo } : item,
      ),
    );
    setErro(null);
  };

  const salvar = async () => {
    const erroValidacao = validarAtribuicoesCadastro(atribuicoes, setores);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await onSave(usuario.id, atribuicoes);
      onClose();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="administracao-atribuicoes-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-editar-atribuicoes">
      <button
        type="button"
        className="administracao-atribuicoes-modal__fundo"
        aria-label="Fechar modal"
        disabled={salvando}
        onClick={onClose}
      />
      <section className="administracao-atribuicoes-modal__painel">
        <header className="administracao-atribuicoes-modal__cabecalho">
          <div>
            <h2 id="titulo-editar-atribuicoes">Editar setor/cargo</h2>
            <p>{usuario.full_name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={salvando} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="administracao-atribuicoes-modal__conteudo">
          {atribuicoes.map((atribuicao, indice) => {
            const setorAtual = setores.find(({ name }) => name === atribuicao.setor);
            const opcoesSetor = setores
              .filter(({ name }) => name === atribuicao.setor || !setoresUsados.has(name))
              .map(({ name }) => name);

            return (
              <div className="administracao-atribuicoes-modal__par" key={`${indice}-${atribuicao.setor}`}>
                <div>
                  <label>Setor</label>
                  <CustomDropdown
                    value={atribuicao.setor}
                    placeholder={carregandoSetores ? "Carregando..." : "Selecione o setor"}
                    options={opcoesSetor}
                    onChange={(valor) => alterarSetor(indice, valor)}
                    disabled={carregandoSetores || salvando}
                  />
                </div>
                <div>
                  <label>Cargo</label>
                  <CustomDropdown
                    value={atribuicao.cargo}
                    placeholder={atribuicao.setor ? "Selecione o cargo" : "Selecione o setor primeiro"}
                    options={setorAtual?.cargos || []}
                    onChange={(valor) => alterarCargo(indice, valor)}
                    disabled={!atribuicao.setor || salvando}
                  />
                </div>
                <button
                  type="button"
                  className="administracao-atribuicoes-modal__remover"
                  onClick={() => {
                    setAtribuicoes((atuais) => atuais.filter((_, itemIndice) => itemIndice !== indice));
                    setErro(null);
                  }}
                  disabled={salvando}
                  aria-label={`Remover vínculo ${indice + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className="administracao-atribuicoes-modal__adicionar"
            onClick={() => setAtribuicoes((atuais) => [...atuais, { setor: "", cargo: "" }])}
            disabled={salvando || carregandoSetores || atribuicoes.length >= setores.length}
          >
            <Plus size={15} /> Adicionar vínculo
          </button>

          {erro && <p className="administracao-atribuicoes-modal__erro" role="alert">{erro}</p>}
        </div>

        <footer className="administracao-atribuicoes-modal__acoes">
          <button type="button" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || carregandoSetores}>
            {salvando && <Loader2 size={15} className="administracao-atribuicoes-modal__spinner" />}
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </footer>
      </section>
    </div>
  );
}
