import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { ZeitraumProvider } from "@/context/ZeitraumContext";
import { KundenFilterProvider } from "@/context/KundenFilterContext";
import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import ImportDetail from "@/pages/ImportDetail";
import Kunden from "@/pages/Kunden";
import KundenDetail from "@/pages/KundenDetail";
import Artikel from "@/pages/Artikel";
import ArtikelDetail from "@/pages/ArtikelDetail";
import Ranking from "@/pages/Ranking";
import Belege from "@/pages/Belege";
import Jahresvergleich from "@/pages/Jahresvergleich";
import Zeitraumvergleich from "@/pages/Zeitraumvergleich";
import Konfiguration from "@/pages/Konfiguration";

export default function App() {
  return (
    <ZeitraumProvider>
      <KundenFilterProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="import" element={<Import />} />
            <Route path="import/:id" element={<ImportDetail />} />
            <Route path="kunden" element={<Kunden />} />
            <Route path="kunden/:nr" element={<KundenDetail />} />
            <Route path="artikel" element={<Artikel />} />
            <Route path="artikel/:code" element={<ArtikelDetail />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="belege" element={<Belege />} />
            <Route path="zeitraumvergleich" element={<Zeitraumvergleich />} />
            <Route path="jahresvergleich" element={<Jahresvergleich />} />
            <Route path="konfiguration" element={<Konfiguration />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </KundenFilterProvider>
      <Toaster richColors position="top-right" />
    </ZeitraumProvider>
  );
}
