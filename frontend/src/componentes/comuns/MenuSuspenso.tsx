/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import {
  filtrarOpcoesMenuSuspenso,
  gestoEhToqueDeSelecao,
} from "@/utilitarios/menu-suspenso-busca";
import {
  calcularPosicaoMenuSuspenso,
  type PosicaoMenuSuspenso,
} from "@/utilitarios/menu-suspenso-posicao";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: (string | DropdownOption)[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  optionsClassName?: string;
  size?: "sm" | "md" | "lg";
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  placeholder,
  value,
  options,
  onChange,
  icon,
  disabled = false,
  required = false,
  className = "",
  triggerClassName = "",
  optionsClassName = "",
  size = "md",
  searchable = false,
  searchPlaceholder = "Digite para buscar...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [posicaoPainel, setPosicaoPainel] = useState<PosicaoMenuSuspenso | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const gatilhoRef = useRef<HTMLButtonElement | null>(null);
  const buscaRef = useRef<HTMLInputElement | null>(null);
  const inicioToqueRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const normalizedOptions: DropdownOption[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  const opcoesVisiveis = searchable
    ? filtrarOpcoesMenuSuspenso(normalizedOptions, termoBusca)
    : normalizedOptions;

  const selecionar = (valor: string) => {
    onChange(valor);
    setIsOpen(false);
  };

  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const displayLabel = selectedOption?.label || placeholder || value || "";

  const raizClasses = [
    "menu-suspenso",
    `menu-suspenso--${size}`,
    isOpen ? "menu-suspenso--aberto" : "",
    disabled ? "menu-suspenso--desabilitado" : "",
    icon ? "menu-suspenso--com-icone" : "",
    className,
  ].filter(Boolean).join(" ");

  const atualizarPosicao = () => {
    const gatilho = gatilhoRef.current;
    if (!gatilho) return;

    const rect = gatilho.getBoundingClientRect();
    setPosicaoPainel(
      calcularPosicaoMenuSuspenso(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { largura: window.innerWidth, altura: window.innerHeight },
      ),
    );
  };

  useEffect(() => {
    if (!isOpen) {
      setPosicaoPainel(null);
      setTermoBusca("");
      inicioToqueRef.current = null;
      return;
    }

    atualizarPosicao();

    // Em telas de toque o foco automático abriria o teclado sobre a lista;
    // ali o campo de busca só recebe foco quando o usuário toca nele.
    const ponteiroPreciso =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
    if (searchable && ponteiroPreciso) {
      buscaRef.current?.focus();
    }

    const reposicionar = () => atualizarPosicao();
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("resize", reposicionar);
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("keydown", fecharComEscape);

    return () => {
      window.removeEventListener("resize", reposicionar);
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [isOpen, searchable]);

  const portalDropdown = typeof document !== "undefined"
    ? createPortal(
        <>
          {isOpen && !disabled && posicaoPainel && (
            <button
              type="button"
              className="menu-suspenso__fechamento"
              aria-label="Fechar opções"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
              }}
            />
          )}
          <AnimatePresence>
            {isOpen && !disabled && posicaoPainel && (
              <motion.div
                key="menu-suspenso-painel"
                initial={{ opacity: 0, y: -2, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -2, scale: 0.99 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className={`menu-suspenso__painel menu-suspenso__painel--portal ${optionsClassName}`.trim()}
                style={{
                  top: posicaoPainel.top,
                  bottom: posicaoPainel.bottom,
                  left: posicaoPainel.left,
                  width: posicaoPainel.width,
                  maxHeight: posicaoPainel.maxHeight,
                }}
                role="listbox"
                onPointerDown={(event) => event.stopPropagation()}
              >
                {searchable && normalizedOptions.length > 0 && (
                  <div className="menu-suspenso__busca">
                    <Search size={14} strokeWidth={2.2} />
                    <input
                      ref={buscaRef}
                      type="text"
                      value={termoBusca}
                      placeholder={searchPlaceholder}
                      autoComplete="off"
                      className="menu-suspenso__busca-campo"
                      aria-label={label ? `Buscar ${label}` : "Buscar opção"}
                      onChange={(event) => setTermoBusca(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          if (opcoesVisiveis.length > 0) selecionar(opcoesVisiveis[0].value);
                        }
                      }}
                    />
                  </div>
                )}

                {normalizedOptions.length === 0 ? (
                  <div className="menu-suspenso__vazio">Nenhuma opção disponível</div>
                ) : opcoesVisiveis.length === 0 ? (
                  <div className="menu-suspenso__vazio">Nenhuma opção encontrada</div>
                ) : (
                  opcoesVisiveis.map((option) => {
                    const active = value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        // A seleção acontece no pointerup e só quando o dedo não
                        // arrastou: no pointerdown, rolar a lista já selecionava.
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          inicioToqueRef.current = {
                            id: event.pointerId,
                            x: event.clientX,
                            y: event.clientY,
                          };
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation();
                          const inicio = inicioToqueRef.current;
                          const mesmoPonteiro = inicio?.id === event.pointerId;
                          inicioToqueRef.current = null;
                          if (!mesmoPonteiro) return;
                          if (!gestoEhToqueDeSelecao(inicio, { x: event.clientX, y: event.clientY })) return;
                          selecionar(option.value);
                        }}
                        onPointerCancel={() => {
                          inicioToqueRef.current = null;
                        }}
                        onClick={(event) => {
                          // detail 0 indica ativação por teclado (Enter/Espaço).
                          event.stopPropagation();
                          if (event.detail === 0) selecionar(option.value);
                        }}
                        className={`menu-suspenso__opcao ${active ? "menu-suspenso__opcao--ativa" : ""}`}
                        role="option"
                        aria-selected={active}
                      >
                        <span>{option.label}</span>
                        {active && <span className="menu-suspenso__opcao-indicador" />}
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body,
      )
    : null;

  return (
    <div className={raizClasses} data-componente="menu-suspenso">
      {label && (
        <label className="menu-suspenso__rotulo">
          {label}
          {required && <span className="menu-suspenso__obrigatorio"> *</span>}
        </label>
      )}

      <div className="menu-suspenso__controle">
        <button
          ref={gatilhoRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          className={`menu-suspenso__gatilho ${triggerClassName}`.trim()}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {icon && <span className="menu-suspenso__icone">{icon}</span>}
          <span className={`menu-suspenso__valor ${!value ? "menu-suspenso__valor--placeholder" : ""}`}>
            {displayLabel}
          </span>
          <span className={`menu-suspenso__seta ${isOpen ? "menu-suspenso__seta--aberta" : ""}`}>
            <ChevronDown size={size === "sm" ? 12 : size === "lg" ? 16 : 14} strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {portalDropdown}
    </div>
  );
};

export default CustomDropdown;
