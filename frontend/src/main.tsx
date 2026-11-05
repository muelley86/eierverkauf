import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Schrift lokal bündeln (Offline-Anforderung): Inter als variable Font.
import "@fontsource-variable/inter";

import "./index.css";
import { starteFarbschema } from "@/lib/farbschema";

starteFarbschema();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
