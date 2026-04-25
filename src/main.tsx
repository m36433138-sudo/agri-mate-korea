import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installClientDiagnostics } from "./lib/clientDiagnostics";

installClientDiagnostics();

// index.html 부트 폴백 타이머 해제
if (typeof window !== "undefined" && (window as any).__bootTimer) {
  clearTimeout((window as any).__bootTimer);
}

createRoot(document.getElementById("root")!).render(<App />);
