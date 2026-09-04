import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import { initTelegram } from "./telegram";
import "./styles.css";

const container = document.getElementById("ui-root");

/**
 * Last-resort screen. Without it any throw before React mounts leaves the user
 * staring at a black rectangle with no clue what went wrong — which is exactly
 * what an unsupported Telegram method used to produce.
 */
function showFatal(message: string): void {
  if (!container) return;
  container.innerHTML = "";

  const box = document.createElement("div");
  box.className = "interactive";
  box.style.cssText =
    "position:absolute;inset:0;display:grid;place-items:center;padding:24px;" +
    "background:#0b0f16;color:#e8edf5;text-align:center;font-size:14px;line-height:1.5";
  box.innerHTML =
    '<div><p style="margin:0 0 12px;color:#fda4af">Не удалось запустить игру</p>' +
    `<p style="margin:0 0 20px;color:#94a3b8;font-size:12px;word-break:break-word">${message}</p></div>`;
  container.append(box);
}

// Telegram setup must never be able to stop the app from rendering.
try {
  initTelegram();
} catch (err) {
  console.error("[telegram] init failed", err);
}

try {
  if (!container) throw new Error("#ui-root отсутствует в index.html");
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  console.error("[boot] render failed", err);
  showFatal(err instanceof Error ? err.message : String(err));
}

// A crash during the very first render leaves an empty root; say so instead of going black.
window.addEventListener("error", (event) => {
  if (container && container.childElementCount === 0) {
    showFatal(event.message || "Неизвестная ошибка");
  }
});
