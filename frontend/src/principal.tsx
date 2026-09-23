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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        // Falha no registro do service worker não deve impedir o uso do app.
      });
  });
}
