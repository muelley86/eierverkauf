import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Schriftarten lokal bündeln (Offline-Anforderung). Manrope deckt Body und
// Display ab (kein Serif mehr seit MANROPE_PATCH); JetBrains Mono bleibt für
// Zahlen, Eyebrows und Tabellenköpfe.
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
