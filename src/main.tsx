import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";

async function start() {
  // `npm run dev` outside claude.ai: an in-memory stand-in for the artifact runtime with example data.
  if (import.meta.env.DEV && !window.claude) await import("./dev/mock");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start();
