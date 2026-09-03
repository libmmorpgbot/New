import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import { initTelegram } from "./telegram";
import "./styles.css";

initTelegram();

const container = document.getElementById("ui-root");
if (!container) throw new Error("#ui-root missing from index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
