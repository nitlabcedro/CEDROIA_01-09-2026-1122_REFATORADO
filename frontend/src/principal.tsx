import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import Aplicacao from "@/Aplicacao";
import { AuthProvider } from "@/contextos/ContextoAutenticacao";
import "@/estilos/index.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Aplicacao />
    </AuthProvider>
  </StrictMode>
);
