import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/bench.css";
import "./styles/register.css";
import "./styles/tags.css";
import "./styles/ledger.css";

import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { I18nProvider } from "./i18n/i18n.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <React.StrictMode>
    {/* The wallet providers live in the anchor dock, loaded after the inspector (src/anchor/AnchorDock.tsx). */}
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
