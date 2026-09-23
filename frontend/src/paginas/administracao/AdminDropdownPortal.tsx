import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Calendar, FolderLock, RefreshCw, Sliders, Trash2 } from "lucide-react";
import type { IARecord } from "@/tipos";

interface AdminDropdownPortalProps {
  record: IARecord;
  anchorEl: HTMLButtonElement;
  onClose: () => void;
  onViewRecord: (record: IARecord) => void;
  onEditRecord?: (record: IARecord) => void;
  onViewFlow: (record: IARecord) => void;
  onResetStatusTrigger: (record: IARecord) => void;
  handleArchiveRecord: (record: IARecord) => void;
  isAdmin: boolean;
}

export function AdminDropdownPortal({
  record,
  anchorEl,
  onClose,
  onViewRecord,
  onEditRecord,
  onViewFlow,
  onResetStatusTrigger,
  handleArchiveRecord,
  isAdmin,
}: AdminDropdownPortalProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "bottom" });

  useEffect(() => {
    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 220;
      const dropdownWidth = 208;

      let fixedTop = rect.bottom + 6;
      let fixedLeft = rect.right - dropdownWidth;
      let placement = "bottom";

      if (fixedTop + dropdownHeight > viewportHeight) {
        fixedTop = rect.top - dropdownHeight - 6;
        placement = "top";
      }

      if (fixedLeft < 10) {
        fixedLeft = 10;
      } else if (fixedLeft + dropdownWidth > viewportWidth - 10) {
        fixedLeft = viewportWidth - dropdownWidth - 10;
      }

      setCoords({ top: fixedTop, left: fixedLeft, placement });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorEl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !anchorEl.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorEl, onClose]);

  return createPortal(
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, scale: 0.95, y: coords.placement === "bottom" ? -5 : 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: coords.placement === "bottom" ? -5 : 5 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: "13rem",
      }}
      className="administracao__elemento-visualizar-detalhes"
    >
      <button
        onClick={() => {
          onClose();
          onViewRecord(record);
        }}
        className="administracao__botao-visualizar-detalhes"
      >
        <SheetIcon size={14} className="administracao__icone-database" /> Visualizar detalhes
      </button>

      {isAdmin && (
        <button
          onClick={() => {
            onClose();
            onEditRecord?.(record);
          }}
          className="administracao__botao-visualizar-detalhes"
        >
          <Sliders size={14} className="administracao__icone-database" /> Editar registro
        </button>
      )}

      <button
        onClick={() => {
          onClose();
          onViewFlow(record);
        }}
        className="administracao__botao-visualizar-detalhes"
      >
        <FolderLock size={14} className="administracao__icone-database" /> Visualizar fluxo
      </button>

      <button
        onClick={() => {
          onClose();
          onViewRecord(record);
        }}
        className="administracao__botao-visualizar-detalhes"
      >
        <Calendar size={14} className="administracao__icone-database" /> Visualizar histórico
      </button>

      {isAdmin && (
        <>
          <div className="administracao__grupo-91" />
          <button
            onClick={() => {
              onClose();
              onResetStatusTrigger(record);
            }}
            className="administracao__botao-redefinir-status-2"
          >
            <RefreshCw size={14} className="administracao__icone-refreshcw-3" /> Redefinir status
          </button>
        </>
      )}

      {isAdmin && (
        <>
          <div className="administracao__grupo-91" />
          <button
            onClick={() => {
              onClose();
              handleArchiveRecord(record);
            }}
            className="administracao__botao-arquivar-registro"
          >
            <Trash2 size={14} className="administracao__icone-trash2" /> Arquivar registro
          </button>
        </>
      )}
    </motion.div>,
    document.body,
  );
}

function SheetIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
