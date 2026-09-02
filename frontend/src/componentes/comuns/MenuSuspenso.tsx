/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

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
}

type PosicaoPainel = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MARGEM_VIEWPORT = 10;
const ESPACO_PAINEL = 6;
const ALTURA_MAXIMA_PAINEL = 280;

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [posicaoPainel, setPosicaoPainel] = useState<PosicaoPainel | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement | null>(null);

  const normalizedOptions: DropdownOption[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

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
    const larguraDisponivel = Math.max(180, window.innerWidth - MARGEM_VIEWPORT * 2);
    const width = Math.min(rect.width, larguraDisponivel);
    const left = Math.min(
      Math.max(rect.left, MARGEM_VIEWPORT),
      Math.max(MARGEM_VIEWPORT, window.innerWidth - width - MARGEM_VIEWPORT),
    );

    const espacoAbaixo = window.innerHeight - rect.bottom - MARGEM_VIEWPORT;
    const espacoAcima = rect.top - MARGEM_VIEWPORT;
    const abrirAcima = espacoAbaixo < 180 && espacoAcima > espacoAbaixo;
    const maxHeight = Math.min(
      ALTURA_MAXIMA_PAINEL,
      Math.max(120, abrirAcima ? espacoAcima - ESPACO_PAINEL : espacoAbaixo - ESPACO_PAINEL),
    );

    setPosicaoPainel({
      top: abrirAcima ? undefined : rect.bottom + ESPACO_PAINEL,
      bottom: abrirAcima ? window.innerHeight - rect.top + ESPACO_PAINEL : undefined,
      left,
      width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setPosicaoPainel(null);
      return;
    }

    atualizarPosicao();

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
  }, [isOpen]);

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
                {normalizedOptions.length === 0 ? (
                  <div className="menu-suspenso__vazio">Nenhuma opção disponível</div>
                ) : (
                  normalizedOptions.map((option) => {
                    const active = value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onPointerDown={(event) => {
                          // Faz a seleção no pointerdown para evitar que eventos de
                          // fechamento/click-outside desmontem o portal antes do click.
                          event.preventDefault();
                          event.stopPropagation();
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                        onClick={(event) => {
                          // Fallback de acessibilidade para ativação por teclado.
                          event.stopPropagation();
                          onChange(option.value);
                          setIsOpen(false);
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
