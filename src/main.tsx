import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "@/lib/appPush";
import { captureInstallPrompt } from "@/lib/installPrompt";

captureInstallPrompt();
// 홈 화면 앱·알림용 서비스 워커 (개발 서버·미리보기 창에서는 건너뜀)
if (import.meta.env.PROD) window.addEventListener("load", () => { void registerServiceWorker(); });

createRoot(document.getElementById("root")!).render(<App />);
