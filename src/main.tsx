import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installClientDiagnostics } from "./lib/clientDiagnostics";

installClientDiagnostics();

// index.html 부트 폴백 타이머 해제 + 이미 노출된 폴백도 숨김
if (typeof window !== "undefined") {
  if ((window as any).__bootTimer) {
    clearTimeout((window as any).__bootTimer);
  }
  const fb = document.getElementById("boot-fallback");
  if (fb) fb.style.display = "none";
}

createRoot(document.getElementById("root")!).render(<App />);
