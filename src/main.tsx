import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Inicializar logger do frontend (captura erros globais)
import { frontendLogger } from "./lib/frontendLogger";

// Log de inicialização
frontendLogger.info('Application starting', {
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  env: import.meta.env.MODE,
});

// Cleanup ao sair da página
window.addEventListener('beforeunload', () => {
  frontendLogger.flush();
});

createRoot(document.getElementById("root")!).render(<App />);
