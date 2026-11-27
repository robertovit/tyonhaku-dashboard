import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { watchForUpdates } from "./lib/updates";
import "./styles/app.css";

if (!import.meta.env.DEV) watchForUpdates();

// The visible area above the on-screen keyboard: full-screen dialogs on a phone size themselves to it, so the
// focused field and the save row stay usable (iOS keeps the layout viewport and only shrinks this one).
const vv = window.visualViewport;
if (vv) {
  const fit = () => {
    const root = document.documentElement.style;
    root.setProperty("--vvh", `${Math.round(vv.height)}px`);
    root.setProperty("--vvtop", `${Math.round(vv.offsetTop)}px`);
  };
  fit();
  vv.addEventListener("resize", fit);
  vv.addEventListener("scroll", fit);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
